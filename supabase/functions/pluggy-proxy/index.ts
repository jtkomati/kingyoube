import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const pluggyClientId = Deno.env.get('PLUGGY_CLIENT_ID');
    const pluggyClientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET');

    if (!pluggyClientId || !pluggyClientSecret) {
      throw new Error('Pluggy credentials not configured');
    }

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's company_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with a company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, itemId, accountId, pageSize = 100, page = 1 } = await req.json();

    console.log(`Pluggy proxy request: action=${action}, itemId=${itemId}, companyId=${profile.company_id}`);

    // Validate that itemId belongs to the user's company (if provided)
    if (itemId) {
      const { data: connection } = await supabase
        .from('pluggy_connections')
        .select('id')
        .eq('pluggy_item_id', itemId)
        .eq('company_id', profile.company_id)
        .single();

      if (!connection) {
        return new Response(
          JSON.stringify({ error: 'Item not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get Pluggy API key
    const authResponse = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: pluggyClientId,
        clientSecret: pluggyClientSecret
      })
    });

    if (!authResponse.ok) {
      const authError = await authResponse.text();
      console.error('Pluggy auth failed:', authError);
      throw new Error('Failed to authenticate with Pluggy');
    }

    const { apiKey } = await authResponse.json();

    let pluggyUrl: string;
    let pluggyMethod = 'GET';

    switch (action) {
      case 'getItem':
        pluggyUrl = `https://api.pluggy.ai/items/${itemId}`;
        break;
      case 'getAccounts':
        pluggyUrl = `https://api.pluggy.ai/accounts?itemId=${itemId}`;
        break;
      case 'getTransactions':
        if (!accountId) {
          return new Response(
            JSON.stringify({ error: 'accountId is required for getTransactions' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        pluggyUrl = `https://api.pluggy.ai/transactions?accountId=${accountId}&pageSize=${pageSize}&page=${page}`;
        break;
      case 'getInvestments':
        pluggyUrl = `https://api.pluggy.ai/investments?itemId=${itemId}`;
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Calling Pluggy API: ${pluggyMethod} ${pluggyUrl}`);

    const pluggyResponse = await fetch(pluggyUrl, {
      method: pluggyMethod,
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!pluggyResponse.ok) {
      const errorText = await pluggyResponse.text();
      console.error('Pluggy API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Pluggy API error', details: errorText }),
        { status: pluggyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await pluggyResponse.json();

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pluggy proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
