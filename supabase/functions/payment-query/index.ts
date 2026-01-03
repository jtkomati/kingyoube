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
      console.error("Authentication error:", userError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const TOKEN = Deno.env.get("TECNOSPEED_TOKEN");
    const CNPJ_SH = Deno.env.get("TECNOSPEED_CNPJ_SOFTWAREHOUSE");

    if (!TOKEN || !CNPJ_SH) {
      console.error("Missing TecnoSpeed credentials");
      return new Response(
        JSON.stringify({ error: "Credenciais TecnoSpeed não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const uniqueId = url.searchParams.get("uniqueId");
    const accountHash = url.searchParams.get("accountHash");
    const status = url.searchParams.get("status");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const page = url.searchParams.get("page") || "1";
    const limit = url.searchParams.get("limit") || "50";

    const baseUrl = getBaseUrl();

    // If querying a specific payment by uniqueId
    if (uniqueId) {
      console.log("Querying payment by uniqueId:", uniqueId);

      const response = await fetch(`${baseUrl}/payment?uniqueId=${uniqueId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
      });

      const responseText = await response.text();
      console.log("TecnoSpeed response status:", response.status);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        return new Response(
          JSON.stringify({ error: "Resposta inválida da API TecnoSpeed", details: responseText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            error: responseData.message || "Erro ao consultar pagamento", 
            details: responseData 
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update local database with latest status
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const paymentStatus = responseData.status || responseData.data?.status;
      const occurrences = responseData.occurrences || responseData.data?.occurrences;

      if (paymentStatus) {
        await serviceClient
          .from("bank_payments")
          .update({ 
            status: paymentStatus,
            occurrences,
            updated_at: new Date().toISOString()
          })
          .eq("unique_id", uniqueId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment: responseData
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List payments with filters
    console.log("Listing payments with filters");

    const queryParams = new URLSearchParams();
    if (accountHash) queryParams.append("accountHash", accountHash);
    if (status) queryParams.append("status", status);
    if (startDate) queryParams.append("startDate", startDate);
    if (endDate) queryParams.append("endDate", endDate);
    queryParams.append("page", page);
    queryParams.append("limit", limit);

    const response = await fetch(`${baseUrl}/payment/list?${queryParams.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "cnpj-sh": CNPJ_SH,
        "token-sh": TOKEN,
      },
    });

    const responseText = await response.text();
    console.log("TecnoSpeed response status:", response.status);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Resposta inválida da API TecnoSpeed", details: responseText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: responseData.message || "Erro ao listar pagamentos", 
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payments: responseData.data || responseData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: responseData.total || responseData.data?.length || 0
        }
      }),
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
