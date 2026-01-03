import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret - REQUIRED for security
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("PAYMENT_WEBHOOK_SECRET");
    
    // Fail if secret is not configured (critical security requirement)
    if (!expectedSecret) {
      console.error("CRITICAL: PAYMENT_WEBHOOK_SECRET not configured - rejecting all webhook requests");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Validate the webhook secret
    if (!webhookSecret || webhookSecret !== expectedSecret) {
      console.error("Invalid or missing webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    console.log("Received payment webhook:", JSON.stringify(body));

    // Extract event data
    const {
      event,
      eventType,
      uniqueId,
      status,
      occurrences,
      effectiveDate,
      endToEndId,
      paymentDate,
      amount,
      errorMessage
    } = body;

    const eventName = event || eventType;

    // Create service client for database operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Log the webhook
    const { error: logError } = await serviceClient
      .from("payment_webhook_logs")
      .insert({
        event_type: eventName,
        unique_id: uniqueId,
        payload: body,
        processed: false
      });

    if (logError) {
      console.error("Error logging webhook:", logError);
    }

    // Find the payment in our database
    if (uniqueId) {
      const { data: payment, error: findError } = await serviceClient
        .from("bank_payments")
        .select("*")
        .eq("unique_id", uniqueId)
        .single();

      if (findError) {
        console.log("Payment not found in database:", uniqueId);
      }

      if (payment) {
        // Determine new status based on event
        let newStatus = status;
        if (!newStatus) {
          switch (eventName?.toUpperCase()) {
            case "PAYMENT_PAID":
            case "PAID":
              newStatus = "PAID";
              break;
            case "PAYMENT_SCHEDULED":
            case "SCHEDULED":
              newStatus = "SCHEDULED";
              break;
            case "PAYMENT_REJECTED":
            case "REJECTED":
              newStatus = "REJECTED";
              break;
            case "PAYMENT_CANCELLED":
            case "CANCELLED":
              newStatus = "CANCELLED";
              break;
            case "PAYMENT_REFUNDED":
            case "REFUNDED":
              newStatus = "REFUNDED";
              break;
            case "PAYMENT_PROCESSING":
            case "PROCESSING":
              newStatus = "PROCESSING";
              break;
            default:
              newStatus = payment.status;
          }
        }

        // Update payment status
        const updateData: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString()
        };

        if (occurrences) updateData.occurrences = occurrences;
        if (effectiveDate) updateData.effective_date = effectiveDate;
        if (paymentDate && newStatus === "PAID") updateData.payment_date = paymentDate;

        const { error: updateError } = await serviceClient
          .from("bank_payments")
          .update(updateData)
          .eq("id", payment.id);

        if (updateError) {
          console.error("Error updating payment:", updateError);
        } else {
          console.log(`Payment ${uniqueId} updated to status: ${newStatus}`);
        }

        // If payment is linked to a transaction and is now paid, update the transaction
        if (payment.transaction_id && newStatus === "PAID") {
          const { error: txError } = await serviceClient
            .from("transactions")
            .update({
              payment_date: paymentDate || effectiveDate || new Date().toISOString().split("T")[0],
              updated_at: new Date().toISOString()
            })
            .eq("id", payment.transaction_id);

          if (txError) {
            console.error("Error updating linked transaction:", txError);
          } else {
            console.log(`Linked transaction ${payment.transaction_id} marked as paid`);
          }
        }

        // Mark webhook as processed
        await serviceClient
          .from("payment_webhook_logs")
          .update({ processed: true })
          .eq("unique_id", uniqueId)
          .eq("event_type", eventName);
      }
    }

    console.log("Webhook processed successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
