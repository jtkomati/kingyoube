import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  cfo_partner_id: z.string().uuid(),
  client_company_id: z.string().uuid(),
  client_name: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  severity: z.enum(['CRITICAL', 'WARNING', 'INFO']),
  metadata: z.record(z.any()).optional()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cfo_partner_id, client_company_id, client_name, message, severity, metadata } = validation.data;

    // Verify ownership
    const { data: partner, error: partnerError } = await supabase
      .from('cfo_partners')
      .select('id')
      .eq('id', cfo_partner_id)
      .eq('user_id', user.id)
      .single();

    if (partnerError || !partner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have access to this CFO partner' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
