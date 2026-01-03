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

// Helper to get payer CNPJ from company_settings
// deno-lint-ignore no-explicit-any
async function getPayerCnpj(supabaseClient: any, companyId?: string, bankAccountId?: string): Promise<string | null> {
  let targetCompanyId = companyId;
  
  // If no companyId, try to get it from bank_accounts
  if (!targetCompanyId && bankAccountId) {
    const { data: bankAccount } = await supabaseClient
      .from("bank_accounts")
      .select("company_id")
      .eq("id", bankAccountId)
      .single();
    
    if (bankAccount?.company_id) {
      targetCompanyId = bankAccount.company_id;
    }
  }
  
  if (!targetCompanyId) {
    return null;
  }
  
  const { data: company } = await supabaseClient
    .from("company_settings")
    .select("cnpj")
    .eq("id", targetCompanyId)
    .single();
  
  if (company?.cnpj) {
    // Normalize CNPJ - remove all non-digits
    return company.cnpj.replace(/\D/g, "");
  }
  
  return null;
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
    const { accountHash, startDate, endDate, bankAccountId, companyId } = body;

    if (!accountHash || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ success: false, error: "Hash da conta e período são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get payer CNPJ from company_settings
    const payerCnpj = await getPayerCnpj(supabaseClient, companyId, bankAccountId);
    
    if (!payerCnpj) {
      console.error("Missing payer CNPJ - companyId:", companyId, "bankAccountId:", bankAccountId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "CNPJ da empresa não encontrado. Verifique se o CNPJ está cadastrado nas configurações da empresa." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payerCnpj.length !== 14) {
      console.error("Invalid payer CNPJ length:", payerCnpj.length);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "CNPJ da empresa inválido. O CNPJ deve ter 14 dígitos." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = getBaseUrl();
    const requestUrl = `${baseUrl}/statement/openfinance`;
    
    console.log("Requesting statement from TecnoSpeed:", { 
      accountHash, 
      startDate, 
      endDate, 
      requestUrl, 
      payerCnpj: payerCnpj.substring(0, 4) + "****" 
    });

    // Payload conforme documentação
    const statementPayload = {
      accountHash: accountHash,
      startDate: startDate, // formato: YYYY-MM-DD
      endDate: endDate,     // formato: YYYY-MM-DD
    };

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cnpjsh": CNPJ_SH,
        "tokensh": TOKEN,
        "payercpfcnpj": payerCnpj,  // Header obrigatório do pagador
      },
      body: JSON.stringify(statementPayload),
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
      const errorMessage = responseData.message || responseData.error || "Erro ao solicitar extrato";
      
      if (response.status === 401) {
        // Check if it's a payer CNPJ issue
        if (errorMessage.toLowerCase().includes("pagador") || errorMessage.toLowerCase().includes("payer")) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "CNPJ do pagador inválido ou empresa não registrada no Open Finance. Verifique o cadastro." 
            }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido. Verifique as configurações." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: "Conta não encontrada ou endpoint inválido." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 422) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Você precisa reconectar sua conta bancária. Clique em 'Autorizar' para dar consentimento novamente.",
            needsConsent: true
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
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
