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
    const { cfoPartnerId, clientCompanyId } = await req.json();

    if (!cfoPartnerId) {
      return new Response(
        JSON.stringify({ error: 'cfoPartnerId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Analisando margens de projeto para CFO:', cfoPartnerId);

    // Buscar rulesets configurados pelo parceiro
    const { data: rulesets, error: rulesError } = await supabase
      .from('cfo_partner_rulesets')
      .select('*')
      .eq('cfo_partner_id', cfoPartnerId)
      .eq('active', true)
      .in('rule_type', ['PROJECT_MARGIN_WARNING', 'PROJECT_MARGIN_CRITICAL', 'HOURS_OVERRUN_WARNING', 'HOURS_OVERRUN_CRITICAL']);

    if (rulesError) {
      console.error('Erro ao buscar rulesets:', rulesError);
    }

    // Configurar thresholds padrão ou usar os do parceiro
    const marginCriticalThreshold = rulesets?.find(r => r.rule_type === 'PROJECT_MARGIN_CRITICAL')?.threshold_value || -20;
    const marginWarningThreshold = rulesets?.find(r => r.rule_type === 'PROJECT_MARGIN_WARNING')?.threshold_value || -10;
    const hoursOverrunCritical = rulesets?.find(r => r.rule_type === 'HOURS_OVERRUN_CRITICAL')?.threshold_value || 90;
    const hoursOverrunWarning = rulesets?.find(r => r.rule_type === 'HOURS_OVERRUN_WARNING')?.threshold_value || 80;

    // Buscar projetos ativos
    let projectsQuery = supabase
      .from('accounting_projects')
      .select(`
        id,
        name,
        code,
        customer_id,
        budget_amount,
        budget_hours,
        hourly_rate,
        total_billed,
        total_hours_logged,
        status,
        customers (
          company_name,
          first_name,
          last_name
        )
      `)
      .eq('status', 'ATIVO')
      .not('budget_hours', 'is', null);

    if (clientCompanyId) {
      projectsQuery = projectsQuery.eq('customer_id', clientCompanyId);
    }

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError) {
      console.error('Erro ao buscar projetos:', projectsError);
      throw projectsError;
    }

    const alertsCreated = [];

    for (const project of projects || []) {
      const budgetHours = project.budget_hours || 0;
      const totalHoursLogged = project.total_hours_logged || 0;
      const budgetAmount = project.budget_amount || 0;
      const totalBilled = project.total_billed || 0;

      if (budgetHours === 0) continue;

      // Calcular percentuais
      const hoursConsumedPct = (totalHoursLogged / budgetHours) * 100;
      const invoicedPct = budgetAmount > 0 ? (totalBilled / budgetAmount) * 100 : 0;
      const marginGap = invoicedPct - hoursConsumedPct;

      const customer = Array.isArray(project.customers) ? project.customers[0] : project.customers;
      const customerName = customer?.company_name || 
                          `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() ||
                          'Cliente não identificado';

      console.log(`Projeto ${project.name}: ${hoursConsumedPct.toFixed(1)}% horas, ${invoicedPct.toFixed(1)}% faturado, gap: ${marginGap.toFixed(1)}%`);

      // CRITICAL: Horas consumidas >> Faturamento
      if (marginGap <= marginCriticalThreshold && hoursConsumedPct >= hoursOverrunCritical) {
        const customMessage = rulesets?.find(r => r.rule_type === 'PROJECT_MARGIN_CRITICAL')?.custom_message_template;
        
        const message = customMessage 
          ? customMessage
              .replace('{project_name}', project.name)
              .replace('{hours_consumed_pct}', hoursConsumedPct.toFixed(1))
              .replace('{invoiced_pct}', invoicedPct.toFixed(1))
              .replace('{margin_gap}', marginGap.toFixed(1))
          : `⚠️ MARGEM CRÍTICA - Projeto "${project.name}": ${hoursConsumedPct.toFixed(1)}% das horas consumidas, mas apenas ${invoicedPct.toFixed(1)}% faturado. Gap de margem: ${marginGap.toFixed(1)}%`;

        const { error: alertError } = await supabase
          .from('cfo_alerts')
          .insert({
            cfo_partner_id: cfoPartnerId,
            client_company_id: project.customer_id,
            client_name: customerName,
            severity: 'CRITICAL',
            message,
            metadata: {
              project_id: project.id,
              project_name: project.name,
              hours_consumed_pct: hoursConsumedPct.toFixed(1),
              invoiced_pct: invoicedPct.toFixed(1),
              margin_gap: marginGap.toFixed(1),
              budget_hours: budgetHours,
              total_hours_logged: totalHoursLogged,
              budget_amount: budgetAmount,
              total_billed: totalBilled
            }
          });

        if (!alertError) {
          alertsCreated.push({ project: project.name, severity: 'CRITICAL' });
          
          // Track ROI
          await supabase.from('cfo_partner_roi_tracking').insert({
            cfo_partner_id: cfoPartnerId,
            client_company_id: project.customer_id,
            event_type: 'CRITICAL_ALERT_GENERATED',
            time_saved_minutes: 45,
            metadata: { project_id: project.id, alert_type: 'PROJECT_MARGIN_CRITICAL' }
          });
        }
      }
      // WARNING: Horas se aproximando do limite
      else if (marginGap <= marginWarningThreshold && hoursConsumedPct >= hoursOverrunWarning) {
        const customMessage = rulesets?.find(r => r.rule_type === 'PROJECT_MARGIN_WARNING')?.custom_message_template;
        
        const message = customMessage
          ? customMessage
              .replace('{project_name}', project.name)
              .replace('{hours_consumed_pct}', hoursConsumedPct.toFixed(1))
              .replace('{invoiced_pct}', invoicedPct.toFixed(1))
              .replace('{margin_gap}', marginGap.toFixed(1))
          : `⚠️ ATENÇÃO - Projeto "${project.name}": ${hoursConsumedPct.toFixed(1)}% das horas consumidas, ${invoicedPct.toFixed(1)}% faturado. Monitore a margem.`;

        const { error: alertError } = await supabase
          .from('cfo_alerts')
          .insert({
            cfo_partner_id: cfoPartnerId,
            client_company_id: project.customer_id,
            client_name: customerName,
            severity: 'WARNING',
            message,
            metadata: {
              project_id: project.id,
              project_name: project.name,
              hours_consumed_pct: hoursConsumedPct.toFixed(1),
              invoiced_pct: invoicedPct.toFixed(1),
              margin_gap: marginGap.toFixed(1)
            }
          });

        if (!alertError) {
          alertsCreated.push({ project: project.name, severity: 'WARNING' });
          
          // Track ROI
          await supabase.from('cfo_partner_roi_tracking').insert({
            cfo_partner_id: cfoPartnerId,
            client_company_id: project.customer_id,
            event_type: 'WARNING_ALERT_GENERATED',
            time_saved_minutes: 20,
            metadata: { project_id: project.id, alert_type: 'PROJECT_MARGIN_WARNING' }
          });
        }
      }
    }

    console.log('Alertas de margem criados:', alertsCreated);

    return new Response(
      JSON.stringify({
        success: true,
        alerts_created: alertsCreated.length,
        projects_analyzed: projects?.length || 0,
        details: alertsCreated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Log detailed error server-side only
    console.error('Erro na função cfo-analyze-project-margin:', {
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return generic error message to client
    return new Response(
      JSON.stringify({ 
        error: 'Não foi possível analisar as margens. Tente novamente mais tarde.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
