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

    const url = new URL(req.url);
    const method = req.method;
    const baseUrl = getBaseUrl();

    if (method === "GET") {
      // List notifications
      const response = await fetch(`${baseUrl}/notification`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: responseData.message || "Erro ao listar notificações", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, notifications: responseData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "POST") {
      // Create notification/webhook
      const body = await req.json();
      const { events, webhookUrl, headers: webhookHeaders, method: webhookMethod } = body;

      if (!events || !webhookUrl) {
        return new Response(
          JSON.stringify({ error: "events e webhookUrl são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Creating webhook notification for events:", events);

      const notificationPayload: Record<string, unknown> = {
        onEvents: events,
        url: webhookUrl,
        method: webhookMethod || "POST"
      };

      if (webhookHeaders) {
        notificationPayload.headers = webhookHeaders;
      }

      const response = await fetch(`${baseUrl}/notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
        body: JSON.stringify(notificationPayload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: responseData.message || "Erro ao criar notificação", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Webhook notification created successfully");

      return new Response(
        JSON.stringify({ success: true, notification: responseData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "PUT") {
      // Update notification
      const body = await req.json();
      const { notificationId, events, webhookUrl, headers: webhookHeaders, method: webhookMethod, active } = body;

      if (!notificationId) {
        return new Response(
          JSON.stringify({ error: "notificationId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updatePayload: Record<string, unknown> = {};
      if (events) updatePayload.onEvents = events;
      if (webhookUrl) updatePayload.url = webhookUrl;
      if (webhookMethod) updatePayload.method = webhookMethod;
      if (webhookHeaders) updatePayload.headers = webhookHeaders;
      if (typeof active === "boolean") updatePayload.active = active;

      const response = await fetch(`${baseUrl}/notification`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
        body: JSON.stringify({ id: notificationId, ...updatePayload }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: responseData.message || "Erro ao atualizar notificação", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, notification: responseData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "DELETE") {
      const notificationId = url.searchParams.get("notificationId");

      if (!notificationId) {
        return new Response(
          JSON.stringify({ error: "notificationId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(`${baseUrl}/notification?id=${notificationId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "cnpj-sh": CNPJ_SH,
          "token-sh": TOKEN,
        },
      });

      if (!response.ok) {
        const responseData = await response.json();
        return new Response(
          JSON.stringify({ error: responseData.message || "Erro ao deletar notificação", details: responseData }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Notificação deletada com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
