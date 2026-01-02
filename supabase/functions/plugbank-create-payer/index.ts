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

    console.log("TecnoSpeed credentials check:", {
      hasToken: !!TOKEN,
      tokenLength: TOKEN?.length,
      hasLoginAuth: !!LOGIN_AUTH,
      loginAuthLength: LOGIN_AUTH?.length,
      environment: Deno.env.get("TECNOSPEED_ENVIRONMENT") || "sandbox",
    });

    if (!TOKEN || !LOGIN_AUTH) {
      console.error("Missing credentials - TOKEN or LOGIN_AUTH not set");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Credenciais TecnoSpeed não configuradas. Verifique TECNOSPEED_TOKEN e TECNOSPEED_LOGIN_AUTH." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { cpfCnpj, name, companyId, address } = body;

    if (!cpfCnpj || !name) {
      return new Response(
        JSON.stringify({ success: false, error: "CNPJ e nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = getBaseUrl();
    const requestUrl = `${baseUrl}/customers`;
    
    console.log("Creating payer with TecnoSpeed API:", { 
      cpfCnpj: cpfCnpj.substring(0, 6) + "...", 
      name,
      requestUrl,
      environment: Deno.env.get("TECNOSPEED_ENVIRONMENT") || "sandbox",
    });

    const payerPayload = {
      cpfCnpj: cpfCnpj.replace(/\D/g, ""),
      name,
      ...(address && {
        address: {
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode?.replace(/\D/g, ""),
        }
      }),
    };

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
        "LoginAuth": LOGIN_AUTH,
      },
      body: JSON.stringify(payerPayload),
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
          JSON.stringify({ 
            success: false, 
            error: "Token inválido ou sem permissão. Verifique as credenciais TecnoSpeed.",
            code: response.status
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Endpoint não encontrado. Verifique a configuração da API TecnoSpeed.",
            code: 404
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 422) {
        return new Response(
          JSON.stringify({ success: false, error: responseData.message || "Dados inválidos", code: 422 }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: responseData.message || responseData.error || "Erro ao cadastrar pagador",
          code: response.status
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payerId = responseData.id || responseData.customerId || responseData.payerId;

    // Update company_settings with payer ID
    if (companyId && payerId) {
      const { error: updateError } = await supabaseClient
        .from("company_settings")
        .update({ 
          plugbank_payer_id: payerId,
          plugbank_status: "registered"
        })
        .eq("id", companyId);

      if (updateError) {
        console.error("Error updating company_settings:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        payerId,
        message: "Empresa registrada com sucesso no Open Finance"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in plugbank-create-payer:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
