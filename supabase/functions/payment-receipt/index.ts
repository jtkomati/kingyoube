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
    const action = url.searchParams.get("action") || "request";
    const baseUrl = getBaseUrl();

    if (action === "request" && req.method === "POST") {
      // Request receipt for a payment
      const body = await req.json();
      const { uniqueId } = body;

      if (!uniqueId) {
        return new Response(
          JSON.stringify({ error: "uniqueId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Requesting receipt for payment:", uniqueId);

      const response = await fetch(`${baseUrl}/receipt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
        body: JSON.stringify({ uniqueId }),
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
          JSON.stringify({ error: responseData.message || "Erro ao solicitar comprovante", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Receipt request submitted successfully");

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Solicitação de comprovante enviada",
          status: responseData.status || "PROCESSING",
          tecnospeedResponse: responseData 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get") {
      // Get receipt for a payment
      const uniqueId = url.searchParams.get("uniqueId");
      const format = url.searchParams.get("format") || "pdf"; // pdf or base64

      if (!uniqueId) {
        return new Response(
          JSON.stringify({ error: "uniqueId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Getting receipt for payment:", uniqueId);

      const response = await fetch(`${baseUrl}/receipt?uniqueId=${uniqueId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
      });

      if (!response.ok) {
        const responseData = await response.json();
        return new Response(
          JSON.stringify({ error: responseData.message || "Erro ao buscar comprovante", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const contentType = response.headers.get("content-type");
      
      if (contentType?.includes("application/pdf") || format === "pdf") {
        // Return PDF as base64
        const arrayBuffer = await response.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            receiptBase64: base64,
            contentType: "application/pdf"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const responseData = await response.json();
        return new Response(
          JSON.stringify({ success: true, receipt: responseData }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Ação não suportada. Use action=request ou action=get" }),
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
