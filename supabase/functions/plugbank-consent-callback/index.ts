import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key for webhook - no user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    console.log("PlugBank consent webhook received:", JSON.stringify(body));

    // PlugBank can send various event formats, handle them all
    const accountId = body.accountId || body.id || body.account_id;
    const status = body.status || body.consentStatus;
    const event = body.event || body.eventType;

    if (!accountId) {
      console.error("Missing accountId in webhook payload");
      return new Response(
        JSON.stringify({ error: "accountId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map PlugBank status to our internal status
    let openFinanceStatus = "disconnected";
    
    // Handle various status formats from PlugBank
    const normalizedStatus = (status || "").toUpperCase();
    const normalizedEvent = (event || "").toUpperCase();
    
    if (
      normalizedStatus === "AUTHORIZED" || 
      normalizedStatus === "ACTIVE" ||
      normalizedStatus === "CONNECTED" ||
      normalizedEvent === "CONSENT_APPROVED" ||
      normalizedEvent === "AUTHORIZATION_COMPLETED"
    ) {
      openFinanceStatus = "connected";
    } else if (
      normalizedStatus === "PENDING" || 
      normalizedStatus === "AWAITING" ||
      normalizedEvent === "CONSENT_CREATED"
    ) {
      openFinanceStatus = "awaiting_consent";
    } else if (
      normalizedStatus === "REVOKED" || 
      normalizedStatus === "CANCELLED" ||
      normalizedStatus === "EXPIRED" ||
      normalizedEvent === "CONSENT_REVOKED" ||
      normalizedEvent === "CONSENT_EXPIRED"
    ) {
      openFinanceStatus = "revoked";
    } else if (
      normalizedStatus === "REJECTED" ||
      normalizedEvent === "CONSENT_REJECTED"
    ) {
      openFinanceStatus = "rejected";
    }

    console.log(`Updating account ${accountId} to status: ${openFinanceStatus}`);

    // Update bank account status
    const updateData: Record<string, unknown> = {
      open_finance_status: openFinanceStatus,
    };

    // Add consent expiration if provided
    if (body.consentExpiresAt || body.consent_expires_at || body.expiresAt) {
      updateData.consent_expires_at = body.consentExpiresAt || body.consent_expires_at || body.expiresAt;
    }

    // Set last_sync_at for connected accounts
    if (openFinanceStatus === "connected") {
      updateData.last_sync_at = new Date().toISOString();
    }

    const { data: updatedAccount, error: updateError } = await supabaseClient
      .from("bank_accounts")
      .update(updateData)
      .eq("plugbank_account_id", accountId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating bank account:", updateError);
      
      // Try to find by accountId as fallback
      const { error: retryError } = await supabaseClient
        .from("bank_accounts")
        .update(updateData)
        .eq("id", accountId);
      
      if (retryError) {
        console.error("Retry also failed:", retryError);
        throw new Error(`Failed to update account: ${updateError.message}`);
      }
    }

    console.log(`Account ${accountId} status updated to ${openFinanceStatus}`, updatedAccount);

    // Log the webhook event for audit
    try {
      await supabaseClient
        .from("application_logs")
        .insert({
          level: "info",
          source: "edge-function",
          function_name: "plugbank-consent-callback",
          message: `Consent callback processed: ${accountId} -> ${openFinanceStatus}`,
          context: {
            accountId,
            previousStatus: status,
            event,
            newStatus: openFinanceStatus,
          },
        });
    } catch (logError) {
      console.error("Failed to log webhook event:", logError);
      // Don't fail the webhook for logging errors
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        accountId,
        status: openFinanceStatus,
        message: `Account status updated to ${openFinanceStatus}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
