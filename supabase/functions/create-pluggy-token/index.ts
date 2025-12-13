import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get role level
function getRoleLevel(role: string): number {
  const roleLevels: Record<string, number> = {
    'SUPERADMIN': 5,
    'ADMIN': 4,
    'FINANCEIRO': 3,
    'CONTADOR': 3,
    'FISCAL': 2,
    'USUARIO': 1,
    'VIEWER': 1,
  };
  return roleLevels[role] || 0;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting Pluggy token creation...');

    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's token to verify authentication
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // 2. Validate user token
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User authenticated: ${user.id}`);

    // 3. Check user role/permissions using service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const userRole = roleData?.role || 'VIEWER';
    const roleLevel = getRoleLevel(userRole);

    // Require at least FINANCEIRO level (3) to access Open Finance features
    if (roleLevel < 3) {
      console.error(`Insufficient permissions: user ${user.id} has role ${userRole} (level ${roleLevel})`);
      return new Response(
        JSON.stringify({ error: 'Permissão insuficiente. Requer nível Financeiro ou superior.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} authorized with role ${userRole}`);

    // 4. Log audit trail
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_role: userRole,
      action: 'create_pluggy_token',
      details: 'Generated Pluggy connect token for Open Finance integration',
    });

    // 5. Get Pluggy credentials from environment variables
    const CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
    const CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error('Missing Pluggy credentials');
      throw new Error('Credenciais da Pluggy não configuradas no Supabase.');
    }

    console.log('Calling Pluggy auth API...');

    // 6. Make secure call to Pluggy API
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
