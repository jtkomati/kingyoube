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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('=== Starting Budget Variance Monitor (FP&A Agent) ===');

    // Get current month
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStr = currentMonth.toISOString().split('T')[0];

    console.log('Analyzing budgets for month:', monthStr);

    // Get all active budget targets for current month
    const { data: budgets, error: budgetsError } = await supabase
      .from('budget_targets')
      .select('*, cfo_partners(*), company_settings(company_name)')
      .eq('month', monthStr);

    if (budgetsError) {
      console.error('Error fetching budgets:', budgetsError);
      throw budgetsError;
    }

    console.log(`Found ${budgets?.length || 0} budget targets to analyze`);

    let alertsGenerated = 0;

    // Analyze each budget
    for (const budget of budgets || []) {
      console.log(`\nAnalyzing budget: ${budget.account_name} for client ${budget.company_settings?.company_name}`);

      try {
        // Call variance calculation function
        const { data: variance, error: varianceError } = await supabase.functions.invoke(
          'cfo-budget-variance',
          {
            body: {
              clientCompanyId: budget.client_company_id,
              accountName: budget.account_name,
              month: monthStr
            }
          }
        );

        if (varianceError) {
          console.error('Error calculating variance:', varianceError);
          continue;
        }

        console.log('Variance result:', variance);

        // Generate alert based on severity
        if (variance.severity !== 'OK') {
          const varianceAmountFormatted = new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(Math.abs(variance.variance_amount));

          const targetFormatted = new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(variance.target_amount);

          let message = '';
          
          if (variance.severity === 'CRITICAL') {
            message = `🚨 ORÇAMENTO ESTOURADO: A conta "${variance.account_name}" do cliente ${budget.company_settings?.company_name} está ${Math.abs(variance.variance_percent).toFixed(1)}% (${varianceAmountFormatted}) acima do planejado (${targetFormatted}) para este mês.`;
          } else if (variance.severity === 'WARNING') {
            message = `⚠️ ALERTA DE ORÇAMENTO: A conta "${variance.account_name}" do cliente ${budget.company_settings?.company_name} já atingiu ${(variance.actual_amount / variance.target_amount * 100).toFixed(0)}% do orçamento mensal de ${targetFormatted}.`;
          } else if (variance.severity === 'INFO') {
            message = `✅ BOA NOTÍCIA: A receita "${variance.account_name}" do cliente ${budget.company_settings?.company_name} superou a meta em ${Math.abs(variance.variance_percent).toFixed(1)}% (${varianceAmountFormatted} acima de ${targetFormatted})!`;
          }

          // Push alert
          const { error: alertError } = await supabase.functions.invoke('cfo-push-alert', {
            body: {
              cfoPartnerId: budget.cfo_partner_id,
              clientCompanyId: budget.client_company_id,
              message: message,
              severity: variance.severity,
              metadata: {
                triggered_by: 'budget_variance_monitor',
                account_name: variance.account_name,
                variance_percent: variance.variance_percent,
                target_amount: variance.target_amount,
                actual_amount: variance.actual_amount
              }
            }
          });

          if (alertError) {
            console.error('Error pushing alert:', alertError);
          } else {
            alertsGenerated++;
            
            // Mark alert as generated in variance analysis
            await supabase
              .from('budget_variance_analysis')
              .update({ alert_generated: true })
              .eq('budget_target_id', budget.id)
              .eq('analysis_date', now.toISOString().split('T')[0]);
          }
        }
      } catch (error) {
        console.error(`Error analyzing budget ${budget.id}:`, error);
        continue;
      }
    }

    console.log(`\n=== Budget Variance Monitor Complete ===`);
    console.log(`Analyzed ${budgets?.length || 0} budgets`);
    console.log(`Generated ${alertsGenerated} alerts`);

    return new Response(
      JSON.stringify({ 
        success: true,
        budgets_analyzed: budgets?.length || 0,
        alerts_generated: alertsGenerated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in budget variance monitor:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});