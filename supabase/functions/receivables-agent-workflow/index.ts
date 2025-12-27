import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReceivablesRequest {
  action: 'sync' | 'reconcile' | 'submit_reconciliation' | 'execute_reconciliation' | 'get_status';
  bankAccountId?: string;
  reconciliations?: Array<{
    statementId: string;
    transactionId: string;
    confidence: number;
  }>;
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
    const body: ReceivablesRequest = await req.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case 'sync':
        result = await syncBankStatements(supabase, companyId, body.bankAccountId);
        break;

      case 'reconcile':
        result = await autoReconcile(supabase, companyId);
        break;

      case 'submit_reconciliation':
        result = await submitReconciliationForApproval(supabase, companyId, user.id, body.reconciliations!);
        break;

      case 'execute_reconciliation':
        result = await executeReconciliation(supabase, companyId, body.approvalId!);
        break;

      case 'get_status':
        result = await getReceivablesStatus(supabase, companyId);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await supabase.from('agent_execution_logs').insert({
      agent_id: 'receivables',
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
    console.error('Receivables agent error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function syncBankStatements(supabase: any, companyId: string, bankAccountId?: string) {
  // Get bank accounts with TecnoSpeed integration
  const query = supabase
    .from('bank_accounts')
    .select('*')
    .eq('company_id', companyId)
    .not('account_hash', 'is', null);

  if (bankAccountId) {
    query.eq('id', bankAccountId);
  }

  const { data: bankAccounts } = await query;

  if (!bankAccounts?.length) {
    return {
      step: 'no_accounts',
      message: 'Nenhuma conta bancária configurada com Open Finance.',
      syncedAccounts: 0
    };
  }

  const syncResults = [];

  for (const account of bankAccounts) {
    try {
      const syncResponse = await supabase.functions.invoke('sync-bank-statement', {
        body: { bankAccountId: account.id }
      });
      syncResults.push({
        accountId: account.id,
        bankName: account.bank_name,
        success: !syncResponse.error,
        transactionsImported: syncResponse.data?.importedCount || 0
      });
    } catch (e) {
      syncResults.push({
        accountId: account.id,
        bankName: account.bank_name,
        success: false,
        error: e instanceof Error ? e.message : 'Sync failed'
      });
    }
  }

  const totalImported = syncResults.reduce((sum, r) => sum + (r.transactionsImported || 0), 0);

  return {
    step: 'synced',
    message: `Sincronização concluída. ${totalImported} transações importadas.`,
    syncResults,
    totalImported
  };
}

async function autoReconcile(supabase: any, companyId: string) {
  // Get unreconciled bank statements (credits)
  const { data: statements } = await supabase
    .from('bank_statements')
    .select(`
      *,
      bank_accounts!inner(company_id)
    `)
    .eq('bank_accounts.company_id', companyId)
    .eq('type', 'credit')
    .is('linked_transaction_id', null)
    .eq('reconciliation_status', 'pending')
    .order('statement_date', { ascending: false })
    .limit(100);

  // Get open receivables
  const { data: receivables } = await supabase
    .from('transactions')
    .select('*, customers(company_name, first_name, last_name)')
    .eq('company_id', companyId)
    .eq('type', 'RECEIVABLE')
    .is('payment_date', null)
    .order('due_date', { ascending: true });

  if (!statements?.length || !receivables?.length) {
    return {
      step: 'no_matches',
      message: 'Nenhuma transação para conciliar.',
      pendingStatements: statements?.length || 0,
      openReceivables: receivables?.length || 0
    };
  }

  const matches: Array<{
    statement: any;
    transaction: any;
    confidence: number;
    matchReason: string;
  }> = [];

  const autoApproved: Array<any> = [];
  const requiresReview: Array<any> = [];

  for (const statement of statements) {
    let bestMatch = null;
    let bestConfidence = 0;
    let matchReason = '';

    for (const receivable of receivables) {
      let confidence = 0;
      const reasons = [];

      // Exact amount match
      if (Math.abs(statement.amount - receivable.net_amount) < 0.01) {
        confidence += 50;
        reasons.push('valor exato');
      } else if (Math.abs(statement.amount - receivable.net_amount) / receivable.net_amount < 0.02) {
        confidence += 30;
        reasons.push('valor aproximado');
      }

      // Date proximity
      const statementDate = new Date(statement.statement_date);
      const dueDate = new Date(receivable.due_date);
      const daysDiff = Math.abs((statementDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 3) {
        confidence += 30;
        reasons.push('data próxima');
      } else if (daysDiff <= 7) {
        confidence += 15;
        reasons.push('data na semana');
      }

      // Description match (customer name in bank description)
      const customerName = receivable.customers?.company_name || 
        `${receivable.customers?.first_name} ${receivable.customers?.last_name}`;
      if (statement.description?.toLowerCase().includes(customerName?.toLowerCase().split(' ')[0])) {
        confidence += 20;
        reasons.push('nome do cliente');
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = receivable;
        matchReason = reasons.join(', ');
      }
    }

    if (bestMatch && bestConfidence >= 50) {
      const matchData = {
        statement,
        transaction: bestMatch,
        confidence: bestConfidence,
        matchReason
      };

      matches.push(matchData);

      if (bestConfidence >= 95) {
        autoApproved.push(matchData);
      } else {
        requiresReview.push(matchData);
      }
    }
  }

  // Execute auto-approved reconciliations immediately
  for (const match of autoApproved) {
    await supabase
      .from('bank_statements')
      .update({
        linked_transaction_id: match.transaction.id,
        reconciliation_status: 'reconciled',
        category_confidence: match.confidence
      })
      .eq('id', match.statement.id);

    await supabase
      .from('transactions')
      .update({
        payment_date: match.statement.statement_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', match.transaction.id);
  }

  return {
    step: 'reconciled',
    message: `Conciliação automática: ${autoApproved.length} baixadas automaticamente, ${requiresReview.length} para revisão.`,
    autoApproved: autoApproved.length,
    requiresReview: requiresReview.map(m => ({
      statementId: m.statement.id,
      transactionId: m.transaction.id,
      amount: m.statement.amount,
      expectedAmount: m.transaction.net_amount,
      statementDate: m.statement.statement_date,
      dueDate: m.transaction.due_date,
      description: m.statement.description,
      customerName: m.transaction.customers?.company_name || 
        `${m.transaction.customers?.first_name} ${m.transaction.customers?.last_name}`,
      confidence: m.confidence,
      matchReason: m.matchReason
    })),
    unmatched: (statements?.length || 0) - matches.length
  };
}

async function submitReconciliationForApproval(
  supabase: any, 
  companyId: string, 
  userId: string,
  reconciliations: Array<{ statementId: string; transactionId: string; confidence: number }>
) {
  // Filter low confidence items that need approval
  const needsApproval = reconciliations.filter(r => r.confidence < 95);

  if (needsApproval.length === 0) {
    // All high confidence - execute immediately
    return await executeReconciliationDirect(supabase, companyId, reconciliations);
  }

  const totalValue = await calculateTotalValue(supabase, needsApproval);

  const { data: approval } = await supabase
    .from('approval_queue')
    .insert({
      agent_id: 'receivables',
      action_type: 'approve_reconciliation',
      priority: totalValue > 50000 ? 2 : 5,
      request_data: {
        reconciliations: needsApproval,
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
    message: `${needsApproval.length} conciliações enviadas para aprovação do Gerente Financeiro.`,
    approvalId: approval?.id,
    totalValue
  };
}

async function executeReconciliation(supabase: any, companyId: string, approvalId: string) {
  const { data: approval } = await supabase
    .from('approval_queue')
    .select('request_data')
    .eq('id', approvalId)
    .single();

  if (!approval) {
    throw new Error('Approval not found');
  }

  return await executeReconciliationDirect(supabase, companyId, approval.request_data.reconciliations);
}

async function executeReconciliationDirect(
  supabase: any, 
  companyId: string,
  reconciliations: Array<{ statementId: string; transactionId: string; confidence: number }>
) {
  let successCount = 0;

  for (const rec of reconciliations) {
    // Get statement date
    const { data: statement } = await supabase
      .from('bank_statements')
      .select('statement_date')
      .eq('id', rec.statementId)
      .single();

    // Update bank statement
    const { error: stmtError } = await supabase
      .from('bank_statements')
      .update({
        linked_transaction_id: rec.transactionId,
        reconciliation_status: 'reconciled',
        category_confidence: rec.confidence
      })
      .eq('id', rec.statementId);

    // Update transaction payment date
    const { error: txError } = await supabase
      .from('transactions')
      .update({
        payment_date: statement?.statement_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', rec.transactionId);

    if (!stmtError && !txError) {
      successCount++;
    }
  }

  return {
    step: 'completed',
    requiresApproval: false,
    message: `${successCount} de ${reconciliations.length} transações conciliadas com sucesso.`,
    successCount,
    totalCount: reconciliations.length
  };
}

async function calculateTotalValue(
  supabase: any,
  reconciliations: Array<{ statementId: string; transactionId: string; confidence: number }>
) {
  let total = 0;
  for (const rec of reconciliations) {
    const { data: stmt } = await supabase
      .from('bank_statements')
      .select('amount')
      .eq('id', rec.statementId)
      .single();
    total += stmt?.amount || 0;
  }
  return total;
}

async function getReceivablesStatus(supabase: any, companyId: string) {
  const today = new Date().toISOString().split('T')[0];

  // Get pending receivables
  const { data: pending, count: pendingCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .eq('type', 'RECEIVABLE')
    .is('payment_date', null);

  // Get overdue receivables
  const { data: overdue, count: overdueCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .eq('type', 'RECEIVABLE')
    .is('payment_date', null)
    .lt('due_date', today);

  // Get unreconciled statements
  const { count: unreconciledCount } = await supabase
    .from('bank_statements')
    .select('*, bank_accounts!inner(company_id)', { count: 'exact' })
    .eq('bank_accounts.company_id', companyId)
    .is('linked_transaction_id', null)
    .eq('reconciliation_status', 'pending');

  const totalPending = pending?.reduce((sum: number, t: any) => sum + (t.net_amount || 0), 0) || 0;
  const totalOverdue = overdue?.reduce((sum: number, t: any) => sum + (t.net_amount || 0), 0) || 0;

  return {
    step: 'status',
    message: `${pendingCount} a receber (${overdueCount} vencidos). ${unreconciledCount} transações bancárias para conciliar.`,
    pendingCount: pendingCount || 0,
    pendingValue: totalPending,
    overdueCount: overdueCount || 0,
    overdueValue: totalOverdue,
    unreconciledCount: unreconciledCount || 0
  };
}
