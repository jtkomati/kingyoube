import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertConfig {
  error_threshold_5min: number;
  error_threshold_1hour: number;
  latency_threshold_p95_ms: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  error_threshold_5min: 10,
  error_threshold_1hour: 50,
  latency_threshold_p95_ms: 5000,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar cron secret para chamadas automatizadas
    const cronSecret = req.headers.get("X-Cron-Secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    
    // Permitir chamadas autenticadas ou com cron secret
    const authHeader = req.headers.get("authorization");
    if (!authHeader && cronSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const alerts: string[] = [];

    // 1. Verificar erros nos últimos 5 minutos
    const { data: recentErrors, error: recentError } = await supabase
      .from("application_logs")
      .select("id", { count: "exact" })
      .eq("level", "error")
      .gte("timestamp", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (!recentError && recentErrors) {
      const errorCount = recentErrors.length;
      if (errorCount >= DEFAULT_CONFIG.error_threshold_5min) {
        alerts.push(`CRITICAL: ${errorCount} erros nos últimos 5 minutos (threshold: ${DEFAULT_CONFIG.error_threshold_5min})`);
      }
    }

    // 2. Verificar erros na última hora
    const { data: hourlyErrors, error: hourlyError } = await supabase
      .from("application_logs")
      .select("id", { count: "exact" })
      .eq("level", "error")
      .gte("timestamp", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (!hourlyError && hourlyErrors) {
      const errorCount = hourlyErrors.length;
      if (errorCount >= DEFAULT_CONFIG.error_threshold_1hour) {
        alerts.push(`WARNING: ${errorCount} erros na última hora (threshold: ${DEFAULT_CONFIG.error_threshold_1hour})`);
      }
    }

    // 3. Verificar latência alta (P95 > threshold)
    const { data: latencyData, error: latencyError } = await supabase
      .from("application_logs")
      .select("duration_ms")
      .not("duration_ms", "is", null)
      .gte("timestamp", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("duration_ms", { ascending: false });

    if (!latencyError && latencyData && latencyData.length > 0) {
      // Calcular P95
      const sortedLatencies = latencyData.map(d => d.duration_ms).sort((a, b) => a - b);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);
      const p95 = sortedLatencies[p95Index] || 0;

      if (p95 > DEFAULT_CONFIG.latency_threshold_p95_ms) {
        alerts.push(`WARNING: Latência P95 = ${p95}ms (threshold: ${DEFAULT_CONFIG.latency_threshold_p95_ms}ms)`);
      }
    }

    // 4. Verificar funções com muitos erros
    const { data: functionErrors, error: funcError } = await supabase
      .from("application_logs")
      .select("function_name")
      .eq("level", "error")
      .not("function_name", "is", null)
      .gte("timestamp", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (!funcError && functionErrors) {
      const errorsByFunction: Record<string, number> = {};
      functionErrors.forEach(log => {
        const fn = log.function_name || 'unknown';
        errorsByFunction[fn] = (errorsByFunction[fn] || 0) + 1;
      });

      Object.entries(errorsByFunction).forEach(([fn, count]) => {
        if (count >= 5) {
          alerts.push(`WARNING: Função "${fn}" com ${count} erros na última hora`);
        }
      });
    }

    // Se houver alertas, criar entradas em cfo_alerts
    if (alerts.length > 0) {
      console.log("Alerts detected:", alerts);

      // Buscar todos os CFO partners ativos para notificar
      const { data: partners, error: partnersError } = await supabase
        .from("cfo_partners")
        .select("id")
        .eq("active", true);

      if (!partnersError && partners) {
        for (const partner of partners) {
          // Verificar se já existe alerta similar não resolvido
          const { data: existingAlert } = await supabase
            .from("cfo_alerts")
            .select("id")
            .eq("cfo_partner_id", partner.id)
            .eq("resolved", false)
            .eq("metadata->>alert_type", "observability_alert")
            .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
            .single();

          if (!existingAlert) {
            const { error: insertError } = await supabase
              .from("cfo_alerts")
              .insert({
                cfo_partner_id: partner.id,
                client_name: "Sistema",
                message: alerts.join("\n"),
                severity: alerts.some(a => a.includes("CRITICAL")) ? "critical" : "warning",
                metadata: {
                  alert_type: "observability_alert",
                  alerts: alerts,
                  checked_at: new Date().toISOString(),
                },
              });

            if (insertError) {
              console.error("Error creating alert:", insertError);
            }
          }
        }
      }
    }

    // Executar verificação de threshold do banco
    await supabase.rpc("check_error_threshold");

    console.log(`Observability check completed. Found ${alerts.length} alerts.`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts_count: alerts.length,
        alerts: alerts,
        checked_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in observability-alerts:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
