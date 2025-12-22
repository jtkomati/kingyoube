import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: 'frontend' | 'edge_function' | 'cron' | 'system';
  context?: Record<string, unknown>;
  error_stack?: string;
  function_name?: string;
  duration_ms?: number;
  user_id?: string;
  organization_id?: string;
  request_id?: string;
  page_url?: string;
  user_agent?: string;
}

interface LogPayload {
  logs: LogEntry[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse body
    const payload: LogPayload = await req.json();
    
    if (!payload.logs || !Array.isArray(payload.logs)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: logs array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limite de rate limiting: máximo 100 logs por request
    const logsToInsert = payload.logs.slice(0, 100);

    // Validar e sanitizar cada log
    const validatedLogs = logsToInsert.map(log => ({
      level: ['debug', 'info', 'warn', 'error'].includes(log.level) ? log.level : 'info',
      message: String(log.message).slice(0, 10000), // Limitar tamanho
      source: ['frontend', 'edge_function', 'cron', 'system'].includes(log.source) ? log.source : 'frontend',
      context: log.context ? JSON.parse(JSON.stringify(log.context)) : {},
      error_stack: log.error_stack ? String(log.error_stack).slice(0, 50000) : null,
      function_name: log.function_name ? String(log.function_name).slice(0, 255) : null,
      duration_ms: typeof log.duration_ms === 'number' ? Math.round(log.duration_ms) : null,
      user_id: log.user_id || null,
      organization_id: log.organization_id || null,
      request_id: log.request_id ? String(log.request_id).slice(0, 100) : null,
      page_url: log.page_url ? String(log.page_url).slice(0, 2000) : null,
      user_agent: log.user_agent ? String(log.user_agent).slice(0, 500) : null,
    }));

    // Inserir logs
    const { error: insertError } = await supabase
      .from("application_logs")
      .insert(validatedLogs);

    if (insertError) {
      console.error("Error inserting logs:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to insert logs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se há muitos erros recentes e disparar verificação de threshold
    const errorLogs = validatedLogs.filter(l => l.level === 'error');
    if (errorLogs.length > 0) {
      // Verificar threshold em background
      supabase.rpc('check_error_threshold').then(({ error }) => {
        if (error) {
          console.error("Error checking error threshold:", error);
        }
      });
    }

    console.log(`Ingested ${validatedLogs.length} logs (${errorLogs.length} errors)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: validatedLogs.length,
        errors: errorLogs.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in log-ingestion:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
