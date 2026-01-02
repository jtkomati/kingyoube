import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TecnoSpeed Pagamento Bancário API URLs (conforme documentação oficial)
const getBaseUrl = () => {
  const env = Deno.env.get("TECNOSPEED_ENVIRONMENT") || "staging";
  return env === "production"
    ? "https://api.pagamentobancario.com.br/api/v1"
    : "https://staging.pagamentobancario.com.br/api/v1";
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

    // TecnoSpeed credentials - usando headers conforme documentação
    const TOKEN = Deno.env.get("TECNOSPEED_TOKEN");
    const CNPJ_SH = Deno.env.get("TECNOSPEED_CNPJ_SOFTWAREHOUSE");

    if (!TOKEN || !CNPJ_SH) {
      console.error("Missing credentials");
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais TecnoSpeed não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { payerId, bankCode, agency, agencyDigit, accountNumber, accountDigit, accountType = "checking" } = body;

    if (!payerId || !bankCode || !agency || !accountNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Todos os campos são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = getBaseUrl();
    // Endpoint conforme documentação: POST /account com token do pagador na URL
    const requestUrl = `${baseUrl}/payer/${payerId}/account`;
    
    console.log("Creating account with TecnoSpeed API:", { 
      payerId, 
      bankCode, 
      agency, 
      accountNumber,
      requestUrl
    });

    // Payload conforme documentação oficial TecnoSpeed - array de contas
    const accountPayload = [
      {
        bankCode: bankCode,
        agency: agency.replace(/\D/g, ""),
        agencyDigit: agencyDigit || "",
        accountNumber: accountNumber.replace(/\D/g, ""),
        accountDac: accountDigit || "",
        convenioAgency: "",
        convenioNumber: "",
        remessaSequential: 0,
        accountPayment: false,
        webservice: false,
        recipientNotification: false,
        statementActived: true, // Obrigatório para Open Finance
      }
    ];

    console.log("Account payload:", JSON.stringify(accountPayload, null, 2));

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cnpj-sh": CNPJ_SH,
        "token-sh": TOKEN,
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
          JSON.stringify({ success: false, error: "Pagador não encontrado ou endpoint inválido." }),
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

    // Conforme documentação, resposta retorna array de accounts com accountHash e openfinanceLink
    const accounts = responseData.accounts || responseData;
    const firstAccount = Array.isArray(accounts) ? accounts[0] : accounts;
    
    const accountHash = firstAccount?.accountHash || firstAccount?.id;
    const consentLink = firstAccount?.openfinanceLink || firstAccount?.consentLink;

    console.log("Account created:", { accountHash, consentLink });

    // Save to bank_accounts if bankAccountId provided
    if (body.bankAccountId) {
      const { error: updateError } = await supabaseClient
        .from("bank_accounts")
        .update({ 
          plugbank_account_id: accountHash,
          account_hash: accountHash,
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
        accountId: accountHash,
        accountHash,
        consentLink,
        message: consentLink 
          ? "Conta cadastrada. Clique no link para autorizar no banco."
          : "Conta cadastrada com sucesso."
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
