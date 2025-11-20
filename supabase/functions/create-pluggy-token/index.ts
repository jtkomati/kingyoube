import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting Pluggy token creation...');

    // Get Pluggy credentials from environment variables
    const CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
    const CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error('Missing Pluggy credentials');
      throw new Error('Credenciais da Pluggy não configuradas no Supabase.');
    }

    console.log('Calling Pluggy auth API...');

    // Make secure call to Pluggy API
    const response = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Pluggy API error:', data);
      throw new Error(`Erro na Pluggy: ${JSON.stringify(data)}`);
    }

    console.log('Successfully obtained Pluggy token');

    // Return the access token to the frontend
    return new Response(JSON.stringify({ accessToken: data.apiKey }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in create-pluggy-token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
