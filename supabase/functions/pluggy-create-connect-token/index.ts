import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
    const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

    if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
      console.error('Missing Pluggy credentials');
      return new Response(
        JSON.stringify({ error: 'Pluggy credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get API Key (access token)
    console.log('Requesting Pluggy API key...');
    const authResponse = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET,
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('Pluggy auth failed:', authResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with Pluggy', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authData = await authResponse.json();
    const apiKey = authData.apiKey;
    console.log('Pluggy API key obtained successfully');

    // Step 2: Create Connect Token
    const { itemId, webhookUrl } = await req.json().catch(() => ({}));
    
    const connectTokenPayload: Record<string, unknown> = {};
    
    // If updating an existing item, include the itemId
    if (itemId) {
      connectTokenPayload.itemId = itemId;
    }

    // Set webhook URL if provided
    if (webhookUrl) {
      connectTokenPayload.webhookUrl = webhookUrl;
    }

    console.log('Creating connect token with payload:', connectTokenPayload);
    
    const connectResponse = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(connectTokenPayload),
    });

    if (!connectResponse.ok) {
      const errorText = await connectResponse.text();
      console.error('Pluggy connect token failed:', connectResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create connect token', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const connectData = await connectResponse.json();
    console.log('Connect token created successfully');

    return new Response(
      JSON.stringify({ 
        accessToken: connectData.accessToken,
        apiKey: apiKey // Also return apiKey for subsequent API calls
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pluggy-create-connect-token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
