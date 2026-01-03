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

// Payment form codes for transfers
const PAYMENT_FORMS = {
  DOC: "01",
  DOC_OUTRA_TITULARIDADE: "03",
  TED: "41",
  TED_OUTRA_TITULARIDADE: "43",
  PIX_TRANSFERENCIA: "45",
  PIX_QR_CODE: "47",
  ORDEM_PAGAMENTO: "05",
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
      transferType,
      paymentDate,
      dueDate,
      amount,
      compensation,
      beneficiaryName,
      beneficiaryCpfCnpj,
      beneficiaryBankCode,
      beneficiaryAgency,
      beneficiaryAgencyDigit,
      beneficiaryAccount,
      beneficiaryAccountDigit,
      beneficiaryAccountType,
      // PIX specific fields
      pixType,
      pixKey,
      pixUrl,
      pixTxid,
      ispbCode,
      registrationComplement,
      // General fields
      transactionId,
      description,
      tags
    } = body;

    // Validate required fields
    if (!accountHash || !amount) {
      return new Response(
        JSON.stringify({ error: "accountHash e amount são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine payment form based on transfer type
    let paymentForm = PAYMENT_FORMS[transferType as keyof typeof PAYMENT_FORMS];
    if (!paymentForm) {
      paymentForm = PAYMENT_FORMS.TED; // Default to TED
    }

    console.log(`Creating ${transferType} transfer for account:`, accountHash);

    // Build the payment payload for TecnoSpeed
    const paymentPayload: Record<string, unknown> = {
      accountHash,
      paymentForm,
      paymentDate,
      dueDate: dueDate || paymentDate,
      amount,
      beneficiary: {
        name: beneficiaryName,
        cpfCnpj: beneficiaryCpfCnpj,
        bankCode: beneficiaryBankCode,
        agency: beneficiaryAgency,
        agencyDigit: beneficiaryAgencyDigit,
        accountNumber: beneficiaryAccount,
        accountNumberDigit: beneficiaryAccountDigit,
        accountType: beneficiaryAccountType || "checking"
      }
    };

    // Add compensation for TED/DOC
    if (compensation) {
      paymentPayload.compensation = compensation;
    }

    // Add PIX specific fields
    if (transferType === "PIX_TRANSFERENCIA" || transferType === "PIX_QR_CODE") {
      if (pixType) paymentPayload.pixType = pixType;
      if (pixKey) paymentPayload.pixKey = pixKey;
      if (pixUrl) paymentPayload.pixUrl = pixUrl;
      if (pixTxid) paymentPayload.pixTxid = pixTxid;
      if (ispbCode) paymentPayload.ispbCode = ispbCode;
      if (registrationComplement) paymentPayload.registrationComplement = registrationComplement;
    }

    const baseUrl = getBaseUrl();
    console.log("Sending request to TecnoSpeed:", `${baseUrl}/payment/transfer`);

    const response = await fetch(`${baseUrl}/payment/transfer`, {
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
          error: responseData.message || "Erro ao criar transferência", 
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
        payment_type: "TRANSFER",
        payment_form: paymentForm,
        status: "CREATED",
        description,
        due_date: dueDate,
        payment_date: paymentDate,
        amount,
        beneficiary_name: beneficiaryName,
        beneficiary_cpf_cnpj: beneficiaryCpfCnpj,
        beneficiary_bank_code: beneficiaryBankCode,
        beneficiary_agency: beneficiaryAgency,
        beneficiary_account: beneficiaryAccount,
        pix_key: pixKey,
        pix_type: pixType,
        pix_txid: pixTxid,
        tags,
        metadata: { 
          tecnospeedResponse: responseData,
          transferType,
          compensation
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving payment to database:", insertError);
      // Still return success since TecnoSpeed accepted the payment
    }

    console.log(`${transferType} transfer created successfully:`, uniqueId);

    return new Response(
      JSON.stringify({
        success: true,
        uniqueId,
        paymentId: payment?.id,
        transferType,
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
