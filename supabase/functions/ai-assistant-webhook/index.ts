import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ERPContext {
  transactions: any[]
  customers: any[]
  suppliers: any[]
  invoices: any[]
  recentActivity: string
  financialSummary: {
    totalReceitas: number
    totalDespesas: number
    saldo: number
  }
}

serve(async (req) => {
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
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { message } = await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Mensagem inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Processando consulta de IA para usuário:', user.id)

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'ai_assistant_query',
      details: `Query: ${message.substring(0, 100)}`,
    })

    // Buscar dados reais do ERP
    console.log('Buscando dados do ERP...')
    
    const erpContext: ERPContext = {
      transactions: [],
      customers: [],
      suppliers: [],
      invoices: [],
      recentActivity: '',
      financialSummary: {
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0
      }
    }

    // Buscar transações recentes (últimos 30 dias)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, category:categories(name), customer:customers(company_name, first_name, last_name), supplier:suppliers(company_name, first_name, last_name)')
      .eq('created_by', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)

    erpContext.transactions = transactions || []

    // Buscar clientes
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .eq('created_by', user.id)
      .limit(20)

    erpContext.customers = customers || []

    // Buscar fornecedores
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('*')
      .eq('created_by', user.id)
      .limit(20)

    erpContext.suppliers = suppliers || []

    // Buscar notas fiscais de saída
    const { data: invoices } = await supabase
      .from('transactions')
      .select('*')
      .eq('created_by', user.id)
      .eq('type', 'receita')
      .not('invoice_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)

    erpContext.invoices = invoices || []

    // Calcular resumo financeiro
    erpContext.financialSummary = {
      totalReceitas: erpContext.transactions
        .filter(t => t.type === 'receita')
        .reduce((sum, t) => sum + Number(t.net_amount || 0), 0),
      totalDespesas: erpContext.transactions
        .filter(t => t.type === 'despesa')
        .reduce((sum, t) => sum + Number(t.net_amount || 0), 0),
      saldo: 0
    }
    erpContext.financialSummary.saldo = 
      erpContext.financialSummary.totalReceitas - erpContext.financialSummary.totalDespesas

    // Criar resumo da atividade recente
    erpContext.recentActivity = `Nos últimos 30 dias: ${erpContext.transactions.length} transações, ${erpContext.customers.length} clientes cadastrados, ${erpContext.suppliers.length} fornecedores cadastrados.`

    console.log('Contexto do ERP carregado:', {
      transacoes: erpContext.transactions.length,
      clientes: erpContext.customers.length,
      fornecedores: erpContext.suppliers.length,
      receitas: erpContext.financialSummary.totalReceitas,
      despesas: erpContext.financialSummary.totalDespesas
    })

    // Preparar prompt para IA com contexto real
    const systemPrompt = `Você é um assistente financeiro inteligente que ajuda o usuário a entender e gerenciar suas finanças empresariais.

DADOS DO ERP (ÚLTIMOS 30 DIAS):

Resumo Financeiro:
- Total de Receitas: R$ ${erpContext.financialSummary.totalReceitas.toFixed(2)}
- Total de Despesas: R$ ${erpContext.financialSummary.totalDespesas.toFixed(2)}
- Saldo: R$ ${erpContext.financialSummary.saldo.toFixed(2)}

Atividade Recente:
${erpContext.recentActivity}

Transações Recentes: ${erpContext.transactions.length} transações
Clientes: ${erpContext.customers.length} clientes cadastrados
Fornecedores: ${erpContext.suppliers.length} fornecedores cadastrados
Notas Fiscais Emitidas: ${erpContext.invoices.length} NF-e

INSTRUÇÕES:
1. Use APENAS os dados reais fornecidos acima para responder
2. Forneça respostas precisas, diretas e baseadas em números reais
3. Se não houver dados suficientes, indique isso claramente
4. Seja profissional e objetivo
5. Formate valores monetários como R$ XX.XXX,XX
6. Use exemplos concretos dos dados quando relevante`

    // Chamar Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    console.log('Chamando Lovable AI...')
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('Erro na chamada Lovable AI:', {
        status: aiResponse.status,
        body: errorText
      })
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Limite de uso da IA excedido. Por favor, tente novamente em alguns instantes.',
            response: 'Desculpe, o serviço de IA está temporariamente indisponível devido ao alto volume de requisições. Tente novamente em alguns instantes.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Créditos da IA esgotados. Por favor, adicione créditos no workspace.',
            response: 'Desculpe, os créditos de IA foram esgotados. Entre em contato com o administrador.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      throw new Error(`Erro na IA: ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    const aiMessage = aiData.choices?.[0]?.message?.content || 'Não foi possível gerar uma resposta.'

    console.log('Resposta da IA gerada com sucesso')

    return new Response(JSON.stringify({ response: aiMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Erro na função ai-assistant-webhook:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao processar requisição',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})