import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TreasuryRequest {
  action: 'sync_balances' | 'project_cashflow' | 'analyze' | 'submit_operation' | 'execute_operation' | 'get_alerts';
  days?: number;
  operationType?: 'transfer' | 'investment' | 'redemption' | 'loan';
  operationData?: {
    fromAccountId?: string;
    toAccountId?: string;
    amount: number;
    description?: string;
  };
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
    const body: TreasuryRequest = await req.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case 'sync_balances':
        result = await syncBalances(supabase, companyId);
        break;

      case 'project_cashflow':
        result = await projectCashFlow(supabase, companyId, body.days || 30);
        break;

      case 'analyze':
        result = await analyzeTreasury(supabase, companyId);
        break;

      case 'submit_operation':
        result = await submitOperationForApproval(supabase, companyId, user.id, body);
        break;

      case 'execute_operation':
        result = await executeOperation(supabase, companyId, body.approvalId!);
        break;

      case 'get_alerts':
        result = await getTreasuryAlerts(supabase, companyId);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await supabase.from('agent_execution_logs').insert({
      agent_id: 'treasury',
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
    console.error('Treasury agent error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function syncBalances(supabase: any, companyId: string) {
  // Get all bank accounts
  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('company_id', companyId);

  if (!accounts?.length) {
    return {
      step: 'no_accounts',
      message: 'Nenhuma conta bancária cadastrada.',
      accounts: []
    };
  }

  const syncResults = [];
  let totalBalance = 0;

  for (const account of accounts) {
    // If has TecnoSpeed integration, sync
    if (account.account_hash) {
      try {
        const syncResponse = await supabase.functions.invoke('sync-bank-statement', {
          body: { bankAccountId: account.id }
        });
        
        // Refresh account data after sync
        const { data: updatedAccount } = await supabase
          .from('bank_accounts')
          .select('balance')
          .eq('id', account.id)
          .single();

        syncResults.push({
          accountId: account.id,
          bankName: account.bank_name,
          accountNumber: account.account_number,
          balance: updatedAccount?.balance || account.balance,
          synced: true,
          lastSync: new Date().toISOString()
        });
        totalBalance += updatedAccount?.balance || account.balance || 0;
      } catch (e) {
        syncResults.push({
          accountId: account.id,
          bankName: account.bank_name,
          accountNumber: account.account_number,
          balance: account.balance,
          synced: false,
          error: 'Sync failed'
        });
        totalBalance += account.balance || 0;
      }
    } else {
      syncResults.push({
        accountId: account.id,
        bankName: account.bank_name,
        accountNumber: account.account_number,
        balance: account.balance,
        synced: false,
        reason: 'No integration'
      });
      totalBalance += account.balance || 0;
    }
  }

  return {
    step: 'synced',
    message: `Saldo total: R$ ${totalBalance.toLocaleString('pt-BR')}`,
    totalBalance,
    accounts: syncResults,
    syncedCount: syncResults.filter(r => r.synced).length,
    totalAccounts: accounts.length
  };
}

async function projectCashFlow(supabase: any, companyId: string, days: number) {
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  // Get current balance
  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('balance')
    .eq('company_id', companyId);

  const currentBalance = accounts?.reduce((sum: number, a: any) => sum + (a.balance || 0), 0) || 0;

  // Get expected receivables
  const { data: receivables } = await supabase
    .from('transactions')
    .select('net_amount, due_date')
    .eq('company_id', companyId)
    .eq('type', 'RECEIVABLE')
    .is('payment_date', null)
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', endDate.toISOString().split('T')[0]);

  // Get expected payables
  const { data: payables } = await supabase
    .from('transactions')
    .select('net_amount, due_date')
    .eq('company_id', companyId)
    .eq('type', 'PAYABLE')
    .is('payment_date', null)
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', endDate.toISOString().split('T')[0]);

  const totalReceivables = receivables?.reduce((sum: number, r: any) => sum + (r.net_amount || 0), 0) || 0;
  const totalPayables = payables?.reduce((sum: number, p: any) => sum + (p.net_amount || 0), 0) || 0;

  // Build daily projection
  const projection: Array<{
    date: string;
    balance: number;
    receivables: number;
    payables: number;
  }> = [];

  let runningBalance = currentBalance;
  for (let d = 0; d <= days; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];

    const dayReceivables = receivables?.filter((r: any) => r.due_date === dateStr)
      .reduce((sum: number, r: any) => sum + (r.net_amount || 0), 0) || 0;
    const dayPayables = payables?.filter((p: any) => p.due_date === dateStr)
      .reduce((sum: number, p: any) => sum + (p.net_amount || 0), 0) || 0;

    runningBalance += dayReceivables - dayPayables;

    projection.push({
      date: dateStr,
      balance: runningBalance,
      receivables: dayReceivables,
      payables: dayPayables
    });
  }

  // Find minimum balance point
  const minPoint = projection.reduce((min, p) => p.balance < min.balance ? p : min, projection[0]);
  const maxPoint = projection.reduce((max, p) => p.balance > max.balance ? p : max, projection[0]);

  // Calculate cash runway (days until negative)
  const negativeDay = projection.find(p => p.balance < 0);
  const cashRunway = negativeDay ? 
    Math.floor((new Date(negativeDay.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 
    days;

  // Identify potential gaps
  const gaps: Array<{ date: string; deficit: number }> = [];
  const minimumBalance = currentBalance * 0.1; // 10% of current as minimum threshold
  for (const p of projection) {
    if (p.balance < minimumBalance) {
      gaps.push({ date: p.date, deficit: minimumBalance - p.balance });
    }
  }

  return {
    step: 'projected',
    message: `Projeção para ${days} dias. ${gaps.length > 0 ? `⚠️ ${gaps.length} dia(s) com saldo crítico.` : '✅ Fluxo de caixa saudável.'}`,
    currentBalance,
    projectedBalance: projection[projection.length - 1].balance,
    totalReceivables,
    totalPayables,
    netCashFlow: totalReceivables - totalPayables,
    cashRunway,
    minBalance: {
      date: minPoint.date,
      amount: minPoint.balance
    },
    maxBalance: {
      date: maxPoint.date,
      amount: maxPoint.balance
    },
    gaps,
    projection: projection.filter((_, i) => i % 7 === 0 || i === projection.length - 1) // Weekly + last day
  };
}

async function analyzeTreasury(supabase: any, companyId: string) {
  // Get current state
  const balances = await syncBalances(supabase, companyId);
  const projection30 = await projectCashFlow(supabase, companyId, 30);
  const projection90 = await projectCashFlow(supabase, companyId, 90);

  // Get company for historical comparison
  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('type, net_amount, payment_date')
    .eq('company_id', companyId)
    .not('payment_date', 'is', null)
    .gte('payment_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  // Calculate metrics
  const revenues = recentTransactions?.filter((t: any) => t.type === 'RECEIVABLE')
    .reduce((sum: number, t: any) => sum + (t.net_amount || 0), 0) || 0;
  const expenses = recentTransactions?.filter((t: any) => t.type === 'PAYABLE')
    .reduce((sum: number, t: any) => sum + (t.net_amount || 0), 0) || 0;

  const avgMonthlyRevenue = revenues / 3;
  const avgMonthlyExpense = expenses / 3;
  const burnRate = avgMonthlyExpense - avgMonthlyRevenue;
  const totalBal = balances.totalBalance || 0;
  const monthsRunway = burnRate > 0 ? totalBal / burnRate : null;

  // Generate recommendations
  const recommendations: Array<{
    type: 'info' | 'warning' | 'action';
    title: string;
    description: string;
    impact?: string;
  }> = [];

  if (projection30.gaps.length > 0) {
    recommendations.push({
      type: 'warning',
      title: 'Gap de liquidez detectado',
      description: `Saldo ficará crítico em ${projection30.gaps[0].date}`,
      impact: `Déficit de R$ ${projection30.gaps[0].deficit.toLocaleString('pt-BR')}`
    });
  }

  if (totalBal > avgMonthlyExpense * 3) {
    recommendations.push({
      type: 'info',
      title: 'Excesso de caixa',
      description: 'Considere aplicar o excedente em investimentos de curto prazo',
      impact: `R$ ${(totalBal - avgMonthlyExpense * 2).toLocaleString('pt-BR')} disponível para aplicação`
    });
  }

  if (burnRate > 0) {
    recommendations.push({
      type: 'warning',
      title: 'Consumo de caixa',
      description: `Empresa está consumindo R$ ${burnRate.toLocaleString('pt-BR')}/mês`,
      impact: monthsRunway ? `Runway de ${monthsRunway.toFixed(1)} meses` : undefined
    });
  }

  // Scoring
  let healthScore = 100;
  if (projection30.gaps.length > 0) healthScore -= 30;
  if (burnRate > 0) healthScore -= 20;
  if ((balances.syncedCount || 0) < (balances.totalAccounts || 0)) healthScore -= 10;
  healthScore = Math.max(0, healthScore);

  return {
    step: 'analyzed',
    message: `Análise de tesouraria completa. Score: ${healthScore}/100`,
    healthScore,
    currentState: {
      totalBalance: balances.totalBalance,
      accountCount: balances.totalAccounts,
      syncedAccounts: balances.syncedCount
    },
    metrics: {
      avgMonthlyRevenue,
      avgMonthlyExpense,
      burnRate: burnRate > 0 ? burnRate : 0,
      monthsRunway,
      netCashPosition: avgMonthlyRevenue - avgMonthlyExpense
    },
    projections: {
      days30: {
        projectedBalance: projection30.projectedBalance,
        gaps: projection30.gaps.length,
        minBalance: projection30.minBalance.amount
      },
      days90: {
        projectedBalance: projection90.projectedBalance,
        gaps: projection90.gaps.length,
        minBalance: projection90.minBalance.amount
      }
    },
    recommendations
  };
}

async function submitOperationForApproval(supabase: any, companyId: string, userId: string, body: TreasuryRequest) {
  const { operationType, operationData } = body;

  if (!operationType || !operationData) {
    throw new Error('Operation type and data required');
  }

  // All treasury operations require approval from Gerente Financeiro
  const priority = operationData.amount > 100000 ? 1 : 
                   operationData.amount > 50000 ? 2 : 
                   operationData.amount > 10000 ? 3 : 4;

  const actionDescriptions: Record<string, string> = {
    'transfer': 'Transferência entre contas',
    'investment': 'Aplicação financeira',
    'redemption': 'Resgate de aplicação',
    'loan': 'Tomada de empréstimo'
  };

  const { data: approval } = await supabase
    .from('approval_queue')
    .insert({
      agent_id: 'treasury',
      action_type: `execute_${operationType}`,
      priority,
      request_data: {
        operationType,
        ...operationData
      },
      requested_by: userId,
      company_id: companyId
    })
    .select()
    .single();

  return {
    step: 'pending_approval',
    requiresApproval: true,
    message: `${actionDescriptions[operationType]} de R$ ${operationData.amount.toLocaleString('pt-BR')} enviada para aprovação.`,
    approvalId: approval?.id,
    operationType,
    amount: operationData.amount
  };
}

async function executeOperation(supabase: any, companyId: string, approvalId: string) {
  const { data: approval } = await supabase
    .from('approval_queue')
    .select('request_data')
    .eq('id', approvalId)
    .single();

  if (!approval) {
    throw new Error('Approval not found');
  }

  const { operationType, fromAccountId, toAccountId, amount, description } = approval.request_data;

  // Execute based on operation type
  switch (operationType) {
    case 'transfer':
      if (fromAccountId && toAccountId) {
        // Debit from source
        await supabase.rpc('increment_balance', { 
          account_id: fromAccountId, 
          delta: -amount 
        });
        // Credit to destination
        await supabase.rpc('increment_balance', { 
          account_id: toAccountId, 
          delta: amount 
        });
      }
      break;

    case 'investment':
    case 'loan':
      // Log the operation - actual execution would integrate with bank APIs
      break;

    case 'redemption':
      if (toAccountId) {
        await supabase.rpc('increment_balance', { 
          account_id: toAccountId, 
          delta: amount 
        });
      }
      break;
  }

  return {
    step: 'executed',
    requiresApproval: false,
    message: `Operação de ${operationType} executada com sucesso.`,
    operationType,
    amount,
    description
  };
}

async function getTreasuryAlerts(supabase: any, companyId: string) {
  // Get CFO partner for this company
  const { data: company } = await supabase
    .from('company_settings')
    .select('cfo_partner_id')
    .eq('id', companyId)
    .single();

  if (!company?.cfo_partner_id) {
    return {
      step: 'no_alerts',
      message: 'Nenhum alerta ativo.',
      alerts: []
    };
  }

  // Get unread alerts
  const { data: alerts } = await supabase
    .from('cfo_alerts')
    .select('*')
    .eq('cfo_partner_id', company.cfo_partner_id)
    .or(`client_company_id.eq.${companyId},client_company_id.is.null`)
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(20);

  // Categorize by severity
  const critical = alerts?.filter((a: any) => a.severity === 'critical') || [];
  const warning = alerts?.filter((a: any) => a.severity === 'warning') || [];
  const info = alerts?.filter((a: any) => a.severity === 'info') || [];

  return {
    step: 'alerts',
    message: `${critical.length} alerta(s) crítico(s), ${warning.length} aviso(s).`,
    summary: {
      critical: critical.length,
      warning: warning.length,
      info: info.length,
      total: alerts?.length || 0
    },
    alerts: alerts?.map((a: any) => ({
      id: a.id,
      severity: a.severity,
      message: a.message,
      clientName: a.client_name,
      createdAt: a.created_at,
      metadata: a.metadata
    })) || []
  };
}
