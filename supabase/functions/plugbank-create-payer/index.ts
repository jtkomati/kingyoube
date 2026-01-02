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
    const { cpfCnpj, name, address } = body;

    if (!cpfCnpj || !name) {
      return new Response(
        JSON.stringify({ success: false, error: "CPF/CNPJ e Nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating payer with PlugBank API:", { cpfCnpj, name });

    const payerPayload = {
      cpfCnpj: cpfCnpj.replace(/\D/g, ""),
      name,
      address: address || {},
      statementActived: true,
    };

    const response = await fetch(`${PLUGBANK_BASE_URL}/payers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cnpj-sh": CNPJ_SH,
        "token-sh": TOKEN_SH,
      },
      body: JSON.stringify(payerPayload),
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
          JSON.stringify({ success: false, error: responseData.message || "Dados inválidos" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: responseData.message || "Erro ao cadastrar pagador" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payerId = responseData.id || responseData.payerId;

    // Update company_settings with payer ID
    if (payerId && body.companyId) {
      const { error: updateError } = await supabaseClient
        .from("company_settings")
        .update({ 
          plugbank_payer_id: payerId,
          plugbank_status: "registered"
        })
        .eq("id", body.companyId);

      if (updateError) {
        console.error("Error updating company_settings:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        payerId,
        message: "Pagador cadastrado com sucesso"
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
