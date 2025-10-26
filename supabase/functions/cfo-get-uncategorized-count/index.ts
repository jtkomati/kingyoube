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

    const { client_id } = await req.json();

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: "client_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Counting uncategorized transactions for client: ${client_id}`);

    // Buscar transações sem categoria ou com categoria genérica
    // Consideramos "não categorizada" como transactions onde category_id é null
    // ou onde a descrição está vazia/genérica
    const { count, error } = await supabase
      .from("transactions")
      .select("id", { count: 'exact', head: true })
      .or(`customer_id.eq.${client_id},supplier_id.eq.${client_id}`)
      .or("category_id.is.null,description.is.null,description.eq.");

    if (error) {
      console.error("Error counting uncategorized transactions:", error);
      return new Response(
        JSON.stringify({ error: "Failed to count transactions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${count || 0} uncategorized transactions`);

    return new Response(
      JSON.stringify({ count: count || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in cfo-get-uncategorized-count:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
