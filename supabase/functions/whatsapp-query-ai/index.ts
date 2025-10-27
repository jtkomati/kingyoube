import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate input
    const requestSchema = z.object({
      wa_phone: z.string().min(10).max(15).regex(/^\+?[1-9]\d{1,14}$/, 'Formato de telefone inválido'),
      wa_message: z.string().min(1).max(500, 'Mensagem muito longa')
    });

    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ response: 'Formato de requisição inválido.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { wa_phone, wa_message } = validation.data;

    console.log('Query do WhatsApp com IA:', { wa_phone, wa_message })

    // 1. Autenticar usuário via telefone
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, phone_number')
      .eq('phone_number', wa_phone)
      .maybeSingle()

    if (!profile) {
      return new Response(
        JSON.stringify({ response: 'Erro: Número não autorizado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.id)
      .maybeSingle()

    const userRole = roleData?.role || 'VIEWER'

    // 2. Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: profile.id,
      user_role: userRole,
      action: 'whatsapp_query_ai',
      details: `Query: ${wa_message}`,
    })

    // 3. Buscar contexto - últimas transações
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + 90)

    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        *,
        category:categories(name),
        customer:customers(first_name, last_name, company_name)
      `)
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', futureDate.toISOString().split('T')[0])

    // 4. Usar Gemini Flash Lite para processar query
    // Sanitize message to prevent prompt injection
    const sanitizedMessage = wa_message
      .replace(/\[SYSTEM\]/gi, '')
      .replace(/\[INSTRUCTION\]/gi, '')
      .replace(/ignore previous/gi, '')
      .slice(0, 500);

    const systemPrompt = `Você é o assistente financeiro FAS AI via WhatsApp. 
    
Você tem acesso aos seguintes dados:
- Transações: ${JSON.stringify(transactions?.slice(0, 20) || [])}

O usuário é: ${profile.full_name} (${userRole})

Instruções:
- Responda de forma concisa e objetiva
- Use emojis moderadamente
- Formate valores como R$ X.XXX,XX
- Se a pergunta for sobre projeção de caixa, calcule as entradas e saídas
- Se perguntarem sobre impostos, mencione o regime tributário
- Se perguntarem sobre quem deve, liste os clientes com receitas vencidas

Sempre termine com: "💬 Posso ajudar com algo mais?"`

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sanitizedMessage }
        ],
        temperature: 0.7,
      }),
    })

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    const response = aiData.choices[0].message.content

    console.log('Resposta da IA:', response)

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    // Log detailed error server-side only
    console.error('Erro na função whatsapp-query-ai:', {
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Return generic error message to client
    return new Response(
      JSON.stringify({ response: 'Não foi possível processar sua consulta. Tente novamente mais tarde.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
