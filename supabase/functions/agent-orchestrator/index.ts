import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Agent Orchestrator - Gerente Financeiro
 * Orquestra múltiplos agentes/tools para resolver tarefas complexas
 */

// Definição das ferramentas disponíveis
const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "analyze_cashflow",
      description: "Projeta fluxo de caixa para um período específico",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Número de dias para projetar (7, 30, 90)" }
        },
        required: ["days"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "categorize_transaction",
      description: "Categoriza uma transação bancária baseada na descrição",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Descrição da transação" }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate_taxes",
      description: "Calcula impacto tributário sobre um valor",
      parameters: {
        type: "object",
        properties: {
          grossAmount: { type: "number", description: "Valor bruto em reais" },
          category: { type: "string", description: "Categoria do serviço/produto" },
          type: { type: "string", enum: ["service", "product"], description: "Tipo de operação" }
        },
        required: ["grossAmount", "category", "type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_documents",
      description: "Busca semântica em contratos, notas e documentos da empresa",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "O que buscar nos documentos" },
          sourceType: { type: "string", enum: ["CONTRACT", "INVOICE", "TRANSACTION", "NOTE"], description: "Tipo de documento (opcional)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_budget_variance",
      description: "Analisa variação entre orçamento planejado e realizado",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Período (ex: '2024-01', 'Q1-2024')" }
        },
        required: ["period"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_financial_summary",
      description: "Obtém resumo financeiro da empresa (receitas, despesas, saldo)",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Período (ex: 'last_30_days', 'this_month', 'this_year')" }
        },
        required: ["period"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_payables",
      description: "Lista contas a pagar pendentes",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "overdue", "all"], description: "Filtro de status" },
          limit: { type: "number", description: "Número máximo de resultados" }
        },
        required: ["status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_receivables",
      description: "Lista contas a receber",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "overdue", "all"], description: "Filtro de status" },
          limit: { type: "number", description: "Número máximo de resultados" }
        },
        required: ["status"]
      }
    }
  }
]

