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

    const { accountHash, bankAccountId } = await req.json();

    if (!accountHash || !bankAccountId) {
      return new Response(JSON.stringify({ error: 'accountHash and bankAccountId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tecnospeedToken = Deno.env.get('TECNOSPEED_TOKEN');
    const cnpjSH = Deno.env.get('TECNOSPEED_CNPJ_SOFTWAREHOUSE');

    if (!tecnospeedToken || !cnpjSH) {
      return new Response(JSON.stringify({ error: 'TecnoSpeed credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Activating DDA for account ${accountHash}`);

    // Call TecnoSpeed API to activate DDA
    const response = await fetch(`https://api.bancos.tecnospeed.com.br/api/v1/pagamentos/${accountHash}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tecnospeedToken}`,
        'cnpj-sh': cnpjSH,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ddaActived: true,
      }),
    });

    const responseText = await response.text();
    console.log(`TecnoSpeed DDA activation response: ${response.status} - ${responseText}`);

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: 'Failed to activate DDA on TecnoSpeed', 
        details: responseText 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update bank account in database
    const { error: updateError } = await supabaseClient
      .from('bank_accounts')
      .update({ dda_activated: true })
      .eq('id', bankAccountId);

    if (updateError) {
      console.error('Error updating bank account:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update bank account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`DDA activated successfully for account ${bankAccountId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'DDA activated successfully' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in payment-dda-activate:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
