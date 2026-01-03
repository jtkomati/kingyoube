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

    // FIXED: Correctly read status from nested responseData.statement.status
    const rawStatus = responseData.statement?.status ?? responseData.status ?? "PROCESSING";
    const isCompleted = rawStatus === "SUCCESS" || rawStatus === "CONCLUDED" || rawStatus === "COMPLETED";

    console.log("Statement parsing:", { 
      uniqueId, 
      rawStatus, 
      isCompleted,
      hasStatement: !!responseData.statement,
      hasTransaction: !!responseData.transaction,
      hasTransactionDuplicated: !!responseData.transactionDuplicated
    });

    // Extract transactions correctly from provider response
    // Provider returns: transaction.credit[], transaction.debit[], transactionDuplicated.credit[], transactionDuplicated.debit[]
    // Use transactionDuplicated if available (contains all transactions including duplicates check)
    const txSource = responseData.transactionDuplicated?.credit?.length || responseData.transactionDuplicated?.debit?.length
      ? responseData.transactionDuplicated
      : responseData.transaction;
    
    const rawCredits = txSource?.credit || [];
    const rawDebits = txSource?.debit || [];

    // Normalize transactions to the format expected by frontend
    // deno-lint-ignore no-explicit-any
    const normalizedCredits = rawCredits.map((t: any) => ({
      id: t.transactionId || t.id,
      date: t.date,
      description: t.description || t.memo || t.category || t.code || "Crédito",
      amount: Math.abs(parseFloat(t.amount) || 0),
      document: t.paymentName || t.fitid || t.transactionId || null,
    }));

    // deno-lint-ignore no-explicit-any
    const normalizedDebits = rawDebits.map((t: any) => ({
      id: t.transactionId || t.id,
      date: t.date,
      description: t.description || t.memo || t.category || t.code || "Débito",
      amount: Math.abs(parseFloat(t.amount) || 0),
      document: t.paymentName || t.fitid || t.transactionId || null,
    }));

    const totalCredits = normalizedCredits.reduce((sum: number, t: {amount: number}) => sum + t.amount, 0);
    const totalDebits = normalizedDebits.reduce((sum: number, t: {amount: number}) => sum + t.amount, 0);

    console.log("Normalized transactions:", { 
      creditsCount: normalizedCredits.length, 
      debitsCount: normalizedDebits.length,
      totalCredits,
      totalDebits
    });

    // Update sync protocol status with service client (bypass RLS)
    if (uniqueId) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const updateData: Record<string, unknown> = { status: rawStatus };
      if (isCompleted) {
        updateData.completed_at = new Date().toISOString();
        updateData.records_imported = normalizedCredits.length + normalizedDebits.length;
      }

      const { error: syncError } = await serviceClient
        .from("sync_protocols")
        .update(updateData)
        .eq("plugbank_unique_id", uniqueId);

      if (syncError) {
        console.error("Failed to update sync_protocols:", syncError);
      } else {
        console.log("sync_protocols updated:", { uniqueId, status: rawStatus, isCompleted });
      }
    }

    // If completed, process and save transactions, and update account status
    if (isCompleted && bankAccountId) {
      // Auto-reconcile: mark account as connected since statement was successfully retrieved
      // Using service role to bypass RLS restrictions
      const updateResult = await updateBankAccountStatus(bankAccountId, "connected", user.id, companyId);
      if (!updateResult.success) {
        console.error("Failed to update bank account status:", updateResult.error);
      }

      // Save transactions to bank_statements using service client
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const allTransactions = [
        ...normalizedCredits.map((t: Record<string, unknown>) => ({ ...t, type: "credit" as const })),
        ...normalizedDebits.map((t: Record<string, unknown>) => ({ ...t, type: "debit" as const })),
      ];

      console.log("Saving transactions to bank_statements:", { count: allTransactions.length });

      for (const transaction of allTransactions) {
        const { error: insertError } = await serviceClient
          .from("bank_statements")
          .upsert({
            bank_account_id: bankAccountId,
            external_id: transaction.id || `${transaction.date}-${transaction.amount}-${transaction.description}`,
            statement_date: transaction.date,
            description: transaction.description,
            amount: transaction.type === "credit" ? Math.abs(Number(transaction.amount)) : -Math.abs(Number(transaction.amount)),
            type: transaction.type,
            imported_by: user.id,
            imported_at: new Date().toISOString(),
          }, { onConflict: "external_id" });

        if (insertError) {
          console.error("Failed to insert transaction:", insertError, transaction);
        }
      }

      console.log("Transactions saved successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: rawStatus,
        isCompleted,
        credits: normalizedCredits,
        debits: normalizedDebits,
        totalCredits,
        totalDebits,
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
