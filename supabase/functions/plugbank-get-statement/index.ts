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
    const { uniqueId, bankAccountId } = body;

    if (!uniqueId) {
      return new Response(
        JSON.stringify({ success: false, error: "ID do protocolo é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = getBaseUrl();
    const requestUrl = `${baseUrl}/statement/openfinance/${uniqueId}`;
    
    console.log("Fetching statement from TecnoSpeed:", { uniqueId, requestUrl });

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "cnpj-sh": CNPJ_SH,
        "token-sh": TOKEN,
      },
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
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: "Protocolo não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: responseData.message || "Erro ao buscar extrato" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const status = responseData.status || "PROCESSING";
    const isCompleted = status === "CONCLUDED" || status === "COMPLETED" || status === "SUCCESS";

    // Update sync protocol status
    if (uniqueId) {
      const updateData: Record<string, unknown> = { status };
      if (isCompleted) {
        updateData.completed_at = new Date().toISOString();
        updateData.records_imported = 
          (responseData.credits?.length || 0) + (responseData.debits?.length || 0);
      }

      await supabaseClient
        .from("sync_protocols")
        .update(updateData)
        .eq("plugbank_unique_id", uniqueId);
    }

    // If completed, process and save transactions
    if (isCompleted && bankAccountId) {
      const credits = responseData.credits || [];
      const debits = responseData.debits || [];
      const allTransactions = [
        ...credits.map((t: Record<string, unknown>) => ({ ...t, type: "credit" })),
        ...debits.map((t: Record<string, unknown>) => ({ ...t, type: "debit" })),
      ];

      for (const transaction of allTransactions) {
        await supabaseClient
          .from("bank_statements")
          .upsert({
            bank_account_id: bankAccountId,
            external_id: transaction.id || transaction.transactionId || `${transaction.date}-${transaction.amount}`,
            statement_date: transaction.date,
            description: transaction.description || transaction.memo,
            amount: transaction.type === "credit" ? Math.abs(transaction.amount) : -Math.abs(transaction.amount),
            type: transaction.type,
            imported_by: user.id,
            imported_at: new Date().toISOString(),
          }, { onConflict: "external_id" });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status,
        isCompleted,
        credits: responseData.credits || [],
        debits: responseData.debits || [],
        totalCredits: responseData.credits?.reduce((sum: number, t: {amount: number}) => sum + (t.amount || 0), 0) || 0,
        totalDebits: responseData.debits?.reduce((sum: number, t: {amount: number}) => sum + (t.amount || 0), 0) || 0,
        message: isCompleted ? "Extrato processado com sucesso" : "Aguardando processamento..."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in plugbank-get-statement:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
