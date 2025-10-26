import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("=== Calculating Startup Metrics ===");

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Datas para cálculos
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfLastMonth = new Date(currentYear, currentMonth, 0);
    const oneYearAgo = new Date(currentYear - 1, currentMonth, 1);

    // 1. MRR (Monthly Recurring Revenue) - Receitas recorrentes do mês
    const { data: mrrTransactions } = await supabase
      .from("transactions")
      .select("net_amount, is_recurring")
      .eq("type", "RECEIVABLE")
      .eq("is_recurring", true)
      .gte("due_date", startOfMonth.toISOString())
      .lte("due_date", endOfMonth.toISOString());

    const mrr = mrrTransactions?.reduce((sum, tx) => sum + Number(tx.net_amount), 0) || 0;

    // MRR do mês passado para calcular crescimento
    const { data: lastMonthMrrTx } = await supabase
      .from("transactions")
      .select("net_amount")
      .eq("type", "RECEIVABLE")
      .eq("is_recurring", true)
      .gte("due_date", startOfLastMonth.toISOString())
      .lte("due_date", endOfLastMonth.toISOString());

    const lastMonthMrr = lastMonthMrrTx?.reduce((sum, tx) => sum + Number(tx.net_amount), 0) || 0;
    const mrrGrowth = lastMonthMrr > 0 ? ((mrr - lastMonthMrr) / lastMonthMrr) * 100 : 0;

    // 2. ARR (Annual Recurring Revenue)
    const arr = mrr * 12;

    // 3. Calcular número de clientes ativos e novos
    const { data: allCustomers, count: totalCustomers } = await supabase
      .from("customers")
      .select("id, created_at", { count: "exact" });

    const newCustomersThisMonth = allCustomers?.filter((c) => {
      const created = new Date(c.created_at);
      return created >= startOfMonth && created <= endOfMonth;
    }).length || 0;

    const customersLastMonth = allCustomers?.filter((c) => {
      const created = new Date(c.created_at);
      return created <= endOfLastMonth;
    }).length || 0;

    // 4. CAC (Customer Acquisition Cost) - Custo de marketing/vendas dividido por novos clientes
    // Assumindo que despesas de categoria "Marketing" e "Vendas" são custos de aquisição
    const { data: acquisitionCosts } = await supabase
      .from("transactions")
      .select("gross_amount, category_id")
      .eq("type", "PAYABLE")
      .gte("due_date", startOfMonth.toISOString())
      .lte("due_date", endOfMonth.toISOString());

    const totalAcquisitionCost = acquisitionCosts?.reduce((sum, tx) => {
      return sum + Number(tx.gross_amount);
    }, 0) || 0;

    const cac = newCustomersThisMonth > 0 ? totalAcquisitionCost / newCustomersThisMonth : 0;

    // 5. LTV (Lifetime Value) - Valor médio por cliente * tempo médio de vida
    // Simplificado: (MRR / Número de clientes) / Churn Rate
    const avgRevenuePerCustomer = totalCustomers && totalCustomers > 0 ? mrr / totalCustomers : 0;

    // 6. Churn Rate - Taxa de cancelamento mensal
    // Clientes que cancelaram (não fizeram transações nos últimos 60 dias)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: recentTransactions } = await supabase
      .from("transactions")
      .select("customer_id")
      .gte("created_at", sixtyDaysAgo.toISOString())
      .not("customer_id", "is", null);

    const activeCustomerIds = new Set(
      recentTransactions?.map((tx) => tx.customer_id).filter(Boolean)
    );

    const activeCustomers = activeCustomerIds.size;
    const churnedCustomers = (totalCustomers || 0) - activeCustomers;
    const churnRate = totalCustomers && totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;

    // LTV calculado: (Receita média por cliente / Churn mensal)
    const monthlyChurnRate = churnRate / 100;
    const ltv = monthlyChurnRate > 0 ? avgRevenuePerCustomer / monthlyChurnRate : avgRevenuePerCustomer * 12;

    // 7. Métricas adicionais
    const ltvCacRatio = cac > 0 ? ltv / cac : 0;
    const paybackPeriod = avgRevenuePerCustomer > 0 ? cac / avgRevenuePerCustomer : 0;

    // 8. Cash Burn Rate - Taxa de queima de caixa mensal
    const { data: monthlyExpenses } = await supabase
      .from("transactions")
      .select("net_amount")
      .eq("type", "PAYABLE")
      .gte("due_date", startOfMonth.toISOString())
      .lte("due_date", endOfMonth.toISOString());

    const totalExpenses = monthlyExpenses?.reduce((sum, tx) => sum + Number(tx.net_amount), 0) || 0;
    const burnRate = totalExpenses - mrr;

    // 9. Runway - Meses até acabar o dinheiro
    const { data: currentBalance } = await supabase
      .from("transactions")
      .select("net_amount, type");

    let cashBalance = 0;
    currentBalance?.forEach((tx) => {
      if (tx.type === "RECEIVABLE") {
        cashBalance += Number(tx.net_amount);
      } else {
        cashBalance -= Number(tx.net_amount);
      }
    });

    const runway = burnRate > 0 ? cashBalance / burnRate : 999;

    const metrics = {
      mrr,
      mrrGrowth,
      arr,
      cac,
      ltv,
      churnRate,
      ltvCacRatio,
      totalCustomers: totalCustomers || 0,
      newCustomersThisMonth,
      activeCustomers,
      avgRevenuePerCustomer,
      burnRate,
      runway,
      paybackPeriod,
      cashBalance,
    };

    console.log("Metrics calculated:", metrics);

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error calculating startup metrics:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
