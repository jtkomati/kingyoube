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
    const method = req.method;
    const accountHash = url.searchParams.get("accountHash");

    const baseUrl = getBaseUrl();

    // Handle different HTTP methods
    if (method === "GET") {
      // Get certificate info
      if (!accountHash) {
        return new Response(
          JSON.stringify({ error: "accountHash é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${baseUrl}/account/${accountHash}/certificate`, {
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
          JSON.stringify({ error: responseData.message || "Erro ao buscar certificado", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, certificate: responseData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "POST") {
      // Create/Upload certificate
      const body = await req.json();
      const { companyId, accountHash: bodyAccountHash, certificateBase64, password, type } = body;

      if (!bodyAccountHash || !certificateBase64 || !password) {
        return new Response(
          JSON.stringify({ error: "accountHash, certificateBase64 e password são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Uploading certificate for account:", bodyAccountHash);

      const response = await fetch(`${baseUrl}/account/${bodyAccountHash}/certificate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
        body: JSON.stringify({
          certificate: certificateBase64,
          password,
          type: type || "pfx"
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: responseData.message || "Erro ao enviar certificado", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save certificate info to database
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: cert } = await serviceClient
        .from("payment_certificates")
        .insert({
          company_id: companyId,
          account_hash: bodyAccountHash,
          common_name: responseData.commonName || responseData.data?.commonName,
          expiration_date: responseData.expirationDate || responseData.data?.expirationDate,
          active: true
        })
        .select()
        .single();

      console.log("Certificate uploaded successfully");

      return new Response(
        JSON.stringify({ success: true, certificateId: cert?.id, certificate: responseData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "PUT") {
      // Update certificate
      const body = await req.json();
      const { accountHash: bodyAccountHash, certificateBase64, password, type } = body;

      if (!bodyAccountHash || !certificateBase64 || !password) {
        return new Response(
          JSON.stringify({ error: "accountHash, certificateBase64 e password são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${baseUrl}/account/${bodyAccountHash}/certificate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
        body: JSON.stringify({
          certificate: certificateBase64,
          password,
          type: type || "pfx"
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: responseData.message || "Erro ao atualizar certificado", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update certificate in database
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await serviceClient
        .from("payment_certificates")
        .update({
          common_name: responseData.commonName || responseData.data?.commonName,
          expiration_date: responseData.expirationDate || responseData.data?.expirationDate,
          updated_at: new Date().toISOString()
        })
        .eq("account_hash", bodyAccountHash);

      return new Response(
        JSON.stringify({ success: true, certificate: responseData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "DELETE") {
      if (!accountHash) {
        return new Response(
          JSON.stringify({ error: "accountHash é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${baseUrl}/account/${accountHash}/certificate`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
      });

      if (!response.ok) {
        const responseData = await response.json();
        return new Response(
          JSON.stringify({ error: responseData.message || "Erro ao deletar certificado", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deactivate certificate in database
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await serviceClient
        .from("payment_certificates")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("account_hash", accountHash);

      return new Response(
        JSON.stringify({ success: true, message: "Certificado deletado com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
