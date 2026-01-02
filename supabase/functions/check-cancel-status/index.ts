import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { transaction_id } = await req.json();

    console.log("Check cancel status request:", { transaction_id });

    if (!transaction_id) {
      return new Response(
        JSON.stringify({ error: "transaction_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get transaction
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .single();

    if (txError || !transaction) {
      console.error("Error fetching transaction:", txError);
      return new Response(
        JSON.stringify({ error: "Transação não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if transaction has an integration ID
    const integrationId = transaction.invoice_integration_id;
    if (!integrationId) {
      return new Response(
        JSON.stringify({ error: "ID de integração não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get fiscal config
    const { data: fiscalConfig, error: configError } = await supabase
      .from("config_fiscal")
      .select("plugnotas_token, plugnotas_environment")
      .eq("company_id", transaction.company_id)
      .maybeSingle();

    if (configError || !fiscalConfig?.plugnotas_token) {
      console.error("PlugNotas not configured:", configError);
      return new Response(
        JSON.stringify({ 
          error: "PlugNotas não configurado",
          status: transaction.invoice_status,
          local_only: true 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isProduction = fiscalConfig.plugnotas_environment === "PRODUCAO";
    const plugnotasBaseUrl = isProduction
      ? "https://api.plugnotas.com.br"
      : "https://api.sandbox.plugnotas.com.br";

    // Query cancellation status from PlugNotas
    console.log("Querying cancellation status from PlugNotas...");
    
    const cancelStatusResponse = await fetch(`${plugnotasBaseUrl}/nfse/${integrationId}/cancelamento`, {
      method: "GET",
      headers: {
        "x-api-key": fiscalConfig.plugnotas_token,
        "Content-Type": "application/json",
      },
    });

    // Handle 404 - no cancellation request found
    if (cancelStatusResponse.status === 404) {
      return new Response(
        JSON.stringify({
          status: "not_requested",
          message: "Nenhum pedido de cancelamento encontrado para esta nota",
          invoice_number: transaction.invoice_number,
          invoice_status: transaction.invoice_status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cancelStatusResponse.ok) {
      const errorText = await cancelStatusResponse.text();
      console.error("Error from PlugNotas:", errorText);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao consultar status de cancelamento",
          details: errorText 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cancelData = await cancelStatusResponse.json();
    console.log("PlugNotas cancel status response:", cancelData);

    // Parse the response and determine status
    let cancelStatus = "pending";
    let processedAt = null;
    let protocol = null;
    let rejectionReason = null;

    // Handle different response formats from PlugNotas
    if (cancelData.situacao) {
      const situacao = cancelData.situacao.toLowerCase();
      if (situacao.includes("concluido") || situacao.includes("aprovado") || situacao.includes("cancelado")) {
        cancelStatus = "approved";
        processedAt = cancelData.dataCancelamento || cancelData.dataProcessamento;
      } else if (situacao.includes("rejeitado") || situacao.includes("erro")) {
        cancelStatus = "rejected";
        rejectionReason = cancelData.mensagem || cancelData.erro;
      } else if (situacao.includes("processando") || situacao.includes("pendente")) {
        cancelStatus = "pending";
      }
    }

    protocol = cancelData.protocolo || cancelData.protocoloCancelamento;

    // Update transaction if status changed to cancelled
    if (cancelStatus === "approved" && transaction.invoice_status !== "cancelled") {
      await supabase
        .from("transactions")
        .update({
          invoice_status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction_id);

      console.log("Transaction status updated to cancelled");
    }

    return new Response(
      JSON.stringify({
        status: cancelStatus,
        protocol: protocol,
        processed_at: processedAt,
        rejection_reason: rejectionReason,
        invoice_number: transaction.invoice_number,
        invoice_status: cancelStatus === "approved" ? "cancelled" : transaction.invoice_status,
        raw_response: cancelData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in check-cancel-status:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao consultar status de cancelamento";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
