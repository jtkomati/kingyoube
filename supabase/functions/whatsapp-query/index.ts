import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Timing-safe comparison
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const webhookSecret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get request body as text for HMAC verification
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    // Verify HMAC signature
    const signature = req.headers.get('X-Hub-Signature-256');
    if (!signature) {
      console.error('Missing X-Hub-Signature-256 header');
      return new Response(
        JSON.stringify({ response: 'Não autorizado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Compute HMAC
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const hmacBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyText));
    const hmacArray = Array.from(new Uint8Array(hmacBuffer));
    const computedSignature = 'sha256=' + hmacArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Timing-safe comparison
    if (!timingSafeEqual(signature, computedSignature)) {
      console.error('Invalid HMAC signature');
      return new Response(
        JSON.stringify({ response: 'Não autorizado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Validate input
    const requestSchema = z.object({
      wa_phone: z.string().min(10).max(15).regex(/^\+?[1-9]\d{1,14}$/, 'Formato de telefone inválido'),
      wa_message: z.string().min(1).max(500, 'Mensagem muito longa'),
      timestamp: z.number().optional()
    });

    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ response: 'Formato de requisição inválido.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { wa_phone, wa_message, timestamp } = validation.data;

    // Validate timestamp to prevent replay attacks (5 minute window)
    if (timestamp) {
      const now = Date.now() / 1000;
      const timeDiff = Math.abs(now - timestamp);
      if (timeDiff > 300) {
        console.error('Timestamp too old:', timeDiff);
        return new Response(
          JSON.stringify({ response: 'Requisição expirada.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
    }

    console.log('Processing WhatsApp query')

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
      action: 'whatsapp_query',
      details: `Query: ${wa_message}`,
    })

    // 3. Análise da mensagem (NLU simplificado)
    const messageLower = wa_message.toLowerCase()
    let days = 30 // default

    if (messageLower.includes('mês') || messageLower.includes('mes')) {
      const matches = wa_message.match(/(\d+)\s*(mês|mes|meses)/i)
      if (matches) {
        days = parseInt(matches[1]) * 30
      }
    } else if (messageLower.includes('dia')) {
      const matches = wa_message.match(/(\d+)\s*dias?/i)
      if (matches) {
        days = parseInt(matches[1])
      }
    }

    // 4. Buscar projeção
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + days)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', futureDate.toISOString().split('T')[0])

    // 5. Análise
    let totalInflows = 0
    let totalOutflows = 0
    const criticalDays: string[] = []

    let balance = 0
    const dateMap = new Map<string, { inflows: number; outflows: number }>()

    transactions?.forEach((tx) => {
      const date = tx.due_date
      if (!dateMap.has(date)) {
        dateMap.set(date, { inflows: 0, outflows: 0 })
      }
      const day = dateMap.get(date)!

      if (tx.type === 'RECEIVABLE') {
        day.inflows += Number(tx.net_amount)
        totalInflows += Number(tx.net_amount)
      } else {
        day.outflows += Number(tx.net_amount)
        totalOutflows += Number(tx.net_amount)
      }
    })

    // Verificar dias críticos
    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      const day = dateMap.get(dateStr) || { inflows: 0, outflows: 0 }

      balance += day.inflows - day.outflows
      if (balance < 0) {
        criticalDays.push(dateStr)
      }
    }

    const finalBalance = totalInflows - totalOutflows

    // 6. Formatar resposta em texto puro
    let response = `Olá, ${profile.full_name}. Analisei os próximos ${days} dias:\n`
    response += `Saldo Final: R$ ${finalBalance.toFixed(2)}\n`
    response += `Entradas: R$ ${totalInflows.toFixed(2)}\n`
    response += `Saídas: R$ ${totalOutflows.toFixed(2)}\n`

    if (criticalDays.length > 0) {
      response += `⚠️ Atenção: ${criticalDays.length} dia(s) com saldo negativo detectados.`
    } else {
      response += `✓ Não identifiquei dias com saldo negativo.`
    }

    console.log('Response generated successfully')

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    // Log detailed error server-side only
    console.error('Erro na função whatsapp-query:', {
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