// Executor de ferramentas
async function executeTool(
  toolName: string, 
  args: Record<string, any>, 
  supabase: any,
  companyId: string,
  lovableApiKey: string
): Promise<string> {
  console.log(`Executando tool: ${toolName}`, args)
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!

  switch (toolName) {
    case 'analyze_cashflow': {
      const response = await fetch(`${supabaseUrl}/functions/v1/cash-flow-projection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days: args.days, companyId })
      })
      const data = await response.json()
      return JSON.stringify(data)
    }

    case 'categorize_transaction': {
      const response = await fetch(`${supabaseUrl}/functions/v1/categorize-transaction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: args.description })
      })
      const data = await response.json()
      return JSON.stringify(data)
    }

    case 'calculate_taxes': {
      const response = await fetch(`${supabaseUrl}/functions/v1/tax-impact-preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args)
      })
      const data = await response.json()
      return JSON.stringify(data)
    }

    case 'search_documents': {
      const response = await fetch(`${supabaseUrl}/functions/v1/rag-query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: args.query, 
          companyId,
          sourceType: args.sourceType 
        })
      })
      const data = await response.json()
      return data.answer || JSON.stringify(data)
    }

    case 'get_budget_variance': {
      const response = await fetch(`${supabaseUrl}/functions/v1/cfo-budget-variance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ period: args.period, companyId })
      })
      const data = await response.json()
      return JSON.stringify(data)
    }

    case 'get_financial_summary': {
      // Buscar transações diretamente
      const { data: transactions } = await supabase
        .from('transactions')
        .select('type, net_amount, due_date, payment_date')
        .eq('company_id', companyId)
        .order('due_date', { ascending: false })
        .limit(500)

      const receitas = transactions?.filter((t: any) => t.type === 'RECEIVABLE')
        .reduce((sum: number, t: any) => sum + Number(t.net_amount || 0), 0) || 0
      const despesas = transactions?.filter((t: any) => t.type === 'PAYABLE')
        .reduce((sum: number, t: any) => sum + Number(t.net_amount || 0), 0) || 0

      return JSON.stringify({
        totalReceitas: receitas,
        totalDespesas: despesas,
        saldo: receitas - despesas,
        totalTransacoes: transactions?.length || 0
      })
    }

    case 'list_payables': {
      let query = supabase
        .from('transactions')
        .select('id, description, net_amount, due_date, payment_date, supplier_id')
        .eq('company_id', companyId)
        .eq('type', 'PAYABLE')
        .order('due_date', { ascending: true })
        .limit(args.limit || 10)

      if (args.status === 'pending') {
        query = query.is('payment_date', null)
      } else if (args.status === 'overdue') {
        query = query.is('payment_date', null).lt('due_date', new Date().toISOString())
      }

      const { data } = await query
      return JSON.stringify(data || [])
    }

    case 'list_receivables': {
      let query = supabase
        .from('transactions')
        .select('id, description, net_amount, due_date, payment_date, customer_id')
        .eq('company_id', companyId)
        .eq('type', 'RECEIVABLE')
        .order('due_date', { ascending: true })
        .limit(args.limit || 10)

      if (args.status === 'pending') {
        query = query.is('payment_date', null)
      } else if (args.status === 'overdue') {
        query = query.is('payment_date', null).lt('due_date', new Date().toISOString())
      }

      const { data } = await query
      return JSON.stringify(data || [])
    }

    default:
      return `Ferramenta ${toolName} não implementada`
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { message, conversationHistory = [] } = await req.json()
    
    if (!message) {
      throw new Error('Mensagem obrigatória')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar company_id do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    const companyId = profile?.company_id
    if (!companyId) {
      throw new Error('Empresa não encontrada para o usuário')
    }

    console.log('Orquestrador iniciado para empresa:', companyId)

    // System prompt do Gerente Financeiro
    const systemPrompt = `Você é o Gerente Financeiro, um assistente de IA especializado que orquestra múltiplas ferramentas para resolver tarefas financeiras complexas.

CAPACIDADES:
- Projetar fluxo de caixa (analyze_cashflow)
- Categorizar transações (categorize_transaction)
- Calcular impostos (calculate_taxes)
- Buscar em documentos da empresa (search_documents)
- Analisar variação orçamentária (get_budget_variance)
- Obter resumo financeiro (get_financial_summary)
- Listar contas a pagar (list_payables)
- Listar contas a receber (list_receivables)

INSTRUÇÕES:
1. Analise a solicitação do usuário
2. Decida quais ferramentas usar e em qual ordem
3. Execute as ferramentas necessárias
4. Combine os resultados em uma resposta clara e útil
5. Responda sempre em português brasileiro
6. Formate valores monetários como R$ XX.XXX,XX
7. Seja proativo em sugerir insights relevantes

Você tem acesso às ferramentas para executar tarefas reais. Use-as!`

    // Construir histórico de mensagens
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ]

    // Chamada inicial com tool calling
    let response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        tools: AVAILABLE_TOOLS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro na chamada inicial:', errorText)
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`Erro Gemini: ${response.status}`)
    }

    let data = await response.json()
    let assistantMessage = data.choices?.[0]?.message

    // Loop de execução de ferramentas (máximo 5 iterações)
    let iterations = 0
    const maxIterations = 5
    const toolResults: { name: string; result: string }[] = []

    while (assistantMessage?.tool_calls && iterations < maxIterations) {
      iterations++
      console.log(`Iteração ${iterations}: ${assistantMessage.tool_calls.length} tool(s) a executar`)

      // Executar todas as ferramentas chamadas
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}')
        
        const result = await executeTool(toolName, toolArgs, supabase, companyId, lovableApiKey)
        toolResults.push({ name: toolName, result })
        
        // Adicionar resultado ao histórico
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [toolCall]
        })
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        })
      }

      // Nova chamada com resultados das ferramentas
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages,
          tools: AVAILABLE_TOOLS,
          tool_choice: 'auto',
          temperature: 0.3,
          max_tokens: 2000
        })
      })

      if (!response.ok) break

      data = await response.json()
      assistantMessage = data.choices?.[0]?.message
    }

    const finalResponse = assistantMessage?.content || 'Não foi possível processar sua solicitação.'

    console.log('Orquestrador concluído. Tools usadas:', toolResults.map(t => t.name))

    return new Response(
      JSON.stringify({
        message: finalResponse,
        toolsUsed: toolResults.map(t => t.name),
        type: 'orchestrated'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro agent-orchestrator:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
