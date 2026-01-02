import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLUGBANK_BASE_URL = "https://api.pagamentobancario.com.br/api/v1";

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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const TOKEN_SH = Deno.env.get("TECNOSPEED_TOKEN");
    const CNPJ_SH = Deno.env.get("TECNOSPEED_CNPJ_SOFTWAREHOUSE");

    if (!TOKEN_SH || !CNPJ_SH) {
      console.error("Missing credentials");
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais PlugBank não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { accountId, startDate, endDate, bankAccountId, companyId } = body;

    if (!accountId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ success: false, error: "ID da conta e período são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Requesting statement from PlugBank:", { accountId, startDate, endDate });

    const statementPayload = {
      accountId,
      startDate,
      endDate,
    };

    const response = await fetch(`${PLUGBANK_BASE_URL}/statement/openfinance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cnpj-sh": CNPJ_SH,
        "token-sh": TOKEN_SH,
      },
      body: JSON.stringify(statementPayload),
    });

    const responseText = await response.text();
    console.log("PlugBank response status:", response.status);
    console.log("PlugBank response:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido. Verifique as configurações." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 422) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Você precisa reconectar sua conta bancária. Clique em 'Conectar' para autorizar novamente.",
            needsConsent: true
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: responseData.message || "Erro ao solicitar extrato" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uniqueId = responseData.uniqueId || responseData.id || responseData.protocolId;
    const status = responseData.status || "PROCESSING";

    // Create sync protocol record
    if (bankAccountId) {
      const { error: insertError } = await supabaseClient
        .from("sync_protocols")
        .insert({
          bank_account_id: bankAccountId,
          company_id: companyId,
          plugbank_unique_id: uniqueId,
          start_date: startDate,
          end_date: endDate,
          status: status,
          created_by: user.id
        });

      if (insertError) {
        console.error("Error creating sync_protocol:", insertError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        uniqueId,
        status,
        message: "Solicitação enviada. Aguarde o processamento."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in plugbank-request-statement:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
