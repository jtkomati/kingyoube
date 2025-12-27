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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header obrigatório' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extrair company_id do JWT do usuário autenticado
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Tentar pegar organization_id do body (nova abordagem)
    let companyId: string | null = null;
    let days = 30;
    
    try {
      const body = await req.json();
      if (body?.organization_id) {
        companyId = body.organization_id;
      }
      if (body?.days) {
        days = body.days;
      }
    } catch {
      // Body pode ser vazio, ignorar
    }

    // Fallback para profiles.company_id se não passar organization_id
    if (!companyId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (profileError || !profile?.company_id) {
        return new Response(
          JSON.stringify({ error: 'Usuário sem empresa associada' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      companyId = profile.company_id
    }

    console.log('Calculando projeção de fluxo de caixa para', days, 'dias', 'company:', companyId)

    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + days)

    // Buscar transações futuras filtradas por company_id
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .order('due_date', { ascending: true })

    if (error) {
      console.error('Erro ao buscar transações:', error)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar transações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Agrupar por data
    const projectionMap = new Map<string, { inflows: number; outflows: number }>()

    transactions?.forEach((tx) => {
      const date = tx.due_date
      if (!projectionMap.has(date)) {
        projectionMap.set(date, { inflows: 0, outflows: 0 })
      }

      const projection = projectionMap.get(date)!
      if (tx.type === 'RECEIVABLE') {
        projection.inflows += Number(tx.net_amount)
      } else {
        projection.outflows += Number(tx.net_amount)
      }
    })

    // Converter para array e calcular saldos acumulados
    const projection: { date: string; balance: number; inflows: number; outflows: number }[] = []
    let accumulatedBalance = 0

    // Preencher todos os dias do período
    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      const dayData = projectionMap.get(dateStr) || { inflows: 0, outflows: 0 }
      accumulatedBalance += dayData.inflows - dayData.outflows

      projection.push({
        date: dateStr,
        balance: accumulatedBalance,
        inflows: dayData.inflows,
        outflows: dayData.outflows,
      })
    }

    console.log('Projeção calculada:', projection.length, 'dias')

    return new Response(JSON.stringify(projection), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Erro na função:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
