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

// Helper to get payer CNPJ from company_settings via bank_account
// deno-lint-ignore no-explicit-any
async function getPayerCnpjFromBankAccount(supabaseClient: any, bankAccountId?: string): Promise<string | null> {
  if (!bankAccountId) {
    return null;
  }
  
  const { data: bankAccount } = await supabaseClient
    .from("bank_accounts")
    .select("company_id")
    .eq("id", bankAccountId)
    .single();
  
  if (!bankAccount?.company_id) {
    return null;
  }
  
  const { data: company } = await supabaseClient
    .from("company_settings")
    .select("cnpj")
    .eq("id", bankAccount.company_id)
    .single();
  
  if (company?.cnpj) {
    // Normalize CNPJ - remove all non-digits
    return company.cnpj.replace(/\D/g, "");
  }
  
  return null;
}

// Helper to update bank account status using service role (bypasses RLS)
async function updateBankAccountStatus(
  bankAccountId: string, 
  status: string,
  userId: string,
  companyId?: string
): Promise<{ success: boolean; error?: string }> {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { error: updateError } = await serviceClient
      .from("bank_accounts")
      .update({ 
        open_finance_status: status,
        last_sync_at: new Date().toISOString()
      })
      .eq("id", bankAccountId);

    if (updateError) {
      console.error("Service role update failed:", updateError);
      
      // Log to application_logs for debugging
      await serviceClient.from("application_logs").insert({
        level: "error",
        source: "edge-function",
        function_name: "plugbank-get-statement",
        message: `Failed to update bank_account status: ${updateError.message}`,
        user_id: userId,
        organization_id: companyId,
        context: { bankAccountId, status, errorCode: updateError.code }
      });
      
      return { success: false, error: updateError.message };
    }

    console.log(`Bank account ${bankAccountId} status updated to ${status} via service role`);
    return { success: true };
  } catch (err) {
    console.error("Unexpected error in updateBankAccountStatus:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // User client for authentication and access validation
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
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

    // Validate user access to the bank account via RLS (userClient)
    let companyId: string | undefined;
    if (bankAccountId) {
      const { data: accessCheck, error: accessError } = await userClient
        .from("bank_accounts")
        .select("id, company_id")
        .eq("id", bankAccountId)
        .single();

      if (accessError || !accessCheck) {
        console.error("User does not have access to bank account:", bankAccountId, accessError);
        return new Response(
          JSON.stringify({ success: false, error: "Você não tem acesso a esta conta bancária" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      companyId = accessCheck.company_id;
    }

    // Get payer CNPJ from bank account's company
    const payerCnpj = await getPayerCnpjFromBankAccount(userClient, bankAccountId);
    
    if (!payerCnpj) {
      console.error("Missing payer CNPJ for bankAccountId:", bankAccountId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "CNPJ da empresa não encontrado. Verifique se o CNPJ está cadastrado nas configurações da empresa." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = getBaseUrl();
    const requestUrl = `${baseUrl}/statement/openfinance/${uniqueId}`;
    
    console.log("Fetching statement from TecnoSpeed:", { 
      uniqueId, 
      requestUrl,
      payerCnpj: payerCnpj.substring(0, 4) + "****" 
    });

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "cnpjsh": CNPJ_SH,
        "tokensh": TOKEN,
        "payercpfcnpj": payerCnpj,  // Header obrigatório do pagador
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
      const errorMessage = responseData.message || responseData.error || "Erro ao buscar extrato";
      
      if (response.status === 401) {
        // Check if it's a payer CNPJ issue
        if (errorMessage.toLowerCase().includes("pagador") || errorMessage.toLowerCase().includes("payer")) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "CNPJ do pagador inválido ou empresa não registrada no Open Finance." 
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
          JSON.stringify({ success: false, error: "Protocolo não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const status = responseData.status || "PROCESSING";
    const isCompleted = status === "CONCLUDED" || status === "COMPLETED" || status === "SUCCESS";

    // Update sync protocol status (uses userClient)
    if (uniqueId) {
      const updateData: Record<string, unknown> = { status };
      if (isCompleted) {
        updateData.completed_at = new Date().toISOString();
        updateData.records_imported = 
          (responseData.credits?.length || 0) + (responseData.debits?.length || 0);
      }

      await userClient
        .from("sync_protocols")
        .update(updateData)
        .eq("plugbank_unique_id", uniqueId);
    }

    // If completed, process and save transactions, and update account status
    if (isCompleted && bankAccountId) {
      // Auto-reconcile: mark account as connected since statement was successfully retrieved
      // Using service role to bypass RLS restrictions
      const updateResult = await updateBankAccountStatus(bankAccountId, "connected", user.id, companyId);
      if (!updateResult.success) {
        console.error("Failed to update bank account status:", updateResult.error);
      }

      const credits = responseData.credits || [];
      const debits = responseData.debits || [];
      const allTransactions = [
        ...credits.map((t: Record<string, unknown>) => ({ ...t, type: "credit" })),
        ...debits.map((t: Record<string, unknown>) => ({ ...t, type: "debit" })),
      ];

      for (const transaction of allTransactions) {
        await userClient
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
