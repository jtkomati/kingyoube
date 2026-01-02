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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

    if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
      console.error('Missing Pluggy credentials');
      return new Response(
        JSON.stringify({ error: 'Pluggy credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { companyId, userId, itemId, origin: clientOrigin } = body;

    // Determine origin for OAuth redirect
    const headerOrigin = req.headers.get('origin');
    const origin = clientOrigin || headerOrigin || 'https://preview--kingyoube.lovable.app';
    const oauthRedirectUri = `${origin}/pluggy/oauth/callback`;
    
    console.log('Using origin:', origin);
    console.log('OAuth redirect URI:', oauthRedirectUri);

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

    // Step 2: Create Connect Token with options including oauthRedirectUri
    const options: Record<string, unknown> = {
      webhookUrl: `${SUPABASE_URL}/functions/v1/pluggy-webhook`,
      oauthRedirectUri: oauthRedirectUri,
      avoidDuplicates: true,
    };
    
    // Add clientUserId for tracking
    if (companyId && userId) {
      options.clientUserId = `${companyId}:${userId}`;
    } else if (companyId) {
      options.clientUserId = companyId;
    }

    // Build the payload with proper structure
    const connectTokenPayload: Record<string, unknown> = {
      options: options,
    };

    // If updating an existing item, include the itemId at root level
    if (itemId) {
      connectTokenPayload.itemId = itemId;
    }

    console.log('Creating connect token with payload:', JSON.stringify(connectTokenPayload));
    
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
    console.log('Connect token created successfully with oauthRedirectUri:', oauthRedirectUri);

    return new Response(
      JSON.stringify({ 
        accessToken: connectData.accessToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-pluggy-token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
