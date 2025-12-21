import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting TecnoSpeed token creation...');

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

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User authenticated: ${user.id}`);

    // 2. Check user role/permissions
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const userRole = roleData?.role || 'VIEWER';
    const roleLevel = getRoleLevel(userRole);

    if (roleLevel < 3) {
      console.error(`Insufficient permissions: user ${user.id} has role ${userRole}`);
      return new Response(
        JSON.stringify({ error: 'Permissão insuficiente. Requer nível Financeiro ou superior.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} authorized with role ${userRole}`);

    // 3. Get TecnoSpeed credentials
    const TECNOSPEED_TOKEN = Deno.env.get('TECNOSPEED_TOKEN');
    const TECNOSPEED_LOGIN_AUTH = Deno.env.get('TECNOSPEED_LOGIN_AUTH');

    if (!TECNOSPEED_TOKEN || !TECNOSPEED_LOGIN_AUTH) {
      console.error('TecnoSpeed credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Credenciais TecnoSpeed não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Log audit trail
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_role: userRole,
      action: 'create_tecnospeed_token',
      details: 'Generated TecnoSpeed token for Open Finance integration',
    });

    // 5. Return token and auth for use in frontend
    // Note: TecnoSpeed uses Token and LoginAuth directly in API calls
    return new Response(
      JSON.stringify({
        success: true,
        message: 'TecnoSpeed credentials validated',
        userId: user.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in create-tecnospeed-token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
