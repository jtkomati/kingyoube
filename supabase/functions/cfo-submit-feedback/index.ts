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
    const { 
      cfoPartnerId, 
      alertId, 
      clientCompanyId, 
      feedbackType, 
      originalValue, 
      correctValue, 
      feedbackText 
    } = await req.json();

    if (!cfoPartnerId || !feedbackType || !correctValue || !feedbackText) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: cfoPartnerId, feedbackType, correctValue, feedbackText' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Registrando feedback da IA:', { cfoPartnerId, feedbackType });

    const { data: feedback, error: insertError } = await supabase
      .from('ai_feedback_corrections')
      .insert({
        cfo_partner_id: cfoPartnerId,
        alert_id: alertId,
        client_company_id: clientCompanyId,
        feedback_type: feedbackType,
        original_value: originalValue,
        correct_value: correctValue,
        feedback_text: feedbackText,
        applied: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao registrar feedback:', insertError);
      throw insertError;
    }

    console.log('Feedback registrado com sucesso:', feedback.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        feedback_loop_id: feedback.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Log detailed error server-side only
    console.error('Erro na função cfo-submit-feedback:', {
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return generic error message to client
    return new Response(
      JSON.stringify({ 
        error: 'Não foi possível registrar o feedback. Tente novamente mais tarde.',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});