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

    const body = await req.json();
    const {
      companyId,
      accountHash,
      batchType,
      payments
    } = body;

    if (!accountHash || !payments || !Array.isArray(payments) || payments.length === 0) {
      return new Response(
        JSON.stringify({ error: "accountHash e payments (array) são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = getBaseUrl();
    let endpoint = "";
    
    // Determine endpoint based on batch type
    if (batchType === "paycheck") {
      endpoint = `${baseUrl}/payment/batch/paycheck`;
    } else if (batchType === "transfer") {
      endpoint = `${baseUrl}/payment/batch/transfer`;
    } else {
      return new Response(
        JSON.stringify({ error: "batchType deve ser 'paycheck' ou 'transfer'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating batch ${batchType} payment with ${payments.length} items`);

    // Prepare batch payload
    const batchPayload = {
      accountHash,
      payments: payments.map((p: Record<string, unknown>) => ({
        ...p,
        accountHash
      }))
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cnpj-sh": CNPJ_SH,
        "token-sh": TOKEN,
      },
      body: JSON.stringify(batchPayload),
    });

    const responseText = await response.text();
    console.log("TecnoSpeed batch response status:", response.status);

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
        JSON.stringify({ error: responseData.message || "Erro ao criar pagamento em lote", details: responseData }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save individual payments to database
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const createdPayments = responseData.payments || responseData.data?.payments || [];
    const savedPayments = [];

    for (let i = 0; i < createdPayments.length; i++) {
      const technoPayment = createdPayments[i];
      const originalPayment = payments[i];

      const { data: payment } = await serviceClient
        .from("bank_payments")
        .insert({
          company_id: companyId,
          unique_id: technoPayment.uniqueId,
          account_hash: accountHash,
          payment_type: batchType === "paycheck" ? "PAYCHECK" : "TRANSFER",
          payment_form: batchType === "paycheck" ? "30" : originalPayment.paymentForm || "41",
          status: "CREATED",
          description: originalPayment.description,
          due_date: originalPayment.dueDate,
          payment_date: originalPayment.paymentDate,
          amount: originalPayment.amount,
          beneficiary_name: originalPayment.beneficiaryName || originalPayment.beneficiary?.name,
          beneficiary_cpf_cnpj: originalPayment.beneficiaryCpfCnpj || originalPayment.beneficiary?.cpfCnpj,
          beneficiary_bank_code: originalPayment.beneficiaryBankCode || originalPayment.beneficiary?.bankCode,
          beneficiary_agency: originalPayment.beneficiaryAgency || originalPayment.beneficiary?.agency,
          beneficiary_account: originalPayment.beneficiaryAccount || originalPayment.beneficiary?.accountNumber,
          tags: ["batch", batchType],
          metadata: { 
            batchIndex: i,
            tecnospeedResponse: technoPayment
          }
        })
        .select()
        .single();

      if (payment) {
        savedPayments.push(payment);
      }
    }

    console.log(`Batch ${batchType} created successfully with ${savedPayments.length} payments`);

    return new Response(
      JSON.stringify({
        success: true,
        batchType,
        totalPayments: savedPayments.length,
        payments: savedPayments,
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
