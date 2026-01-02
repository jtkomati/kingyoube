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

    const { 
      transaction_id, 
      service_code, 
      service_description, 
      gross_amount, 
      reason 
    } = await req.json();

    console.log("Replace NFS-e request:", { transaction_id, reason });

    // Validate required fields
    if (!transaction_id) {
      return new Response(
        JSON.stringify({ error: "transaction_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reason || reason.length < 15) {
      return new Response(
        JSON.stringify({ error: "Motivo deve ter no mínimo 15 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get original transaction
    const { data: originalTransaction, error: txError } = await supabase
      .from("transactions")
      .select("*, customers!customer_id(*)")
      .eq("id", transaction_id)
      .single();

    if (txError || !originalTransaction) {
      console.error("Error fetching transaction:", txError);
      return new Response(
        JSON.stringify({ error: "Transação não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invoice exists and is issued
    if (!originalTransaction.invoice_number || originalTransaction.invoice_status !== "issued") {
      return new Response(
        JSON.stringify({ error: "Apenas notas emitidas podem ser substituídas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get fiscal config
    const { data: fiscalConfig, error: configError } = await supabase
      .from("config_fiscal")
      .select("plugnotas_token, plugnotas_environment")
      .eq("company_id", originalTransaction.company_id)
      .maybeSingle();

    if (configError || !fiscalConfig?.plugnotas_token) {
      console.error("PlugNotas not configured:", configError);
      return new Response(
        JSON.stringify({ 
          error: "PlugNotas não configurado para esta empresa",
          requires_configuration: true 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isProduction = fiscalConfig.plugnotas_environment === "PRODUCAO";
    const plugnotasBaseUrl = isProduction
      ? "https://api.plugnotas.com.br"
      : "https://api.sandbox.plugnotas.com.br";

    // Get integrationId from original transaction
    const integrationId = originalTransaction.invoice_integration_id;
    if (!integrationId) {
      return new Response(
        JSON.stringify({ error: "ID de integração não encontrado na nota original" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, check if city supports substitution by trying to get NFS-e status
    console.log("Checking original NFS-e status...");
    const statusResponse = await fetch(`${plugnotasBaseUrl}/nfse/${integrationId}`, {
      method: "GET",
      headers: {
        "x-api-key": fiscalConfig.plugnotas_token,
        "Content-Type": "application/json",
      },
    });

    if (!statusResponse.ok) {
      const statusError = await statusResponse.text();
      console.error("Error checking NFS-e status:", statusError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar status da nota original" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to substitute the invoice
    console.log("Attempting NFS-e substitution...");
    
    const substitutePayload = {
      motivo: reason,
      servicoDescricao: service_description || originalTransaction.service_description || originalTransaction.description,
      servicoCodigo: service_code || originalTransaction.service_code,
      servicoValorUnitario: gross_amount || originalTransaction.gross_amount,
    };

    console.log("Substitute payload:", substitutePayload);

    const substituteResponse = await fetch(`${plugnotasBaseUrl}/nfse/${integrationId}/substituir`, {
      method: "POST",
      headers: {
        "x-api-key": fiscalConfig.plugnotas_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(substitutePayload),
    });

    const substituteResult = await substituteResponse.json();
    console.log("PlugNotas substitute response:", substituteResult);

    // Check if city doesn't support substitution
    if (!substituteResponse.ok) {
      if (substituteResponse.status === 400 || substituteResponse.status === 422) {
        const errorMessage = substituteResult.message || substituteResult.erro || "Erro desconhecido";
        
        // Check for common "not supported" messages
        if (errorMessage.includes("não suportada") || 
            errorMessage.includes("não permitida") ||
            errorMessage.includes("substituição não disponível") ||
            errorMessage.includes("cidade não suporta")) {
          return new Response(
            JSON.stringify({ 
              error: "Substituição não suportada pela prefeitura desta cidade",
              suggestion: "Cancele a nota e emita uma nova",
              city_support: false 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao processar substituição" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get new integration ID from response
    const newIntegrationId = substituteResult.id || substituteResult.idIntegracao;

    // Update original transaction status
    await supabase
      .from("transactions")
      .update({
        invoice_status: "replaced",
        invoice_replaced_by: newIntegrationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction_id);

    // Create new transaction for the replacement invoice
    const { data: newTransaction, error: newTxError } = await supabase
      .from("transactions")
      .insert({
        company_id: originalTransaction.company_id,
        type: "RECEIVABLE",
        description: `[SUBSTITUIÇÃO] ${service_description || originalTransaction.description}`,
        gross_amount: gross_amount || originalTransaction.gross_amount,
        net_amount: gross_amount || originalTransaction.net_amount,
        due_date: originalTransaction.due_date,
        customer_id: originalTransaction.customer_id,
        category_id: originalTransaction.category_id,
        service_code: service_code || originalTransaction.service_code,
        service_description: service_description || originalTransaction.service_description,
        invoice_status: "processing",
        invoice_integration_id: newIntegrationId,
        invoice_environment: fiscalConfig.plugnotas_environment,
        invoice_replaces: transaction_id,
      })
      .select()
      .single();

    if (newTxError) {
      console.error("Error creating replacement transaction:", newTxError);
    }

    // Log the substitution
    await supabase.from("sync_logs").insert({
      company_id: originalTransaction.company_id,
      source: "plugnotas",
      direction: "outbound",
      status: "success",
      records_synced: 1,
      details: {
        action: "substitute_nfse",
        original_transaction_id: transaction_id,
        original_invoice_number: originalTransaction.invoice_number,
        new_integration_id: newIntegrationId,
        reason: reason,
      },
    });

    // Create audit log
    await supabase.from("audit_logs").insert({
      action: "NFSE_SUBSTITUTED",
      details: JSON.stringify({
        original_invoice: originalTransaction.invoice_number,
        new_integration_id: newIntegrationId,
        reason: reason,
        amount: gross_amount || originalTransaction.gross_amount,
      }),
      organization_id: originalTransaction.company_id,
      user_role: "FISCAL",
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Substituição de NFS-e iniciada com sucesso",
        original_invoice: originalTransaction.invoice_number,
        new_integration_id: newIntegrationId,
        new_transaction_id: newTransaction?.id,
        status: "processing",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in replace-nfse:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao substituir NFS-e";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
