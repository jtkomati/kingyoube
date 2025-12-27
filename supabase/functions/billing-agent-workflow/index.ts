import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BillingRequest {
  action: 'start' | 'prepare' | 'submit_for_approval' | 'execute_approved';
  customerId?: string;
  serviceDescription?: string;
  amount?: number;
  dueDate?: string;
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

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();
    
    if (!profile?.company_id) {
      throw new Error('User has no associated company');
    }

    const companyId = profile.company_id;
    const body: BillingRequest = await req.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case 'start':
        // Start billing workflow - gather minimal information
        result = await startBillingWorkflow(supabase, companyId, user.id);
        break;

      case 'prepare':
        // Prepare invoice with all data
        result = await prepareBillingData(supabase, companyId, body);
        break;

      case 'submit_for_approval':
        // Submit to Gerente Financeiro for approval
        result = await submitForApproval(supabase, companyId, user.id, body);
        break;

      case 'execute_approved':
        // Execute approved billing (issue NF + boleto)
        result = await executeApprovedBilling(supabase, companyId, body.approvalId!);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Log execution
    await supabase.from('agent_execution_logs').insert({
      agent_id: 'billing',
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
    console.error('Billing agent error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function startBillingWorkflow(supabase: any, companyId: string, userId: string) {
  // Get customers for selection
  const { data: customers } = await supabase
    .from('customers')
    .select('id, company_name, first_name, last_name, email, cnpj, cpf')
    .eq('company_id', companyId)
    .limit(50);

  // Get categories for service selection
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, description')
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .limit(50);

  // Get recent transactions for suggestions
  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('description, gross_amount, customer_id')
    .eq('company_id', companyId)
    .eq('type', 'RECEIVABLE')
    .order('created_at', { ascending: false })
    .limit(10);

  return {
    step: 'gather_info',
    message: 'Vamos faturar! Escolha o cliente e informe o serviço prestado.',
    customers: customers || [],
    categories: categories || [],
    suggestions: recentTransactions || [],
    questions: [
      { field: 'customerId', type: 'select', label: 'Cliente', required: true },
      { field: 'serviceDescription', type: 'text', label: 'Descrição do serviço', required: true },
      { field: 'amount', type: 'currency', label: 'Valor', required: true },
      { field: 'dueDate', type: 'date', label: 'Vencimento', required: true }
    ]
  };
}

async function prepareBillingData(supabase: any, companyId: string, body: BillingRequest) {
  const { customerId, serviceDescription, amount, dueDate } = body;

  // Get customer details
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (!customer) {
    throw new Error('Cliente não encontrado');
  }

  // Get company fiscal settings
  const { data: company } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', companyId)
    .single();

  // Calculate taxes based on regime
  const taxRates = calculateTaxRates(company?.tax_regime || 'SIMPLES', amount!);

  // Prepare invoice preview
  const invoicePreview = {
    customer: {
      name: customer.company_name || `${customer.first_name} ${customer.last_name}`,
      document: customer.cnpj || customer.cpf,
      email: customer.email
    },
    service: {
      description: serviceDescription,
      grossAmount: amount,
      taxes: taxRates,
      netAmount: amount! - Object.values(taxRates).reduce((a: number, b: any) => a + b, 0)
    },
    dueDate,
    issuer: {
      name: company?.company_name,
      cnpj: company?.cnpj,
      cityCode: company?.city_code
    }
  };

  return {
    step: 'preview',
    message: 'Confira os dados da nota fiscal antes de enviar para aprovação.',
    preview: invoicePreview,
    canAutoApprove: amount! < 1000 // Auto-approve below R$ 1.000
  };
}

async function submitForApproval(supabase: any, companyId: string, userId: string, body: BillingRequest) {
  const { customerId, serviceDescription, amount, dueDate } = body;

  // Check if can auto-approve
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('agent_id', 'billing')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .single();

  const autoApproveThreshold = rules?.auto_approve_below || 1000;
  const requiresApproval = amount! >= autoApproveThreshold;

  // Create transaction record (pending)
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      type: 'RECEIVABLE',
      description: serviceDescription,
      gross_amount: amount,
      net_amount: amount,
      discount_amount: 0,
      category_id: await getOrCreateCategory(supabase, companyId, 'Serviços'),
      customer_id: customerId,
      due_date: dueDate,
      invoice_status: 'pending',
      company_id: companyId,
      created_by: userId
    })
    .select()
    .single();

  if (txError) {
    throw new Error(`Erro ao criar transação: ${txError.message}`);
  }

  if (requiresApproval) {
    // Create approval queue entry
    const { data: approval } = await supabase
      .from('approval_queue')
      .insert({
        agent_id: 'billing',
        action_type: 'issue_invoice',
        priority: amount! > 10000 ? 2 : 5,
        request_data: {
          transactionId: transaction.id,
          customerId,
          serviceDescription,
          amount,
          dueDate
        },
        requested_by: userId,
        company_id: companyId
      })
      .select()
      .single();

    return {
      step: 'pending_approval',
      requiresApproval: true,
      message: `Faturamento de R$ ${amount?.toLocaleString('pt-BR')} enviado para aprovação do Gerente Financeiro.`,
      approvalId: approval?.id,
      transactionId: transaction.id
    };
  } else {
    // Auto-approve and execute
    return await executeApprovedBilling(supabase, companyId, null, transaction.id);
  }
}

async function executeApprovedBilling(supabase: any, companyId: string, approvalId: string | null, transactionId?: string) {
  let txId = transactionId;

  // If approval ID provided, get transaction from approval
  if (approvalId) {
    const { data: approval } = await supabase
      .from('approval_queue')
      .select('request_data')
      .eq('id', approvalId)
      .single();

    txId = approval?.request_data?.transactionId;
  }

  // Get transaction
  const { data: transaction } = await supabase
    .from('transactions')
    .select('*, customers(*)')
    .eq('id', txId)
    .single();

  if (!transaction) {
    throw new Error('Transação não encontrada');
  }

  // Get company settings for NFS-e
  const { data: company } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', companyId)
    .single();

  const { data: fiscalConfig } = await supabase
    .from('config_fiscal')
    .select('*')
    .eq('company_id', companyId)
    .single();

  let nfseResult = null;
  let boletoResult = null;

  // Issue NFS-e via PlugNotas (if configured)
  if (fiscalConfig?.plugnotas_token && fiscalConfig?.plugnotas_status === 'connected') {
    try {
      const nfseResponse = await supabase.functions.invoke('issue-nfse', {
        body: {
          transactionId: txId,
          customerId: transaction.customer_id,
          description: transaction.description,
          amount: transaction.gross_amount
        }
      });
      nfseResult = nfseResponse.data;
    } catch (e) {
      console.error('NFS-e error:', e);
    }
  }

  // Generate boleto (if bank account configured)
  const { data: bankAccount } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('bank_name', 'Bradesco')
    .single();

  if (bankAccount) {
    try {
      const boletoResponse = await supabase.functions.invoke('generate-cnab-bradesco', {
        body: {
          transactionId: txId
        }
      });
      boletoResult = boletoResponse.data;
    } catch (e) {
      console.error('Boleto error:', e);
    }
  }

  // Update transaction status
  await supabase
    .from('transactions')
    .update({
      invoice_status: nfseResult?.success ? 'issued' : 'pending',
      invoice_number: nfseResult?.invoiceNumber,
      invoice_key: nfseResult?.invoiceKey,
      updated_at: new Date().toISOString()
    })
    .eq('id', txId);

  // Schedule communication to customer
  if (transaction.customers?.email) {
    await supabase.from('automated_communications').insert({
      entity_type: 'INVOICE',
      entity_id: txId,
      channel: 'email',
      recipient_name: transaction.customers.company_name || 
        `${transaction.customers.first_name} ${transaction.customers.last_name}`,
      recipient_email: transaction.customers.email,
      subject: `Nota Fiscal - ${company?.company_name}`,
      content: `Prezado(a) cliente,\n\nSegue em anexo a Nota Fiscal de Serviços referente a: ${transaction.description}\n\nValor: R$ ${transaction.gross_amount?.toLocaleString('pt-BR')}\nVencimento: ${transaction.due_date}\n\nAtenciosamente,\n${company?.company_name}`,
      status: 'scheduled',
      scheduled_at: new Date().toISOString(),
      company_id: companyId
    });
  }

  return {
    step: 'completed',
    requiresApproval: false,
    message: `Faturamento concluído! ${nfseResult?.success ? 'NFS-e emitida.' : ''} ${boletoResult?.success ? 'Boleto gerado.' : ''} E-mail agendado para o cliente.`,
    transactionId: txId,
    nfse: nfseResult,
    boleto: boletoResult
  };
}

function calculateTaxRates(taxRegime: string, amount: number) {
  if (taxRegime === 'SIMPLES') {
    return {
      iss: amount * 0.02, // 2% ISS
      simples: amount * 0.06 // ~6% Simples Nacional
    };
  } else if (taxRegime === 'LUCRO_PRESUMIDO') {
    return {
      iss: amount * 0.05,
      pis: amount * 0.0065,
      cofins: amount * 0.03,
      irpj: amount * 0.048,
      csll: amount * 0.0288
    };
  } else {
    return {
      iss: amount * 0.05,
      pis: amount * 0.0165,
      cofins: amount * 0.076
    };
  }
}

async function getOrCreateCategory(supabase: any, companyId: string, name: string) {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('name', name)
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .single();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from('categories')
    .insert({ name, company_id: companyId })
    .select('id')
    .single();

  return created?.id;
}
