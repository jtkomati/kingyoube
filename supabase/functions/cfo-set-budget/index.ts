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
      clientCompanyId, 
      accountName, 
      accountCategory,
      month, 
      targetAmount,
      notes 
    } = await req.json();

    if (!cfoPartnerId || !clientCompanyId || !accountName || !accountCategory || !month || !targetAmount) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: cfoPartnerId, clientCompanyId, accountName, accountCategory, month, targetAmount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
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

    console.log('Definindo meta de orçamento:', { accountName, month, targetAmount });

    // Ensure month is in YYYY-MM-01 format
    const monthDate = new Date(month);
    monthDate.setDate(1);
    const monthStr = monthDate.toISOString().split('T')[0];

    // Upsert budget target (insert or update if exists)
    const { data: budget, error: insertError } = await supabase
      .from('budget_targets')
      .upsert({
        cfo_partner_id: cfoPartnerId,
        client_company_id: clientCompanyId,
        account_name: accountName,
        account_category: accountCategory,
        month: monthStr,
        target_amount: targetAmount,
        notes: notes || null,
        created_by: user.id
      }, {
        onConflict: 'client_company_id,account_name,month'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao definir orçamento:', insertError);
      throw insertError;
    }

    console.log('Meta de orçamento definida com sucesso:', budget.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        budget_id: budget.id
      }),
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