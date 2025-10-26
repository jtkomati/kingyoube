import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientCompanyId, accountName, month } = await req.json();

    if (!clientCompanyId || !accountName || !month) {
      return new Response(
        JSON.stringify({ error: 'clientCompanyId, accountName e month são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Calculando variance:', { clientCompanyId, accountName, month });

    // Get budget target
    const monthDate = new Date(month);
    monthDate.setDate(1);
    const monthStr = monthDate.toISOString().split('T')[0];

    const { data: budget, error: budgetError } = await supabase
      .from('budget_targets')
      .select('*')
      .eq('client_company_id', clientCompanyId)
      .eq('account_name', accountName)
      .eq('month', monthStr)
      .single();

    if (budgetError || !budget) {
      return new Response(
        JSON.stringify({ error: 'Budget target not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range for the month
    const startDate = new Date(monthStr);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // Last day of month

    // Get actual transactions for this account category in the month
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('gross_amount, type')
      .eq('category_id', budget.account_category)
      .gte('due_date', startDate.toISOString().split('T')[0])
      .lte('due_date', endDate.toISOString().split('T')[0]);

    if (txError) {
      console.error('Erro ao buscar transações:', txError);
      throw txError;
    }

    // Calculate actual amount (sum of transactions)
    const actualAmount = (transactions || []).reduce((sum, tx) => {
      return sum + Number(tx.gross_amount);
    }, 0);

    // Calculate variance
    const varianceAmount = actualAmount - Number(budget.target_amount);
    const variancePercent = Number(budget.target_amount) !== 0 
      ? (varianceAmount / Number(budget.target_amount)) * 100 
      : 0;

    // Determine variance status
    let varianceStatus = 'ON_TARGET';
    if (varianceAmount > 0) {
      varianceStatus = 'OVER_BUDGET';
    } else if (varianceAmount < 0) {
      varianceStatus = 'UNDER_BUDGET';
    }

    // Determine severity based on FP&A policy
    let severity = 'OK';
    const absVariancePercent = Math.abs(variancePercent);
    
    // For expenses (PAYABLE)
    if (varianceStatus === 'OVER_BUDGET') {
      if (absVariancePercent > 10) {
        severity = 'CRITICAL';
      } else if (absVariancePercent > 5) {
        severity = 'WARNING';
      }
    }
    // For revenue (RECEIVABLE) - good news if over budget
    else if (varianceStatus === 'OVER_BUDGET' && absVariancePercent > 20) {
      severity = 'INFO';
    }
    // Check if approaching budget (90% or more by day 20)
    const today = new Date();
    const currentDay = today.getDate();
    if (currentDay <= 20 && actualAmount >= Number(budget.target_amount) * 0.9) {
      severity = 'WARNING';
    }

    const result = {
      budget_id: budget.id,
      account_name: accountName,
      account_category: budget.account_category,
      month: monthStr,
      target_amount: Number(budget.target_amount),
      actual_amount: actualAmount,
      variance_amount: varianceAmount,
      variance_percent: variancePercent,
      variance_status: varianceStatus,
      severity: severity,
      transactions_count: (transactions || []).length
    };

    // Store variance analysis
    const { error: analysisError } = await supabase
      .from('budget_variance_analysis')
      .insert({
        budget_target_id: budget.id,
        client_company_id: clientCompanyId,
        cfo_partner_id: budget.cfo_partner_id,
        analysis_date: new Date().toISOString().split('T')[0],
        target_amount: result.target_amount,
        actual_amount: result.actual_amount,
        variance_amount: result.variance_amount,
        variance_percent: result.variance_percent,
        variance_status: result.variance_status,
        severity: result.severity
      });

    if (analysisError) {
      console.error('Erro ao armazenar análise:', analysisError);
      // Don't fail the request, just log
    }

    console.log('Variance calculado:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});