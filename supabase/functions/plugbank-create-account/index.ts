import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TecnoSpeed Open Finance API URLs
const getBaseUrl = () => {
  const env = Deno.env.get("TECNOSPEED_ENVIRONMENT") || "sandbox";
  return env === "production"
    ? "https://api.openfinance.tecnospeed.com.br/v1"
    : "https://api.sandbox.openfinance.tecnospeed.com.br/v1";
};

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

    const TOKEN = Deno.env.get("TECNOSPEED_TOKEN");
    const LOGIN_AUTH = Deno.env.get("TECNOSPEED_LOGIN_AUTH") || Deno.env.get("TECNOSPEED_CNPJ_SOFTWAREHOUSE");

    if (!TOKEN || !LOGIN_AUTH) {
      console.error("Missing credentials");
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais TecnoSpeed não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { payerId, bankCode, agency, accountNumber, accountType = "checking" } = body;

    if (!payerId || !bankCode || !agency || !accountNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Todos os campos são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = getBaseUrl();
    const requestUrl = `${baseUrl}/accounts`;
    
    console.log("Creating account with TecnoSpeed API:", { 
      payerId, 
      bankCode, 
      agency, 
      accountNumber,
      requestUrl
    });

    const accountPayload = {
      customerId: payerId,
      bankCode,
      agency: agency.replace(/\D/g, ""),
      accountNumber: accountNumber.replace(/\D/g, ""),
      accountType,
    };

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
        "LoginAuth": LOGIN_AUTH,
      },
      body: JSON.stringify(accountPayload),
    });

    const responseText = await response.text();
    console.log("TecnoSpeed response status:", response.status);
    console.log("TecnoSpeed response:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido. Verifique as configurações." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: "Endpoint não encontrado. Verifique a configuração da API." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 422) {
        return new Response(
          JSON.stringify({ success: false, error: responseData.message || "Dados inválidos ou conta já existe" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: responseData.message || "Erro ao cadastrar conta" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = responseData.id || responseData.accountId;
    const consentLink = responseData.consentLink || responseData.connectorUrl || responseData.link;

    // Save to bank_accounts if bankAccountId provided
    if (body.bankAccountId) {
      const { error: updateError } = await supabaseClient
        .from("bank_accounts")
        .update({ 
          plugbank_account_id: accountId,
          consent_link: consentLink,
          bank_code: bankCode,
          open_finance_status: "awaiting_consent"
        })
        .eq("id", body.bankAccountId);

      if (updateError) {
        console.error("Error updating bank_accounts:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        accountId,
        consentLink,
        message: "Conta cadastrada. Clique no link para autorizar no banco."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in plugbank-create-account:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
