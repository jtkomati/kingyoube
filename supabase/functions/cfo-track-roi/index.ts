import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  cfoPartnerId: z.string().uuid(),
  eventType: z.string().min(1).max(100),
  timeSavedMinutes: z.number().int().min(0).max(480),
  clientCompanyId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cfoPartnerId, eventType, timeSavedMinutes, clientCompanyId, metadata } = validation.data;

    // Verify ownership
    const { data: partner, error: partnerError } = await supabase
      .from('cfo_partners')
      .select('id')
      .eq('id', cfoPartnerId)
      .eq('user_id', user.id)
      .single();

    if (partnerError || !partner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have access to this CFO partner' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    // Log detailed error server-side only
    console.error('Erro na função cfo-track-roi:', {
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return generic error message to client
    return new Response(
      JSON.stringify({ 
        error: 'Não foi possível registrar o ROI. Tente novamente mais tarde.',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});