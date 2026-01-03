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
      paymentForm,
      barcode,
      dueDate,
      paymentDate,
      nominalAmount,
      discountAmount,
      feeAmount,
      amount,
      beneficiaryName,
      beneficiaryCpfCnpj,
      avalistaName,
      avalistaCpfCnpj,
      transactionId,
      description,
      tags
    } = body;

    // Validate required fields
    if (!accountHash || !barcode || !amount) {
      return new Response(
        JSON.stringify({ error: "accountHash, barcode e amount são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating billet payment for account:", accountHash);

    // Build the payment payload for TecnoSpeed
    const paymentPayload: Record<string, unknown> = {
      accountHash,
      paymentForm: paymentForm || "30", // 30 = Títulos de terceiros
      barcode,
      dueDate,
      paymentDate,
      nominalAmount: nominalAmount || amount,
      amount,
      beneficiary: {
        name: beneficiaryName,
        cpfCnpj: beneficiaryCpfCnpj
      }
    };

    if (discountAmount) paymentPayload.discountAmount = discountAmount;
    if (feeAmount) paymentPayload.feeAmount = feeAmount;
    if (avalistaName && avalistaCpfCnpj) {
      paymentPayload.avalistaName = avalistaName;
      paymentPayload.avalistaCpfCnpj = avalistaCpfCnpj;
    }

    const baseUrl = getBaseUrl();
    console.log("Sending request to TecnoSpeed:", `${baseUrl}/payment/billet`);

    const response = await fetch(`${baseUrl}/payment/billet`, {
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
          error: responseData.message || "Erro ao criar pagamento", 
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract uniqueId from response
    const uniqueId = responseData.uniqueId || responseData.data?.uniqueId;

    // Save payment to database using service role for insert
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: payment, error: insertError } = await serviceClient
      .from("bank_payments")
      .insert({
        company_id: companyId,
        transaction_id: transactionId || null,
        unique_id: uniqueId,
        account_hash: accountHash,
        payment_type: "BILLET",
        payment_form: paymentForm || "30",
        status: "CREATED",
        description,
        barcode,
        due_date: dueDate,
        payment_date: paymentDate,
        nominal_amount: nominalAmount,
        discount_amount: discountAmount,
        fee_amount: feeAmount,
        amount,
        beneficiary_name: beneficiaryName,
        beneficiary_cpf_cnpj: beneficiaryCpfCnpj,
        tags,
        metadata: { tecnospeedResponse: responseData }
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving payment to database:", insertError);
      // Still return success since TecnoSpeed accepted the payment
    }

    console.log("Billet payment created successfully:", uniqueId);

    return new Response(
      JSON.stringify({
        success: true,
        uniqueId,
        paymentId: payment?.id,
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
