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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { cfo_partner_id } = await req.json();

    if (!cfo_partner_id) {
      return new Response(
        JSON.stringify({ error: "cfo_partner_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching clients for CFO partner: ${cfo_partner_id}`);

    // Buscar todas as empresas (company_settings) associadas ao parceiro
    const { data: companies, error } = await supabase
      .from("company_settings")
      .select("id, company_name, notification_email, cnpj")
      .eq("cfo_partner_id", cfo_partner_id);

    if (error) {
      console.error("Error fetching clients:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch clients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clients = (companies || []).map(company => ({
      client_id: company.id,
      client_name: company.company_name,
      primary_contact: company.notification_email || company.cnpj,
    }));

    console.log(`Found ${clients.length} clients for CFO partner`);

    return new Response(
      JSON.stringify(clients),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in cfo-get-partner-clients:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
