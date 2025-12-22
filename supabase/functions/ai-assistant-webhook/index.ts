import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate Limiter em memória
interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 15,     // 15 requisições por minuto
};

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Limpar entradas antigas periodicamente
  if (rateLimitStore.size > 500) {
    for (const [key, e] of rateLimitStore.entries()) {
      if (now - e.firstRequest > RATE_LIMIT_CONFIG.windowMs) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!entry) {
    rateLimitStore.set(identifier, { count: 1, firstRequest: now });
    return false;
  }

  if (now - entry.firstRequest > RATE_LIMIT_CONFIG.windowMs) {
    rateLimitStore.set(identifier, { count: 1, firstRequest: now });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_CONFIG.maxRequests;
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
    // Rate limiting por IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    if (isRateLimited(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({
          error: 'Limite de requisições excedido',
          message: 'Por favor, aguarde um momento antes de enviar outra mensagem.',
          retryAfter: 60,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
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

    // Rate limiting adicional por usuário (mais restritivo)
    if (isRateLimited(`user:${user.id}`)) {
      console.warn(`Rate limit exceeded for user: ${user.id}`);
      return new Response(
        JSON.stringify({
          error: 'Limite de requisições excedido',
          message: 'Você está enviando muitas mensagens. Aguarde um momento.',
          retryAfter: 60,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
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

    // Buscar transações da empresa
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
    const systemPrompt = `Você é um assistente financeiro inteligente chamado KingYouBe CFO que ajuda o usuário a entender e gerenciar suas finanças empresariais.

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

DETALHES DAS TRANSAÇÕES (últimas 100):
${JSON.stringify(erpContext.transactions.slice(0, 100).map(t => ({
  tipo: t.type === 'RECEIVABLE' ? 'Receita' : 'Despesa',
  descricao: t.description,
  valor_liquido: t.net_amount,
  data_vencimento: t.due_date,
  data_pagamento: t.payment_date
})), null, 2)}

INSTRUÇÕES:
1. Use APENAS os dados reais fornecidos acima para responder
2. Quando perguntado sobre meses específicos, filtre as transações pela data_vencimento (due_date) - formato YYYY-MM-DD
3. Forneça respostas precisas, diretas e baseadas em números reais
4. Calcule totais por mês somando receitas (tipo: 'Receita') e despesas (tipo: 'Despesa')
5. Seja profissional e objetivo
6. Formate valores monetários como R$ XX.XXX,XX
7. Use exemplos concretos dos dados quando relevante
8. Responda sempre em português brasileiro`

    // Chamar Lovable AI Gateway
    console.log('Chamando Lovable AI Gateway...')
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

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
        max_tokens: 2000
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
            error: 'Limite de uso da IA excedido',
            message: 'Desculpe, o serviço de IA está temporariamente indisponível devido ao alto volume de requisições. Tente novamente em alguns instantes.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        )
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Créditos da IA esgotados',
            message: 'Os créditos de IA foram esgotados. Entre em contato com o administrador.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        )
      }

      throw new Error(`Erro na IA: ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    
    console.log('Resposta da IA recebida:', JSON.stringify(aiData).substring(0, 500))
    
    // Extrair mensagem da resposta
    const aiMessage = aiData.choices?.[0]?.message?.content || 'Não foi possível processar sua solicitação.'

    console.log('Mensagem processada com sucesso')

    return new Response(JSON.stringify({ 
      message: aiMessage,
      type: 'text'
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
