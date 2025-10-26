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

    const { cfo_partner_id, client_company_id, client_name, message, severity, metadata } = await req.json();

    if (!cfo_partner_id || !client_name || !message || !severity) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!['CRITICAL', 'WARNING', 'INFO'].includes(severity)) {
      return new Response(
        JSON.stringify({ error: "Invalid severity. Must be CRITICAL, WARNING, or INFO" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating alert for CFO partner ${cfo_partner_id}: ${severity} - ${message}`);

    // Verificar se já existe um alerta similar não resolvido (evitar duplicatas)
    const { data: existingAlerts, error: checkError } = await supabase
      .from("cfo_alerts")
      .select("id")
      .eq("cfo_partner_id", cfo_partner_id)
      .eq("client_name", client_name)
      .eq("message", message)
      .eq("resolved", false)
      .limit(1);

    if (checkError) {
      console.error("Error checking existing alerts:", checkError);
      // Continue mesmo com erro, pois é melhor duplicar do que perder alertas
    }

    if (existingAlerts && existingAlerts.length > 0) {
      console.log("Alert already exists, skipping duplicate");
      return new Response(
        JSON.stringify({ success: true, message: "Alert already exists", alert_id: existingAlerts[0].id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar o alerta
    const { data: alert, error: insertError } = await supabase
      .from("cfo_alerts")
      .insert({
        cfo_partner_id,
        client_company_id,
        client_name,
        message,
        severity,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating alert:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create alert" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Alert created successfully: ${alert.id}`);

    return new Response(
      JSON.stringify({ success: true, alert_id: alert.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    // Log detailed error server-side only
    console.error("Erro na função cfo-push-alert:", {
      error: error?.message || 'Erro desconhecido',
      stack: error?.stack
    });
    
    // Return generic error message to client
    return new Response(
      JSON.stringify({ error: "Não foi possível criar o alerta. Tente novamente mais tarde." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
