import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getBaseUrl(): string {
  const env = Deno.env.get("TECNOSPEED_ENVIRONMENT") || "staging";
  return env === "production"
    ? "https://pagamentobancario.com.br/api/v1"
    : "https://staging.pagamentobancario.com.br/api/v1";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const TOKEN = Deno.env.get("TECNOSPEED_TOKEN");
    const CNPJ_SH = Deno.env.get("TECNOSPEED_CNPJ_SOFTWAREHOUSE");

    if (!TOKEN || !CNPJ_SH) {
      return new Response(
        JSON.stringify({ error: "Credenciais TecnoSpeed não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const uniqueId = url.searchParams.get("uniqueId");

    if (!uniqueId) {
      return new Response(
        JSON.stringify({ error: "uniqueId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = getBaseUrl();
    console.log("Deleting payment:", uniqueId);

    const response = await fetch(`${baseUrl}/payment/${uniqueId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "cnpj-sh": CNPJ_SH,
        "token-sh": TOKEN,
      },
    });

    if (!response.ok) {
      const responseData = await response.json();
      return new Response(
        JSON.stringify({ error: responseData.message || "Erro ao excluir pagamento", details: responseData }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status in database
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await serviceClient
      .from("bank_payments")
      .update({ 
        status: "DELETED",
        updated_at: new Date().toISOString()
      })
      .eq("unique_id", uniqueId);

    console.log("Payment deleted successfully:", uniqueId);

    return new Response(
      JSON.stringify({ success: true, message: "Pagamento excluído com sucesso", uniqueId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
