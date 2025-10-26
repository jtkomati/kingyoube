import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { wa_phone, wa_message } = await req.json()

    console.log('Query do WhatsApp:', { wa_phone, wa_message })

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

    console.log('Resposta gerada:', response)

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
