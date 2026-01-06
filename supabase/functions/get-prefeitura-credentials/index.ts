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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { organizationId, includePassword } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user belongs to organization
    const { data: userOrg, error: orgError } = await adminClient
      .from('user_organizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      console.error('Organization access error:', orgError);
      return new Response(
        JSON.stringify({ error: 'User does not have access to this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch config_fiscal
    const { data: config, error: configError } = await adminClient
      .from('config_fiscal')
      .select('prefeitura_login, inscricao_municipal')
      .eq('organization_id', organizationId)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Config error:', configError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let password = null;
    let hasPassword = false;

    // Get password from vault
    const { data: vaultPassword, error: vaultError } = await adminClient.rpc('get_secret', {
      p_entity_type: 'prefeitura',
      p_entity_id: organizationId,
      p_secret_type: 'password'
    });

    if (!vaultError && vaultPassword) {
      hasPassword = true;
      if (includePassword) {
        password = vaultPassword;
      }
    }

    console.log('Credentials fetched for organization:', organizationId, 'hasPassword:', hasPassword);

    return new Response(
      JSON.stringify({
        login: config?.prefeitura_login || null,
        inscricaoMunicipal: config?.inscricao_municipal || null,
        hasPassword,
        password
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
