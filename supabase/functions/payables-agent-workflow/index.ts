import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayablesRequest {
  action: 'capture_invoice' | 'validate' | 'submit_payment' | 'execute_payment' | 'get_status' | 'schedule_payments';
  invoiceData?: {
    supplierCnpj?: string;
    supplierName?: string;
    invoiceNumber?: string;
    amount?: number;
    dueDate?: string;
    description?: string;
    fileUrl?: string;
  };
  transactionId?: string;
  approvalId?: string;
  paymentIds?: string[];
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
    const body: PayablesRequest = await req.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case 'capture_invoice':
        result = await captureInvoice(supabase, companyId, user.id, body.invoiceData!);
        break;

      case 'validate':
        result = await validatePayable(supabase, companyId, body.transactionId!);
        break;

      case 'submit_payment':
        result = await submitPaymentForApproval(supabase, companyId, user.id, body.paymentIds!);
        break;

      case 'execute_payment':
        result = await executePayment(supabase, companyId, body.approvalId!);
        break;

      case 'get_status':
        result = await getPayablesStatus(supabase, companyId);
        break;

      case 'schedule_payments':
        result = await schedulePayments(supabase, companyId);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await supabase.from('agent_execution_logs').insert({
      agent_id: 'payables',
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
    console.error('Payables agent error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function captureInvoice(supabase: any, companyId: string, userId: string, invoiceData: any) {
  const { supplierCnpj, supplierName, invoiceNumber, amount, dueDate, description, fileUrl } = invoiceData;

  // Validate supplier CNPJ
  let supplierInfo = null;
  if (supplierCnpj) {
    try {
      const cnpjResponse = await supabase.functions.invoke('cnpj-lookup', {
        body: { cnpj: supplierCnpj }
      });
      supplierInfo = cnpjResponse.data;
    } catch (e) {
      console.log('CNPJ lookup failed:', e);
    }
  }

  // Check if supplier exists
  let supplier = null;
  if (supplierCnpj) {
    const { data: existingSupplier } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .eq('cnpj', supplierCnpj.replace(/\D/g, ''))
      .single();

    if (existingSupplier) {
      supplier = existingSupplier;
    } else {
      // Create new supplier
      const { data: newSupplier } = await supabase
        .from('suppliers')
        .insert({
          company_id: companyId,
          person_type: 'LEGAL',
          company_name: supplierInfo?.razao_social || supplierName,
          cnpj: supplierCnpj.replace(/\D/g, ''),
          address: supplierInfo?.endereco ? 
            `${supplierInfo.endereco.logradouro}, ${supplierInfo.endereco.numero} - ${supplierInfo.endereco.bairro}, ${supplierInfo.endereco.municipio}/${supplierInfo.endereco.uf}` : null,
          created_by: userId
        })
        .select()
        .single();
      
      supplier = newSupplier;
    }
  }

  // Check for duplicate invoice
  const { data: existingInvoice } = await supabase
    .from('transactions')
    .select('id')
    .eq('company_id', companyId)
    .eq('type', 'PAYABLE')
    .eq('invoice_number', invoiceNumber)
    .eq('supplier_id', supplier?.id)
    .single();

  if (existingInvoice) {
    return {
      step: 'duplicate',
      message: `Nota fiscal ${invoiceNumber} já está cadastrada.`,
      existingTransactionId: existingInvoice.id,
      isDuplicate: true
    };
  }

  // Calculate tax withholdings based on service type
  const taxRates = calculatePayableTaxes(amount, description);

  // Get or create category
  const categoryId = await getOrCreateCategory(supabase, companyId, 'Despesas Operacionais');

  // Create transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      type: 'PAYABLE',
      description: description || `NF ${invoiceNumber} - ${supplierName || supplier?.company_name}`,
      gross_amount: amount,
      discount_amount: 0,
      net_amount: amount - Object.values(taxRates).reduce((a: number, b: any) => a + b, 0),
      category_id: categoryId,
      supplier_id: supplier?.id,
      due_date: dueDate,
      invoice_number: invoiceNumber,
      invoice_status: 'pending',
      iss_rate: taxRates.iss || 0,
      pis_rate: taxRates.pis || 0,
      cofins_rate: taxRates.cofins || 0,
      irpj_rate: taxRates.irrf || 0,
      csll_rate: taxRates.csll || 0,
      company_id: companyId,
      created_by: userId
    })
    .select()
    .single();

  if (txError) {
    throw new Error(`Erro ao criar conta a pagar: ${txError.message}`);
  }

  // If there's a file, create incoming invoice record
  if (fileUrl) {
    await supabase.from('incoming_invoices').insert({
      supplier_name: supplierName || supplier?.company_name,
      supplier_cnpj: supplierCnpj,
      invoice_number: invoiceNumber,
      gross_amount: amount,
      net_amount: amount - Object.values(taxRates).reduce((a: number, b: any) => a + b, 0),
      irrf_amount: taxRates.irrf || 0,
      pis_amount: taxRates.pis || 0,
      cofins_amount: taxRates.cofins || 0,
      csll_amount: taxRates.csll || 0,
      iss_amount: taxRates.iss || 0,
      file_name: fileUrl.split('/').pop(),
      file_url: fileUrl,
      file_type: 'application/pdf',
      processing_status: 'completed',
      company_id: companyId,
      created_by: userId
    });
  }

  return {
    step: 'captured',
    message: `Conta a pagar cadastrada: R$ ${amount.toLocaleString('pt-BR')} vencendo em ${new Date(dueDate).toLocaleDateString('pt-BR')}.`,
    transactionId: transaction.id,
    supplier: supplier ? {
      id: supplier.id,
      name: supplier.company_name,
      isNew: !supplierCnpj || !existingInvoice
    } : null,
    taxWithholdings: taxRates,
    netAmount: amount - Object.values(taxRates).reduce((a: number, b: any) => a + b, 0)
  };
}

async function validatePayable(supabase: any, companyId: string, transactionId: string) {
  const { data: transaction } = await supabase
    .from('transactions')
    .select('*, suppliers(*)')
    .eq('id', transactionId)
    .single();

  if (!transaction) {
    throw new Error('Transação não encontrada');
  }

  const validations = [];
  let isValid = true;

  // Check supplier exists
  if (!transaction.supplier_id) {
    validations.push({ field: 'supplier', status: 'warning', message: 'Fornecedor não vinculado' });
  } else {
    validations.push({ field: 'supplier', status: 'ok', message: `Fornecedor: ${transaction.suppliers?.company_name}` });
  }

  // Check invoice number
  if (!transaction.invoice_number) {
    validations.push({ field: 'invoice_number', status: 'warning', message: 'Número da NF não informado' });
  } else {
    validations.push({ field: 'invoice_number', status: 'ok', message: `NF: ${transaction.invoice_number}` });
  }

  // Check due date
  const today = new Date();
  const dueDate = new Date(transaction.due_date);
  if (dueDate < today) {
    validations.push({ field: 'due_date', status: 'error', message: `Vencida há ${Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))} dias` });
    isValid = false;
  } else {
    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    validations.push({ field: 'due_date', status: daysUntilDue <= 3 ? 'warning' : 'ok', message: `Vence em ${daysUntilDue} dias` });
  }

  // Check cash flow impact
  const { data: cashFlowData } = await supabase.functions.invoke('cash-flow-projection', {
    body: { companyId, days: 30 }
  });

  let cashFlowImpact = 'unknown';
  if (cashFlowData) {
    const projectedBalance = cashFlowData.projectedBalance || 0;
    if (projectedBalance - transaction.net_amount < 0) {
      validations.push({ field: 'cash_flow', status: 'error', message: 'Pagamento pode causar saldo negativo' });
      cashFlowImpact = 'negative';
      isValid = false;
    } else if (projectedBalance - transaction.net_amount < transaction.net_amount) {
      validations.push({ field: 'cash_flow', status: 'warning', message: 'Saldo ficará apertado após pagamento' });
      cashFlowImpact = 'tight';
    } else {
      validations.push({ field: 'cash_flow', status: 'ok', message: 'Fluxo de caixa comporta o pagamento' });
      cashFlowImpact = 'ok';
    }
  }

  return {
    step: 'validated',
    message: isValid ? 'Pagamento validado e pronto para agendar.' : 'Atenção: há pendências a resolver.',
    isValid,
    validations,
    cashFlowImpact,
    transaction: {
      id: transaction.id,
      description: transaction.description,
      amount: transaction.net_amount,
      dueDate: transaction.due_date,
      supplier: transaction.suppliers?.company_name
    }
  };
}

async function submitPaymentForApproval(supabase: any, companyId: string, userId: string, paymentIds: string[]) {
  // Get transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, suppliers(*)')
    .in('id', paymentIds);

  if (!transactions?.length) {
    throw new Error('Transações não encontradas');
  }

  const totalValue = transactions.reduce((sum: number, tx: any) => sum + (tx.net_amount || 0), 0);

  // Check automation rules
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('agent_id', 'payables')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .single();

  const autoApproveThreshold = rules?.auto_approve_below || 1000;
  const hasNewSupplier = transactions.some((tx: any) => {
    // Check if supplier was created recently (last 7 days)
    if (!tx.suppliers) return false;
    const createdAt = new Date(tx.suppliers.created_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return createdAt > sevenDaysAgo;
  });

  const requiresApproval = totalValue >= autoApproveThreshold || hasNewSupplier;

  if (!requiresApproval) {
    return await executePaymentDirect(supabase, companyId, paymentIds);
  }

  const { data: approval } = await supabase
    .from('approval_queue')
    .insert({
      agent_id: 'payables',
      action_type: 'approve_payment',
      priority: totalValue > 50000 ? 1 : totalValue > 10000 ? 2 : 4,
      request_data: {
        paymentIds,
        payments: transactions.map((tx: any) => ({
          id: tx.id,
          description: tx.description,
          amount: tx.net_amount,
          dueDate: tx.due_date,
          supplier: tx.suppliers?.company_name,
          invoiceNumber: tx.invoice_number
        })),
        totalValue,
        hasNewSupplier
      },
      requested_by: userId,
      company_id: companyId
    })
    .select()
    .single();

  return {
    step: 'pending_approval',
    requiresApproval: true,
    message: `Pagamento de R$ ${totalValue.toLocaleString('pt-BR')} enviado para aprovação.${hasNewSupplier ? ' (Inclui fornecedor novo)' : ''}`,
    approvalId: approval?.id,
    totalValue,
    paymentCount: paymentIds.length
  };
}

async function executePayment(supabase: any, companyId: string, approvalId: string) {
  const { data: approval } = await supabase
    .from('approval_queue')
    .select('request_data')
    .eq('id', approvalId)
    .single();

  if (!approval) {
    throw new Error('Approval not found');
  }

  return await executePaymentDirect(supabase, companyId, approval.request_data.paymentIds);
}

async function executePaymentDirect(supabase: any, companyId: string, paymentIds: string[]) {
  const today = new Date().toISOString().split('T')[0];
  let successCount = 0;

  for (const id of paymentIds) {
    const { error } = await supabase
      .from('transactions')
      .update({
        payment_date: today,
        invoice_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (!error) {
      successCount++;
    }
  }

  // TODO: Integrate with bank API for actual payment execution
  // For now, we just mark as paid

  return {
    step: 'executed',
    requiresApproval: false,
    message: `${successCount} pagamento(s) processado(s) com sucesso.`,
    successCount,
    totalCount: paymentIds.length
  };
}

async function getPayablesStatus(supabase: any, companyId: string) {
  const today = new Date().toISOString().split('T')[0];

  // Get pending payables
  const { data: pending, count: pendingCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .eq('type', 'PAYABLE')
    .is('payment_date', null);

  // Get overdue payables
  const { data: overdue, count: overdueCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .eq('type', 'PAYABLE')
    .is('payment_date', null)
    .lt('due_date', today);

  // Get due this week
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const { data: dueThisWeek, count: dueThisWeekCount } = await supabase
    .from('transactions')
    .select('*, suppliers(company_name)', { count: 'exact' })
    .eq('company_id', companyId)
    .eq('type', 'PAYABLE')
    .is('payment_date', null)
    .gte('due_date', today)
    .lte('due_date', weekFromNow.toISOString().split('T')[0])
    .order('due_date', { ascending: true });

  const totalPending = pending?.reduce((sum: number, t: any) => sum + (t.net_amount || 0), 0) || 0;
  const totalOverdue = overdue?.reduce((sum: number, t: any) => sum + (t.net_amount || 0), 0) || 0;
  const totalDueThisWeek = dueThisWeek?.reduce((sum: number, t: any) => sum + (t.net_amount || 0), 0) || 0;

  return {
    step: 'status',
    message: `${pendingCount} contas a pagar (${overdueCount} vencidas). R$ ${totalDueThisWeek.toLocaleString('pt-BR')} vencem esta semana.`,
    pendingCount: pendingCount || 0,
    pendingValue: totalPending,
    overdueCount: overdueCount || 0,
    overdueValue: totalOverdue,
    dueThisWeekCount: dueThisWeekCount || 0,
    dueThisWeekValue: totalDueThisWeek,
    dueThisWeek: dueThisWeek?.map((t: any) => ({
      id: t.id,
      description: t.description,
      amount: t.net_amount,
      dueDate: t.due_date,
      supplier: t.suppliers?.company_name
    })) || []
  };
}

async function schedulePayments(supabase: any, companyId: string) {
  const today = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  // Get payables due in next 7 days
  const { data: dueSoon } = await supabase
    .from('transactions')
    .select('*, suppliers(*)')
    .eq('company_id', companyId)
    .eq('type', 'PAYABLE')
    .is('payment_date', null)
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', weekFromNow.toISOString().split('T')[0])
    .order('due_date', { ascending: true });

  if (!dueSoon?.length) {
    return {
      step: 'no_payments',
      message: 'Nenhum pagamento para os próximos 7 dias.',
      scheduledPayments: []
    };
  }

  // Group by due date
  const byDate = new Map<string, any[]>();
  for (const tx of dueSoon) {
    const date = tx.due_date;
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(tx);
  }

  const schedule = Array.from(byDate.entries()).map(([date, payments]) => ({
    date,
    dayOfWeek: new Date(date).toLocaleDateString('pt-BR', { weekday: 'long' }),
    paymentCount: payments.length,
    totalValue: payments.reduce((sum: number, p: any) => sum + (p.net_amount || 0), 0),
    payments: payments.map((p: any) => ({
      id: p.id,
      description: p.description,
      amount: p.net_amount,
      supplier: p.suppliers?.company_name
    }))
  }));

  return {
    step: 'schedule',
    message: `${dueSoon.length} pagamentos agendados para os próximos 7 dias.`,
    totalValue: dueSoon.reduce((sum: number, t: any) => sum + (t.net_amount || 0), 0),
    schedule
  };
}

function calculatePayableTaxes(amount: number, description?: string) {
  // Simplified tax calculation - in production, this would be based on service codes
  const isService = description?.toLowerCase().includes('serviço') || 
                   description?.toLowerCase().includes('consultoria') ||
                   description?.toLowerCase().includes('assessoria');

  if (isService && amount > 215.05) { // Minimum for withholding
    return {
      irrf: amount * 0.015, // 1.5% IRRF
      pis: amount * 0.0065, // 0.65% PIS
      cofins: amount * 0.03, // 3% COFINS
      csll: amount * 0.01, // 1% CSLL
      iss: 0 // ISS is usually paid by the provider
    };
  }

  return {
    irrf: 0,
    pis: 0,
    cofins: 0,
    csll: 0,
    iss: 0
  };
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
