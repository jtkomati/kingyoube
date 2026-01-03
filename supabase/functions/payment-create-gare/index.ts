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
      revenueCode,
      paymentDate,
      dueDate,
      amount,
      nominalAmount,
      contributorDocument,
      stateRegistration,
      activeDebit,
      referencePeriod,
      installment,
      interestAmount,
      fineAmount,
      increaseAmount,
      honoraryAmount,
      transactionId,
      description,
      tags
    } = body;

    if (!accountHash || !revenueCode || !contributorDocument || !amount) {
      return new Response(
        JSON.stringify({ error: "accountHash, revenueCode, contributorDocument e amount são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating GARE payment for account:", accountHash);

    const paymentPayload: Record<string, unknown> = {
      accountHash,
      revenueCode,
      paymentDate,
      dueDate: dueDate || paymentDate,
      amount,
      nominalAmount: nominalAmount || amount,
      contributorDocument,
      stateRegistration,
      referencePeriod
    };

    if (activeDebit) paymentPayload.activeDebit = activeDebit;
    if (installment) paymentPayload.installment = installment;
    if (interestAmount) paymentPayload.interestAmount = interestAmount;
    if (fineAmount) paymentPayload.fineAmount = fineAmount;
    if (increaseAmount) paymentPayload.increaseAmount = increaseAmount;
    if (honoraryAmount) paymentPayload.honoraryAmount = honoraryAmount;

    const baseUrl = getBaseUrl();
    console.log("Sending GARE request to TecnoSpeed");

    const response = await fetch(`${baseUrl}/payment/taxes/gare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cnpj-sh": CNPJ_SH,
        "token-sh": TOKEN,
      },
      body: JSON.stringify(paymentPayload),
    });

    const responseText = await response.text();
    console.log("TecnoSpeed response status:", response.status);

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
        JSON.stringify({ error: responseData.message || "Erro ao criar GARE", details: responseData }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uniqueId = responseData.uniqueId || responseData.data?.uniqueId;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: payment } = await serviceClient
      .from("bank_payments")
      .insert({
        company_id: companyId,
        transaction_id: transactionId || null,
        unique_id: uniqueId,
        account_hash: accountHash,
        payment_type: "GARE",
        payment_form: "22",
        status: "CREATED",
        description,
        due_date: dueDate,
        payment_date: paymentDate,
        nominal_amount: nominalAmount,
        interest_amount: interestAmount,
        fine_amount: fineAmount,
        amount,
        beneficiary_name: "SEFAZ Estadual",
        beneficiary_cpf_cnpj: contributorDocument,
        tags,
        metadata: { tecnospeedResponse: responseData, revenueCode, stateRegistration }
      })
      .select()
      .single();

    await serviceClient.from("tax_payments").insert({
      company_id: companyId,
      bank_payment_id: payment?.id,
      tax_type: "GARE",
      revenue_code: revenueCode,
      contributor_document: contributorDocument,
      reference_period: referencePeriod,
      state_registration: stateRegistration,
      active_debit: activeDebit,
      installment,
      increase_amount: increaseAmount,
      honorary_amount: honoraryAmount
    });

    console.log("GARE payment created successfully:", uniqueId);

    return new Response(
      JSON.stringify({ success: true, uniqueId, paymentId: payment?.id, tecnospeedResponse: responseData }),
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
