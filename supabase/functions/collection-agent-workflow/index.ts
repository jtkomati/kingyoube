import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CollectionRequest {
  action: 'analyze' | 'generate_plan' | 'submit_campaign' | 'execute_campaign' | 'get_defaulters';
  customerId?: string;
  transactionIds?: string[];
  campaignType?: 'reminder' | 'formal' | 'negotiation' | 'legal';
  approvalId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      throw new Error('User has no associated company');
    }

    const companyId = profile.company_id;
    const body: CollectionRequest = await req.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case 'analyze':
        result = await analyzeDefaulters(supabase, companyId);
        break;

      case 'generate_plan':
        result = await generateCollectionPlan(supabase, companyId, body.customerId!, body.transactionIds!);
        break;

      case 'submit_campaign':
        result = await submitCampaignForApproval(supabase, companyId, user.id, body);
        break;

      case 'execute_campaign':
        result = await executeCampaign(supabase, companyId, body.approvalId!);
        break;

      case 'get_defaulters':
        result = await getDefaultersList(supabase, companyId);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await supabase.from('agent_execution_logs').insert({
      agent_id: 'collection',
      action_type: action,
      input_data: body,
      output_data: result,
      status: result.requiresApproval ? 'pending_approval' : 'success',
      duration_ms: Date.now() - startTime,
      company_id: companyId,
      user_id: user.id
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Collection agent error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function analyzeDefaulters(supabase: any, companyId: string) {
  const today = new Date();
  
  // Get all overdue receivables
  const { data: overdue } = await supabase
    .from('transactions')
    .select(`
      *,
      customers(id, company_name, first_name, last_name, email, phone)
    `)
    .eq('company_id', companyId)
    .eq('type', 'RECEIVABLE')
    .is('payment_date', null)
    .lt('due_date', today.toISOString().split('T')[0])
    .order('due_date', { ascending: true });

  if (!overdue?.length) {
    return {
      step: 'no_defaulters',
      message: 'Nenhum título em atraso. Parabéns!',
      totalDefaulters: 0,
      totalValue: 0
    };
  }

  // Classify by aging
  const aging = {
    '1-7': { count: 0, value: 0, transactions: [] as any[] },
    '8-30': { count: 0, value: 0, transactions: [] as any[] },
    '31-60': { count: 0, value: 0, transactions: [] as any[] },
    '61-90': { count: 0, value: 0, transactions: [] as any[] },
    '90+': { count: 0, value: 0, transactions: [] as any[] }
  };

  for (const tx of overdue) {
    const daysOverdue = Math.floor((today.getTime() - new Date(tx.due_date).getTime()) / (1000 * 60 * 60 * 24));
    let bucket: keyof typeof aging;

    if (daysOverdue <= 7) bucket = '1-7';
    else if (daysOverdue <= 30) bucket = '8-30';
    else if (daysOverdue <= 60) bucket = '31-60';
    else if (daysOverdue <= 90) bucket = '61-90';
    else bucket = '90+';

    aging[bucket].count++;
    aging[bucket].value += tx.net_amount || 0;
    aging[bucket].transactions.push({
      id: tx.id,
      customerId: tx.customer_id,
      customerName: tx.customers?.company_name || 
        `${tx.customers?.first_name || ''} ${tx.customers?.last_name || ''}`.trim(),
      customerEmail: tx.customers?.email,
      customerPhone: tx.customers?.phone,
      amount: tx.net_amount,
      dueDate: tx.due_date,
      daysOverdue,
      description: tx.description
    });
  }

  // Get customers with multiple overdue
  const customerMap = new Map();
  for (const tx of overdue) {
    const customerId = tx.customer_id;
    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customer: tx.customers,
        transactions: [],
        totalValue: 0
      });
    }
    customerMap.get(customerId).transactions.push(tx);
    customerMap.get(customerId).totalValue += tx.net_amount || 0;
  }

  const topDefaulters = Array.from(customerMap.entries())
    .map(([id, data]) => ({
      customerId: id,
      customerName: data.customer?.company_name || 
        `${data.customer?.first_name || ''} ${data.customer?.last_name || ''}`.trim(),
      transactionCount: data.transactions.length,
      totalValue: data.totalValue
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 10);

  const totalValue = overdue.reduce((sum: number, tx: any) => sum + (tx.net_amount || 0), 0);

  return {
    step: 'analyzed',
    message: `${overdue.length} títulos em atraso totalizando R$ ${totalValue.toLocaleString('pt-BR')}.`,
    totalDefaulters: overdue.length,
    totalValue,
    aging,
    topDefaulters,
    suggestedActions: [
      { bucket: '1-7', action: 'Enviar lembrete amigável por e-mail' },
      { bucket: '8-30', action: 'Enviar WhatsApp + proposta de negociação' },
      { bucket: '31-60', action: 'Ligação de cobrança + carta formal' },
      { bucket: '61-90', action: 'Último aviso antes de negativação' },
      { bucket: '90+', action: 'Considerar negativação ou cobrança judicial' }
    ]
  };
}

async function generateCollectionPlan(supabase: any, companyId: string, customerId: string, transactionIds: string[]) {
  // Get customer info
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  // Get transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .in('id', transactionIds);

  if (!transactions?.length) {
    throw new Error('Transações não encontradas');
  }

  // Get payment history for this customer
  const { data: history } = await supabase
    .from('transactions')
    .select('payment_date, due_date, net_amount')
    .eq('customer_id', customerId)
    .eq('type', 'RECEIVABLE')
    .not('payment_date', 'is', null)
    .order('payment_date', { ascending: false })
    .limit(20);

  // Analyze payment behavior
  let avgDaysLate = 0;
  if (history?.length) {
    const delays = history.map((h: any) => {
      const due = new Date(h.due_date);
      const paid = new Date(h.payment_date);
      return Math.max(0, (paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    });
    avgDaysLate = delays.reduce((a: number, b: number) => a + b, 0) / delays.length;
  }

  const totalValue = transactions.reduce((sum: number, tx: any) => sum + (tx.net_amount || 0), 0);
  const oldestOverdue = transactions.reduce((oldest: any, tx: any) => 
    new Date(tx.due_date) < new Date(oldest.due_date) ? tx : oldest
  );
  const daysOverdue = Math.floor((Date.now() - new Date(oldestOverdue.due_date).getTime()) / (1000 * 60 * 60 * 24));

  // Generate collection plan based on situation
  const plan: any[] = [];
  const today = new Date();

  // Immediate: Reminder email
  plan.push({
    step: 1,
    date: today.toISOString().split('T')[0],
    channel: 'email',
    type: 'reminder',
    subject: 'Lembrete de Pagamento',
    template: generateEmailTemplate('reminder', customer, totalValue, transactions)
  });

  // D+3: WhatsApp if available
  if (customer?.phone) {
    const d3 = new Date(today);
    d3.setDate(d3.getDate() + 3);
    plan.push({
      step: 2,
      date: d3.toISOString().split('T')[0],
      channel: 'whatsapp',
      type: 'reminder',
      message: generateWhatsAppMessage('reminder', customer, totalValue)
    });
  }

  // D+7: Formal notice
  const d7 = new Date(today);
  d7.setDate(d7.getDate() + 7);
  plan.push({
    step: 3,
    date: d7.toISOString().split('T')[0],
    channel: 'email',
    type: 'formal',
    subject: 'Aviso de Cobrança',
    template: generateEmailTemplate('formal', customer, totalValue, transactions)
  });

  // D+15: Negotiation offer
  const d15 = new Date(today);
  d15.setDate(d15.getDate() + 15);
  const installmentValue = totalValue / 3;
  plan.push({
    step: 4,
    date: d15.toISOString().split('T')[0],
    channel: 'email',
    type: 'negotiation',
    subject: 'Proposta de Negociação',
    template: generateEmailTemplate('negotiation', customer, totalValue, transactions, {
      installments: 3,
      installmentValue
    }),
    negotiationOptions: [
      { type: 'full', description: 'Pagamento integral com 5% de desconto', value: totalValue * 0.95 },
      { type: 'installment', description: 'Parcelamento em 3x sem juros', installments: 3, value: installmentValue },
      { type: 'installment', description: 'Parcelamento em 6x com juros', installments: 6, value: totalValue * 1.05 / 6 }
    ]
  });

  return {
    step: 'plan_generated',
    message: `Plano de cobrança gerado para ${customer?.company_name || customer?.first_name}.`,
    customer: {
      id: customer?.id,
      name: customer?.company_name || `${customer?.first_name} ${customer?.last_name}`,
      email: customer?.email,
      phone: customer?.phone
    },
    paymentBehavior: {
      avgDaysLate: Math.round(avgDaysLate),
      paymentsAnalyzed: history?.length || 0,
      riskLevel: avgDaysLate > 30 ? 'high' : avgDaysLate > 15 ? 'medium' : 'low'
    },
    overdue: {
      transactionCount: transactions.length,
      totalValue,
      daysOverdue
    },
    collectionPlan: plan
  };
}

async function submitCampaignForApproval(supabase: any, companyId: string, userId: string, body: CollectionRequest) {
  const { customerId, transactionIds, campaignType } = body;

  // Get customer and transaction info
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .in('id', transactionIds);

  const totalValue = transactions?.reduce((sum: number, tx: any) => sum + (tx.net_amount || 0), 0) || 0;

  // Check if auto-approve
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('agent_id', 'collection')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .single();

  const requiresApproval = campaignType === 'legal' || 
    campaignType === 'negotiation' ||
    totalValue > (rules?.approval_threshold || 5000);

  if (!requiresApproval && campaignType === 'reminder') {
    // Auto-execute reminder campaigns
    return await executeCampaignDirect(supabase, companyId, {
      customerId: customerId!,
      transactionIds: transactionIds!,
      campaignType: campaignType!,
      customer,
      transactions,
      totalValue
    });
  }

  const { data: approval } = await supabase
    .from('approval_queue')
    .insert({
      agent_id: 'collection',
      action_type: `execute_${campaignType}_campaign`,
      priority: campaignType === 'legal' ? 1 : totalValue > 10000 ? 2 : 4,
      request_data: {
        customerId,
        transactionIds,
        campaignType,
        customerName: customer?.company_name || `${customer?.first_name} ${customer?.last_name}`,
        totalValue
      },
      requested_by: userId,
      company_id: companyId
    })
    .select()
    .single();

  return {
    step: 'pending_approval',
    requiresApproval: true,
    message: `Campanha de cobrança ${campaignType} para R$ ${totalValue.toLocaleString('pt-BR')} enviada para aprovação.`,
    approvalId: approval?.id
  };
}

async function executeCampaign(supabase: any, companyId: string, approvalId: string) {
  const { data: approval } = await supabase
    .from('approval_queue')
    .select('request_data')
    .eq('id', approvalId)
    .single();

  if (!approval) {
    throw new Error('Approval not found');
  }

  const { customerId, transactionIds, campaignType } = approval.request_data;

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .in('id', transactionIds);

  const totalValue = transactions?.reduce((sum: number, tx: any) => sum + (tx.net_amount || 0), 0) || 0;

  return await executeCampaignDirect(supabase, companyId, {
    customerId,
    transactionIds,
    campaignType,
    customer,
    transactions,
    totalValue
  });
}

async function executeCampaignDirect(supabase: any, companyId: string, data: any) {
  const { customerId, transactionIds, campaignType, customer, transactions, totalValue } = data;

  const communications = [];

  // Create email communication
  if (customer?.email) {
    const emailContent = generateEmailTemplate(campaignType, customer, totalValue, transactions);
    const subjects: Record<string, string> = {
      'reminder': 'Lembrete de Pagamento',
      'formal': 'Aviso de Cobrança',
      'negotiation': 'Proposta de Negociação',
      'legal': 'Último Aviso - Medidas Judiciais'
    };

    const { data: comm } = await supabase
      .from('automated_communications')
      .insert({
        entity_type: 'COLLECTION',
        entity_id: transactionIds[0],
        channel: 'email',
        template_id: `collection_${campaignType}`,
        recipient_name: customer?.company_name || `${customer?.first_name} ${customer?.last_name}`,
        recipient_email: customer?.email,
        subject: subjects[campaignType] || 'Cobrança',
        content: emailContent,
        status: 'scheduled',
        scheduled_at: new Date().toISOString(),
        company_id: companyId
      })
      .select()
      .single();

    communications.push(comm);
  }

  // Create WhatsApp communication if phone available and type is reminder/formal
  if (customer?.phone && (campaignType === 'reminder' || campaignType === 'formal')) {
    const whatsappMessage = generateWhatsAppMessage(campaignType, customer, totalValue);

    const { data: comm } = await supabase
      .from('automated_communications')
      .insert({
        entity_type: 'COLLECTION',
        entity_id: transactionIds[0],
        channel: 'whatsapp',
        template_id: `collection_whatsapp_${campaignType}`,
        recipient_name: customer?.company_name || `${customer?.first_name} ${customer?.last_name}`,
        recipient_phone: customer?.phone,
        content: whatsappMessage,
        status: 'scheduled',
        scheduled_at: new Date().toISOString(),
        company_id: companyId
      })
      .select()
      .single();

    communications.push(comm);
  }

  return {
    step: 'campaign_executed',
    requiresApproval: false,
    message: `Campanha de cobrança ${campaignType} iniciada. ${communications.length} comunicação(ões) agendada(s).`,
    communications: communications.map(c => ({
      id: c.id,
      channel: c.channel,
      status: c.status,
      scheduledAt: c.scheduled_at
    }))
  };
}

async function getDefaultersList(supabase: any, companyId: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data: overdue } = await supabase
    .from('transactions')
    .select(`
      *,
      customers(id, company_name, first_name, last_name, email, phone)
    `)
    .eq('company_id', companyId)
    .eq('type', 'RECEIVABLE')
    .is('payment_date', null)
    .lt('due_date', today)
    .order('due_date', { ascending: true });

  const customers = new Map();
  for (const tx of (overdue || [])) {
    const id = tx.customer_id;
    if (!customers.has(id)) {
      customers.set(id, {
        customer: tx.customers,
        transactions: [],
        totalValue: 0,
        oldestDue: tx.due_date
      });
    }
    customers.get(id).transactions.push(tx);
    customers.get(id).totalValue += tx.net_amount || 0;
    if (tx.due_date < customers.get(id).oldestDue) {
      customers.get(id).oldestDue = tx.due_date;
    }
  }

  const defaulters = Array.from(customers.values()).map(d => ({
    customerId: d.customer?.id,
    customerName: d.customer?.company_name || `${d.customer?.first_name || ''} ${d.customer?.last_name || ''}`.trim(),
    email: d.customer?.email,
    phone: d.customer?.phone,
    transactionCount: d.transactions.length,
    totalValue: d.totalValue,
    oldestDueDate: d.oldestDue,
    daysOverdue: Math.floor((Date.now() - new Date(d.oldestDue).getTime()) / (1000 * 60 * 60 * 24))
  })).sort((a, b) => b.totalValue - a.totalValue);

  return {
    step: 'defaulters_list',
    message: `${defaulters.length} clientes inadimplentes.`,
    defaulters,
    totalValue: defaulters.reduce((sum, d) => sum + d.totalValue, 0)
  };
}

function generateEmailTemplate(type: string, customer: any, totalValue: number, transactions: any[], options?: any): string {
  const customerName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim();
  const valueFormatted = totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  switch (type) {
    case 'reminder':
      return `Prezado(a) ${customerName},

Identificamos que há pendências financeiras em seu cadastro no valor total de ${valueFormatted}.

Por gentileza, verifique os títulos em aberto e providencie a regularização o mais breve possível.

Caso já tenha efetuado o pagamento, por favor desconsidere este aviso.

Atenciosamente,
Departamento Financeiro`;

    case 'formal':
      return `Prezado(a) ${customerName},

AVISO DE COBRANÇA

Comunicamos que constam em nossos registros débitos pendentes em seu nome, totalizando ${valueFormatted}.

Solicitamos a regularização imediata para evitar a incidência de juros e multa, bem como possíveis medidas de cobrança.

Títulos em atraso:
${transactions?.map(t => `- ${t.description}: ${t.net_amount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (venc. ${new Date(t.due_date).toLocaleDateString('pt-BR')})`).join('\n')}

Aguardamos contato para regularização.

Departamento Financeiro`;

    case 'negotiation':
      return `Prezado(a) ${customerName},

PROPOSTA DE NEGOCIAÇÃO

Visando facilitar a regularização de sua situação financeira, oferecemos as seguintes opções de pagamento para o débito de ${valueFormatted}:

1. Pagamento à vista com 5% de desconto
2. Parcelamento em até 3x sem juros
3. Parcelamento em até 6x com pequeno acréscimo

Entre em contato conosco para formalizar a melhor opção para você.

Atenciosamente,
Departamento Financeiro`;

    case 'legal':
      return `Prezado(a) ${customerName},

ÚLTIMO AVISO ANTES DE MEDIDAS JUDICIAIS

Após diversas tentativas de contato sem sucesso, comunicamos que o débito de ${valueFormatted} será encaminhado para cobrança judicial caso não seja regularizado nos próximos 5 (cinco) dias úteis.

A inadimplência poderá resultar em:
- Protesto do título
- Negativação em órgãos de proteção ao crédito
- Ação judicial de cobrança com acréscimo de custas processuais e honorários advocatícios

Esta é sua última oportunidade de regularização amigável.

Departamento Jurídico`;

    default:
      return '';
  }
}

function generateWhatsAppMessage(type: string, customer: any, totalValue: number): string {
  const customerName = customer?.company_name || customer?.first_name || 'Cliente';
  const valueFormatted = totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  switch (type) {
    case 'reminder':
      return `Olá ${customerName}! 👋

Identificamos pendências financeiras em seu cadastro no valor de ${valueFormatted}.

Por favor, verifique seus títulos e providencie a regularização. Caso já tenha pago, desconsidere esta mensagem.

Precisa de ajuda? Responda esta mensagem! 💬`;

    case 'formal':
      return `Olá ${customerName},

⚠️ AVISO IMPORTANTE

Seu débito de ${valueFormatted} encontra-se em atraso.

Solicitamos regularização urgente para evitar cobranças adicionais.

Entre em contato para negociação.`;

    default:
      return '';
  }
}
