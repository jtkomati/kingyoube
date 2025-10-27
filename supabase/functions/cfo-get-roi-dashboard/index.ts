import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request body
    const requestSchema = z.object({
      cfoPartnerId: z.string().uuid('cfoPartnerId deve ser um UUID válido')
    });

    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cfoPartnerId } = validation.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Buscando dashboard de ROI para CFO:', cfoPartnerId);

    // Get all ROI tracking data for this CFO partner
    const { data: roiData, error: roiError } = await supabase
      .from('cfo_partner_roi_tracking')
      .select('*')
      .eq('cfo_partner_id', cfoPartnerId);

    if (roiError) {
      console.error('Erro ao buscar ROI:', roiError);
      throw roiError;
    }

    // Calculate metrics
    const totalMinutesSaved = roiData.reduce((sum, item) => sum + item.time_saved_minutes, 0);
    const totalHoursSaved = Math.round(totalMinutesSaved / 60 * 10) / 10;

    const reportsGenerated = roiData.filter(item => 
      item.event_type === 'AI_REPORT_GENERATED'
    ).length;

    const criticalAlertsViewed = roiData.filter(item => 
      item.event_type === 'CRITICAL_ALERT_VIEWED'
    ).length;

    const manualTasksAvoided = roiData.filter(item => 
      item.event_type === 'MANUAL_TASK_COMPLETED'
    ).length;

    // Calculate monetary value (assuming R$ 150/hour for CFO time)
    const hourlyRate = 150;
    const totalValueGenerated = Math.round(totalHoursSaved * hourlyRate);

    // Get data for current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const thisMonthData = roiData.filter(item => 
      new Date(item.created_at) >= firstDayOfMonth
    );

    const thisMonthMinutes = thisMonthData.reduce((sum, item) => sum + item.time_saved_minutes, 0);
    const thisMonthHours = Math.round(thisMonthMinutes / 60 * 10) / 10;

    console.log('Dashboard de ROI calculado:', {
      totalHoursSaved,
      reportsGenerated,
      criticalAlertsViewed,
      manualTasksAvoided,
      totalValueGenerated,
      thisMonthHours
    });

    return new Response(
      JSON.stringify({
        total_hours_saved: totalHoursSaved,
        reports_generated: reportsGenerated,
        critical_alerts_viewed: criticalAlertsViewed,
        manual_tasks_avoided: manualTasksAvoided,
        total_value_generated: totalValueGenerated,
        this_month_hours_saved: thisMonthHours,
        this_month_value: Math.round(thisMonthHours * hourlyRate),
        hourly_rate: hourlyRate
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});