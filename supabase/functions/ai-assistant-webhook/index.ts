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

    // Chamar API externa com bypass Cloudflare
    const cfAccessClientId = Deno.env.get('CF_ACCESS_CLIENT_ID')
    const cfAccessClientSecret = Deno.env.get('CF_ACCESS_CLIENT_SECRET')
    
    if (!cfAccessClientId || !cfAccessClientSecret) {
      throw new Error('Credenciais Cloudflare não configuradas')
    }

    const externalEndpoint = 'https://automacao-nova.secureblueteam.com.br/webhook/IaCFOAgent'

    console.log('Chamando endpoint externo de IA...')
    
    // Preparar payload para o endpoint externo
    const aiPayload = {
      message: message,
      systemPrompt: systemPrompt,
      context: {
        userId: user.id,
        userEmail: user.email,
        companyId: companyId,
        erpData: {
          transactions: erpContext.transactions,
          customers: erpContext.customers,
          suppliers: erpContext.suppliers,
          invoices: erpContext.invoices,
          financialSummary: erpContext.financialSummary,
          recentActivity: erpContext.recentActivity
        }
      },
      tools: [
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
    }

    const aiResponse = await fetch(externalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Access-Client-Id': cfAccessClientId,
        'CF-Access-Client-Secret': cfAccessClientSecret,
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
    
    // === LOGS DETALHADOS PARA DEBUG ===
    console.log('=== RESPOSTA DO ENDPOINT EXTERNO ===')
    console.log('Tipo da resposta:', typeof aiData)
    console.log('Resposta bruta (JSON):', JSON.stringify(aiData, null, 2))
    console.log('Chaves do objeto:', Object.keys(aiData || {}))
    
    // Log de estruturas específicas para identificar o formato
    if (aiData.choices) console.log('Formato OpenAI detectado - choices:', JSON.stringify(aiData.choices))
    if (aiData.response) console.log('Formato direto detectado - response:', typeof aiData.response === 'string' ? aiData.response.substring(0, 200) : JSON.stringify(aiData.response))
    if (aiData.output) console.log('Formato n8n/Make detectado - output:', typeof aiData.output === 'string' ? aiData.output.substring(0, 200) : JSON.stringify(aiData.output))
    if (aiData.message) console.log('Formato message detectado:', typeof aiData.message === 'string' ? aiData.message.substring(0, 200) : JSON.stringify(aiData.message))
    if (aiData.text) console.log('Formato text detectado:', typeof aiData.text === 'string' ? aiData.text.substring(0, 200) : JSON.stringify(aiData.text))
    if (aiData.content) console.log('Formato content detectado:', typeof aiData.content === 'string' ? aiData.content.substring(0, 200) : JSON.stringify(aiData.content))
    if (aiData.result) console.log('Formato result detectado:', typeof aiData.result === 'string' ? aiData.result.substring(0, 200) : JSON.stringify(aiData.result))
    if (aiData.data) console.log('Formato data detectado:', typeof aiData.data === 'string' ? aiData.data.substring(0, 200) : JSON.stringify(aiData.data))
    console.log('=== FIM DOS LOGS DE DEBUG ===')
    
    // === PARSING FLEXÍVEL ===
    // Tentar formato OpenAI primeiro
    const choice = aiData.choices?.[0]
    
    // Verificar tool_calls em múltiplos formatos
    const toolCalls = 
      choice?.message?.tool_calls ||           // OpenAI padrão
      aiData.tool_calls ||                     // Formato direto
      aiData.tools ||                          // Alternativo
      aiData.function_calls ||                 // Outro formato
      null
    
    console.log('Tool calls detectados:', toolCalls ? JSON.stringify(toolCalls) : 'Nenhum')
    
    if (toolCalls?.length > 0) {
      const toolCall = toolCalls[0]
      const functionName = toolCall.function?.name || toolCall.name
      const functionArgs = toolCall.function?.arguments || toolCall.arguments
      
      console.log('Executando tool:', functionName)
      console.log('Argumentos:', functionArgs)
      
      if (functionName === 'show_chart') {
        const chartData = typeof functionArgs === 'string' ? JSON.parse(functionArgs) : functionArgs
        console.log('IA retornou dados para gráfico:', chartData)
        
        return new Response(JSON.stringify({ 
          type: 'chart',
          ...chartData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      if (functionName === 'show_variance_analysis') {
        const analysisData = typeof functionArgs === 'string' ? JSON.parse(functionArgs) : functionArgs
        console.log('IA retornou análise de variação:', analysisData)
        
        return new Response(JSON.stringify({ 
          type: 'variance',
          ...analysisData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
    
    // === EXTRAÇÃO DE MENSAGEM COM MÚLTIPLOS FORMATOS ===
    let aiMessage: string | null = null
    
    // 1. Formato OpenAI padrão
    if (!aiMessage && choice?.message?.content) {
      aiMessage = choice.message.content
      console.log('Mensagem extraída de: choice.message.content')
    }
    
    // 2. Formato resposta direta (string)
    if (!aiMessage && typeof aiData.response === 'string') {
      aiMessage = aiData.response
      console.log('Mensagem extraída de: aiData.response (string)')
    }
    
    // 3. Formato resposta objeto com texto
    if (!aiMessage && typeof aiData.response === 'object' && aiData.response?.text) {
      aiMessage = aiData.response.text
      console.log('Mensagem extraída de: aiData.response.text')
    }
    
    // 4. Formato output (n8n/Make/webhook comum)
    if (!aiMessage && aiData.output) {
      aiMessage = typeof aiData.output === 'string' ? aiData.output : JSON.stringify(aiData.output)
      console.log('Mensagem extraída de: aiData.output')
    }
    
    // 5. Formato message direto
    if (!aiMessage && typeof aiData.message === 'string') {
      aiMessage = aiData.message
      console.log('Mensagem extraída de: aiData.message')
    }
    
    // 6. Formato text direto
    if (!aiMessage && typeof aiData.text === 'string') {
      aiMessage = aiData.text
      console.log('Mensagem extraída de: aiData.text')
    }
    
    // 7. Formato content direto
    if (!aiMessage && typeof aiData.content === 'string') {
      aiMessage = aiData.content
      console.log('Mensagem extraída de: aiData.content')
    }
    
    // 8. Formato result
    if (!aiMessage && aiData.result) {
      aiMessage = typeof aiData.result === 'string' ? aiData.result : JSON.stringify(aiData.result)
      console.log('Mensagem extraída de: aiData.result')
    }
    
    // 9. Formato data com texto
    if (!aiMessage && aiData.data) {
      if (typeof aiData.data === 'string') {
        aiMessage = aiData.data
      } else if (aiData.data.text) {
        aiMessage = aiData.data.text
      } else if (aiData.data.message) {
        aiMessage = aiData.data.message
      } else if (aiData.data.response) {
        aiMessage = aiData.data.response
      }
      if (aiMessage) console.log('Mensagem extraída de: aiData.data')
    }
    
    // 10. Se aiData for uma string direta
    if (!aiMessage && typeof aiData === 'string') {
      aiMessage = aiData
      console.log('Mensagem extraída de: aiData (string direta)')
    }
    
    // Fallback final
    if (!aiMessage) {
      console.error('Não foi possível extrair mensagem. Estrutura completa:', JSON.stringify(aiData))
      aiMessage = 'Não foi possível processar a resposta da IA. Verifique os logs para mais detalhes.'
    }
    
    console.log('Resposta final extraída:', aiMessage.substring(0, 200) + '...')
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