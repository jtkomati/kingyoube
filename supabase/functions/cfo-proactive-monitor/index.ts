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

    console.log("=== Starting CFO Proactive Monitor ===");

    // Buscar todos os parceiros CFO ativos
    const { data: partners, error: partnersError } = await supabase
      .from("cfo_partners")
      .select("*")
      .eq("active", true);

    if (partnersError) {
      console.error("Error fetching partners:", partnersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch partners" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${partners?.length || 0} active CFO partners`);

    let totalAlertsCreated = 0;

    // Para cada parceiro
    for (const partner of partners || []) {
      console.log(`\n--- Processing partner: ${partner.company_name} (${partner.id}) ---`);

      // Buscar configuração de monitoramento
      const { data: config } = await supabase
        .from("cfo_monitoring_config")
        .select("*")
        .eq("cfo_partner_id", partner.id)
        .single();

      const thresholds = {
        critical_cash_days: config?.critical_cash_days_threshold || 7,
        warning_ar_percentage: config?.warning_ar_overdue_percentage || 15.0,
        warning_uncategorized: config?.warning_uncategorized_threshold || 20,
      };

      // Buscar clientes do parceiro
      const { data: clients, error: clientsError } = await supabase
        .from("company_settings")
        .select("id, company_name")
        .eq("cfo_partner_id", partner.id);

      if (clientsError) {
        console.error(`Error fetching clients for partner ${partner.id}:`, clientsError);
        continue;
      }

      console.log(`Found ${clients?.length || 0} clients for this partner`);

      // Para cada cliente
      for (const client of clients || []) {
        console.log(`  Analyzing client: ${client.company_name}`);

        // Tool 1: Get Financial Vitals
        const vitalsResponse = await fetch(`${supabaseUrl}/functions/v1/cfo-get-client-vitals`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ client_id: client.id }),
        });

        if (!vitalsResponse.ok) {
          console.error(`  Failed to get vitals for ${client.company_name}`);
          continue;
        }

        const vitals = await vitalsResponse.json();
        console.log(`  Vitals:`, vitals);

        // Tool 2: Get Uncategorized Count
        const uncategorizedResponse = await fetch(`${supabaseUrl}/functions/v1/cfo-get-uncategorized-count`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ client_id: client.id }),
        });

        let uncategorizedCount = 0;
        if (uncategorizedResponse.ok) {
          const uncategorizedData = await uncategorizedResponse.json();
          uncategorizedCount = uncategorizedData.count;
          console.log(`  Uncategorized: ${uncategorizedCount}`);
        }

        // Análise e criação de alertas baseados nas regras de KPI

        // CRITICAL: Fluxo de caixa ficará negativo em menos de 7 dias
        if (vitals.cash_projection_status === 'CRITICAL' && vitals.days_to_negative !== null) {
          const message = `ALERTA CRÍTICO: Fluxo de caixa de ${client.company_name} ficará negativo em ${vitals.days_to_negative} dias. Saldo projetado: ${vitals.min_projected_balance.toLocaleString('pt-BR')}`;
          
          await fetch(`${supabaseUrl}/functions/v1/cfo-push-alert`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cfo_partner_id: partner.id,
              client_company_id: client.id,
              client_name: client.company_name,
              message,
              severity: "CRITICAL",
              metadata: {
                days_to_negative: vitals.days_to_negative,
                min_balance: vitals.min_projected_balance,
              },
            }),
          });

          console.log(`  ⚠️ CRITICAL alert created: Cash flow`);
          totalAlertsCreated++;
        }

        // CRITICAL: Contas a receber vencidas > 15% do saldo de caixa
        if (vitals.cash_balance > 0 && vitals.ar_overdue_30d > 0) {
          const percentage = (vitals.ar_overdue_30d / vitals.cash_balance) * 100;
          if (percentage > thresholds.warning_ar_percentage) {
            const message = `Contas a receber vencidas de ${client.company_name} representam ${percentage.toFixed(1)}% do saldo de caixa (${vitals.ar_overdue_30d.toLocaleString('pt-BR')} vencidos vs ${vitals.cash_balance.toLocaleString('pt-BR')} em caixa)`;
            
            await fetch(`${supabaseUrl}/functions/v1/cfo-push-alert`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                cfo_partner_id: partner.id,
                client_company_id: client.id,
                client_name: client.company_name,
                message,
                severity: "CRITICAL",
                metadata: {
                  ar_overdue: vitals.ar_overdue_30d,
                  cash_balance: vitals.cash_balance,
                  percentage: percentage,
                },
              }),
            });

            console.log(`  ⚠️ CRITICAL alert created: AR overdue`);
            totalAlertsCreated++;
          }
        }

        // WARNING: Transações não categorizadas > 20
        if (uncategorizedCount > thresholds.warning_uncategorized) {
          const message = `${client.company_name} tem ${uncategorizedCount} transações pendentes de categorização, impedindo análise financeira precisa`;
          
          await fetch(`${supabaseUrl}/functions/v1/cfo-push-alert`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cfo_partner_id: partner.id,
              client_company_id: client.id,
              client_name: client.company_name,
              message,
              severity: "WARNING",
              metadata: {
                uncategorized_count: uncategorizedCount,
              },
            }),
          });

          console.log(`  ⚠️ WARNING alert created: Uncategorized transactions`);
          totalAlertsCreated++;
        }

        // WARNING: Contas a pagar < 7 dias > saldo de caixa
        if (vitals.ap_due_7d > vitals.cash_balance) {
          const message = `${client.company_name} tem ${vitals.ap_due_7d.toLocaleString('pt-BR')} em contas a pagar nos próximos 7 dias, superior ao saldo de caixa de ${vitals.cash_balance.toLocaleString('pt-BR')}`;
          
          await fetch(`${supabaseUrl}/functions/v1/cfo-push-alert`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cfo_partner_id: partner.id,
              client_company_id: client.id,
              client_name: client.company_name,
              message,
              severity: "WARNING",
              metadata: {
                ap_due_7d: vitals.ap_due_7d,
                cash_balance: vitals.cash_balance,
              },
            }),
          });

          console.log(`  ⚠️ WARNING alert created: AP exceeds cash`);
          totalAlertsCreated++;
        }
      }
    }

    console.log(`\n=== Monitor completed. Total alerts created: ${totalAlertsCreated} ===`);

    return new Response(
      JSON.stringify({
        success: true,
        partners_processed: partners?.length || 0,
        total_alerts_created: totalAlertsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in cfo-proactive-monitor:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
