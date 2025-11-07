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

    // Buscar role do usuário
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    const userRole = userRoles?.role || 'VIEWER'

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_role: userRole,
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

    // Buscar company_id do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const companyId = profile?.company_id

    console.log('Company ID:', companyId)

    // Buscar transações da empresa (sem joins para evitar RLS)
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .order('due_date', { ascending: false })
      .limit(500)

    if (txError) {
      console.error('Erro ao buscar transações:', txError)
    }

    console.log('Transações encontradas:', transactions?.length || 0)

    erpContext.transactions = transactions || []

    // Buscar clientes
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .limit(50)

    erpContext.customers = customers || []

    // Buscar fornecedores
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .limit(50)

    erpContext.suppliers = suppliers || []

    // Buscar notas fiscais de saída
    const { data: invoices } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .eq('type', 'RECEIVABLE')
      .not('invoice_number', 'is', null)
      .order('due_date', { ascending: false })
      .limit(50)

    erpContext.invoices = invoices || []

    // Calcular resumo financeiro
    erpContext.financialSummary = {
      totalReceitas: erpContext.transactions
        .filter(t => t.type === 'RECEIVABLE')
        .reduce((sum, t) => sum + Number(t.net_amount || 0), 0),
      totalDespesas: erpContext.transactions
        .filter(t => t.type === 'PAYABLE')
        .reduce((sum, t) => sum + Number(t.net_amount || 0), 0),
      saldo: 0
    }
    erpContext.financialSummary.saldo = 
      erpContext.financialSummary.totalReceitas - erpContext.financialSummary.totalDespesas

    // Criar resumo da atividade recente
    erpContext.recentActivity = `Total: ${erpContext.transactions.length} transações, ${erpContext.customers.length} clientes cadastrados, ${erpContext.suppliers.length} fornecedores cadastrados.`

    console.log('ERP context loaded:', {
      transactions: erpContext.transactions.length,
      customers: erpContext.customers.length,
      suppliers: erpContext.suppliers.length
    })

    // Preparar prompt para IA com contexto real
    const systemPrompt = `Você é um assistente financeiro inteligente que ajuda o usuário a entender e gerenciar suas finanças empresariais.

DADOS DO ERP:

Resumo Financeiro Total:
- Total de Receitas: R$ ${erpContext.financialSummary.totalReceitas.toFixed(2)}
- Total de Despesas: R$ ${erpContext.financialSummary.totalDespesas.toFixed(2)}
- Saldo: R$ ${erpContext.financialSummary.saldo.toFixed(2)}

Atividade:
${erpContext.recentActivity}

Transações: ${erpContext.transactions.length} transações registradas
Clientes: ${erpContext.customers.length} clientes cadastrados
Fornecedores: ${erpContext.suppliers.length} fornecedores cadastrados
Notas Fiscais Emitidas: ${erpContext.invoices.length} NF-e

DETALHES DAS TRANSAÇÕES:
${JSON.stringify(erpContext.transactions.map(t => ({
  tipo: t.type === 'RECEIVABLE' ? 'Receita' : 'Despesa',
  descricao: t.description,
  valor_liquido: t.net_amount,
  data_vencimento: t.due_date
})), null, 2)}

INSTRUÇÕES:
1. Use APENAS os dados reais fornecidos acima para responder
2. Quando perguntado sobre meses específicos, filtre as transações pela data_vencimento (due_date) - formato YYYY-MM-DD
3. Forneça respostas precisas, diretas e baseadas em números reais
4. Calcule totais por mês somando receitas (tipo: 'Receita') e despesas (tipo: 'Despesa')
5. Seja profissional e objetivo
6. Formate valores monetários como R$ XX.XXX,XX
7. Use exemplos concretos dos dados quando relevante
8. Para análise de variação, SEMPRE use a ferramenta show_variance_analysis com:
   - Cálculos de variação percentual mês a mês
   - Identificação de anomalias quando a variação for maior que 20% (positiva ou negativa)
   - Insights explicando as variações
9. Para visualizações gráficas, use a ferramenta show_chart`

    // Chamar Lovable AI com tool calling para gráficos
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    console.log('Chamando Lovable AI...')
    const aiPayload: any = {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000
    }

    // Adicionar tools para retornar gráficos e análises
    aiPayload.tools = [
      {
        type: 'function',
        function: {
          name: 'show_chart',
          description: 'Exibe um gráfico para visualizar dados financeiros. Use quando o usuário pedir faturamento, receitas, despesas ou análises mensais/temporais.',
          parameters: {
            type: 'object',
            properties: {
              chartType: {
                type: 'string',
                enum: ['bar', 'line', 'area'],
                description: 'Tipo do gráfico'
              },
              title: {
                type: 'string',
                description: 'Título do gráfico'
              },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Nome da categoria (ex: mês)' },
                    value: { type: 'number', description: 'Valor numérico' },
                    label: { type: 'string', description: 'Label formatado (ex: R$ 100.000,00)' }
                  },
                  required: ['name', 'value'],
                  additionalProperties: false
                }
              },
              description: {
                type: 'string',
                description: 'Breve descrição/análise dos dados'
              }
            },
            required: ['chartType', 'title', 'data', 'description'],
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'show_variance_analysis',
          description: 'Exibe análise detalhada de variação mês a mês com identificação de discrepâncias. Use quando o usuário pedir análise de variação, comparação entre períodos ou identificação de anomalias.',
          parameters: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Título da análise'
              },
              periods: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    period: { type: 'string', description: 'Nome do período (ex: Jan/2025)' },
                    value: { type: 'number', description: 'Valor do período' },
                    variance: { type: 'number', description: 'Variação percentual em relação ao período anterior' },
                    isAnomaly: { type: 'boolean', description: 'Se true, indica discrepância significativa' },
                    insight: { type: 'string', description: 'Explicação sobre o período' }
                  },
                  required: ['period', 'value'],
                  additionalProperties: false
                }
              },
              summary: {
                type: 'string',
                description: 'Resumo executivo da análise'
              },
              recommendations: {
                type: 'array',
                items: { type: 'string' },
                description: 'Lista de recomendações baseadas na análise'
              }
            },
            required: ['title', 'periods', 'summary'],
            additionalProperties: false
          }
        }
      }
    ]

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiPayload)
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
    const choice = aiData.choices?.[0]
    
    // Verificar se a IA quer mostrar um gráfico ou análise
    if (choice?.message?.tool_calls?.length > 0) {
      const toolCall = choice.message.tool_calls[0]
      
      if (toolCall.function.name === 'show_chart') {
        const chartData = JSON.parse(toolCall.function.arguments)
        console.log('IA retornou dados para gráfico:', chartData)
        
        return new Response(JSON.stringify({ 
          type: 'chart',
          ...chartData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      if (toolCall.function.name === 'show_variance_analysis') {
        const analysisData = JSON.parse(toolCall.function.arguments)
        console.log('IA retornou análise de variação:', analysisData)
        
        return new Response(JSON.stringify({ 
          type: 'variance',
          ...analysisData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
    
    // Resposta de texto normal
    const aiMessage = choice?.message?.content || 'Não foi possível gerar uma resposta.'
    console.log('Resposta da IA gerada com sucesso')

    return new Response(JSON.stringify({ 
      type: 'text',
      response: aiMessage 
    }), {
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