import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cfoPartnerId, eventType, timeSavedMinutes, clientCompanyId, metadata } = await req.json();

    if (!cfoPartnerId || !eventType || timeSavedMinutes === undefined) {
      return new Response(
        JSON.stringify({ error: 'cfoPartnerId, eventType e timeSavedMinutes são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Rastreando ROI do CFO:', { cfoPartnerId, eventType, timeSavedMinutes });

    const { error: insertError } = await supabase
      .from('cfo_partner_roi_tracking')
      .insert({
        cfo_partner_id: cfoPartnerId,
        event_type: eventType,
        time_saved_minutes: timeSavedMinutes,
        client_company_id: clientCompanyId,
        metadata: metadata || {}
      });

    if (insertError) {
      console.error('Erro ao rastrear ROI:', insertError);
      throw insertError;
    }

    console.log('ROI rastreado com sucesso');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});