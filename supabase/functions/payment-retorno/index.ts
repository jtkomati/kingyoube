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
    const action = url.searchParams.get("action") || "upload";
    const baseUrl = getBaseUrl();

    if (action === "upload" && req.method === "POST") {
      // Upload retorno file
      const body = await req.json();
      const { companyId, accountHash, fileContent, fileName } = body;

      if (!accountHash || !fileContent) {
        return new Response(
          JSON.stringify({ error: "accountHash e fileContent são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Uploading retorno file for account:", accountHash);

      const response = await fetch(`${baseUrl}/retorno`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
        body: JSON.stringify({
          accountHash,
          fileContent
        }),
      });

      const responseText = await response.text();
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
          JSON.stringify({ error: responseData.message || "Erro ao enviar retorno", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uniqueId = responseData.uniqueId || responseData.data?.uniqueId;

      // Save retorno to database
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: retorno } = await serviceClient
        .from("payment_retornos")
        .insert({
          company_id: companyId,
          account_hash: accountHash,
          unique_id: uniqueId,
          status: "RECEIVED",
          file_content: fileContent,
          processed_payments: responseData.processedPayments || responseData.data?.processedPayments
        })
        .select()
        .single();

      // Update payment statuses based on retorno
      if (responseData.payments || responseData.data?.payments) {
        const payments = responseData.payments || responseData.data?.payments;
        for (const payment of payments) {
          if (payment.uniqueId && payment.status) {
            await serviceClient
              .from("bank_payments")
              .update({
                status: payment.status,
                effective_date: payment.effectiveDate,
                occurrences: payment.occurrences,
                reconciliation_linked: { retornoId: retorno?.id, processedAt: new Date().toISOString() }
              })
              .eq("unique_id", payment.uniqueId);
          }
        }
      }

      console.log("Retorno file processed successfully");

      return new Response(
        JSON.stringify({ success: true, retornoId: retorno?.id, uniqueId, tecnospeedResponse: responseData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "query") {
      // Query retorno by period or uniqueId
      const uniqueId = url.searchParams.get("uniqueId");
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      const accountHash = url.searchParams.get("accountHash");

      let endpoint = `${baseUrl}/retorno`;
      const params = new URLSearchParams();

      if (uniqueId) {
        params.append("uniqueId", uniqueId);
      } else if (startDate && endDate) {
        endpoint = `${baseUrl}/retorno/period`;
        params.append("startDate", startDate);
        params.append("endDate", endDate);
        if (accountHash) params.append("accountHash", accountHash);
      }

      const response = await fetch(`${endpoint}?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: responseData.message || "Erro ao consultar retorno", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, retornos: responseData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "download") {
      const uniqueId = url.searchParams.get("uniqueId");

      if (!uniqueId) {
        return new Response(
          JSON.stringify({ error: "uniqueId é obrigatório para download" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${baseUrl}/retorno/download?uniqueId=${uniqueId}`, {
        method: "GET",
        headers: {
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
      });

      if (!response.ok) {
        const responseData = await response.json();
        return new Response(
          JSON.stringify({ error: responseData.message || "Erro ao baixar retorno", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fileContent = await response.text();

      return new Response(
        JSON.stringify({ success: true, fileContent }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não suportada" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
