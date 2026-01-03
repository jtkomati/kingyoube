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
      console.error("Authentication error:", userError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const TOKEN = Deno.env.get("TECNOSPEED_TOKEN");
    const CNPJ_SH = Deno.env.get("TECNOSPEED_CNPJ_SOFTWAREHOUSE");

    if (!TOKEN || !CNPJ_SH) {
      console.error("Missing TecnoSpeed credentials");
      return new Response(
        JSON.stringify({ error: "Credenciais TecnoSpeed não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      companyId,
      accountHash,
      uniqueIds,
      remessaType
    } = body;

    // Validate required fields
    if (!accountHash) {
      return new Response(
        JSON.stringify({ error: "accountHash é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating remessa for account:", accountHash);

    // Build the remessa payload
    const remessaPayload: Record<string, unknown> = {
      accountHash,
    };

    // Add specific uniqueIds if provided, otherwise generate for all pending payments
    if (uniqueIds && uniqueIds.length > 0) {
      remessaPayload.uniqueIds = uniqueIds;
    }

    // Add remessa type if specified (DEFAULT, WEBSERVICE, etc)
    if (remessaType) {
      remessaPayload.remessaType = remessaType;
    }

    const baseUrl = getBaseUrl();
    console.log("Sending request to TecnoSpeed:", `${baseUrl}/remessa`);

    const response = await fetch(`${baseUrl}/remessa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cnpj-sh": CNPJ_SH,
        "token-sh": TOKEN,
      },
      body: JSON.stringify(remessaPayload),
    });

    const responseText = await response.text();
    console.log("TecnoSpeed response status:", response.status);
    console.log("TecnoSpeed response:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse TecnoSpeed response");
      return new Response(
        JSON.stringify({ error: "Resposta inválida da API TecnoSpeed", details: responseText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: responseData.message || "Erro ao gerar remessa", 
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract protocol and file content from response
    const protocol = responseData.protocol || responseData.data?.protocol;
    const fileContent = responseData.fileContent || responseData.data?.fileContent;

    // Save remessa to database using service role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: remessa, error: insertError } = await serviceClient
      .from("payment_remessas")
      .insert({
        company_id: companyId,
        account_hash: accountHash,
        protocol,
        status: "GENERATED",
        remessa_type: remessaType || "DEFAULT",
        unique_ids: uniqueIds || [],
        file_content: fileContent,
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving remessa to database:", insertError);
    }

    // Update payment statuses to SENT
    if (uniqueIds && uniqueIds.length > 0) {
      const { error: updateError } = await serviceClient
        .from("bank_payments")
        .update({ 
          status: "SENT",
          remittance_linked: { protocol, generatedAt: new Date().toISOString() }
        })
        .in("unique_id", uniqueIds);

      if (updateError) {
        console.error("Error updating payment statuses:", updateError);
      }
    }

    console.log("Remessa generated successfully:", protocol);

    return new Response(
      JSON.stringify({
        success: true,
        protocol,
        remessaId: remessa?.id,
        fileContent,
        tecnospeedResponse: responseData
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
