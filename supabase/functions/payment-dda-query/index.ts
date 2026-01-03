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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const status = url.searchParams.get('status');
    const dueDateStart = url.searchParams.get('dueDateStart');
    const dueDateEnd = url.searchParams.get('dueDateEnd');
    const beneficiary = url.searchParams.get('beneficiary');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!companyId) {
      return new Response(JSON.stringify({ error: 'companyId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let query = supabaseClient
      .from('dda_boletos')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('due_date', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (dueDateStart) {
      query = query.gte('due_date', dueDateStart);
    }

    if (dueDateEnd) {
      query = query.lte('due_date', dueDateEnd);
    }

    if (beneficiary) {
      query = query.or(`beneficiary_name.ilike.%${beneficiary}%,beneficiary_cpf_cnpj.ilike.%${beneficiary}%`);
    }

    const { data: boletos, error, count } = await query;

    if (error) {
      console.error('Error querying DDA boletos:', error);
      return new Response(JSON.stringify({ error: 'Failed to query DDA boletos' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get statistics
    const { data: stats } = await supabaseClient
      .from('dda_boletos')
      .select('status, final_amount')
      .eq('company_id', companyId);

    const statistics = {
      total: stats?.length || 0,
      pending: stats?.filter(b => b.status === 'PENDING').length || 0,
      paid: stats?.filter(b => b.status === 'PAID').length || 0,
      ignored: stats?.filter(b => b.status === 'IGNORED').length || 0,
      totalPendingAmount: stats?.filter(b => b.status === 'PENDING').reduce((sum, b) => sum + (parseFloat(b.final_amount) || 0), 0) || 0,
    };

    return new Response(JSON.stringify({ 
      boletos,
      count,
      statistics,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in payment-dda-query:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
