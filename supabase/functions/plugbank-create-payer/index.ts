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

    console.log("TecnoSpeed credentials check:", {
      hasToken: !!TOKEN,
      tokenLength: TOKEN?.length,
      hasCnpjSh: !!CNPJ_SH,
      cnpjShLength: CNPJ_SH?.length,
      environment: Deno.env.get("TECNOSPEED_ENVIRONMENT") || "staging",
    });

    if (!TOKEN || !CNPJ_SH) {
      console.error("Missing credentials - TOKEN or CNPJ_SH not set");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Credenciais TecnoSpeed não configuradas. Verifique TECNOSPEED_TOKEN e TECNOSPEED_CNPJ_SOFTWAREHOUSE." 
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

    // Validar campos de endereço obrigatórios conforme documentação
    if (!address?.neighborhood || !address?.number || !address?.zipCode || !address?.state || !address?.city) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Endereço completo é obrigatório: bairro, número, CEP, estado e cidade" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = getBaseUrl();
    const requestUrl = `${baseUrl}/payer`;
    
    console.log("Creating payer with TecnoSpeed API:", { 
      cpfCnpj: cpfCnpj.substring(0, 6) + "...", 
      name,
      requestUrl,
      environment: Deno.env.get("TECNOSPEED_ENVIRONMENT") || "staging",
    });

    // Payload conforme documentação oficial TecnoSpeed
    const payerPayload = {
      name: name,
      cpfCnpj: cpfCnpj.replace(/\D/g, ""),
      neighborhood: address.neighborhood,
      addressNumber: address.number,
      zipcode: address.zipCode.replace(/\D/g, ""),
      state: address.state,
      city: address.city,
      statementActived: true, // Obrigatório para Open Finance
    };

    console.log("Payer payload:", payerPayload);

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cnpjsh": CNPJ_SH,
        "tokensh": TOKEN,
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

    // Conforme documentação, resposta retorna token do pagador
    const payerId = responseData.token || responseData.id || responseData.payerId;

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
