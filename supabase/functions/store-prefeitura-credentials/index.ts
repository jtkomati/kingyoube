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

    // Create client with user's JWT to get their identity
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

    const { organizationId, login, password, inscricaoMunicipal } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for privileged operations
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

    // Check if config_fiscal exists for this company
    const { data: existingConfig, error: fetchError } = await adminClient
      .from('config_fiscal')
      .select('id')
      .eq('company_id', organizationId)
      .maybeSingle();

    if (fetchError) {
      console.error('Fetch config error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing config', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingConfig) {
      // Update existing config without overwriting other fields
      const { error: updateError } = await adminClient
        .from('config_fiscal')
        .update({
          prefeitura_login: login || null,
          prefeitura_inscricao_municipal: inscricaoMunicipal || null,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', organizationId);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update credentials', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Insert new config
      const { error: insertError } = await adminClient
        .from('config_fiscal')
        .insert({
          company_id: organizationId,
          prefeitura_login: login || null,
          prefeitura_inscricao_municipal: inscricaoMunicipal || null,
          client_id: 'prefeitura',
          client_secret: 'configured'
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create credentials', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Store password in vault if provided
    if (password) {
      const { error: vaultError } = await adminClient.rpc('store_secret', {
        p_entity_type: 'prefeitura',
        p_entity_id: organizationId,
        p_secret_type: 'password',
        p_secret_value: password
      });

      if (vaultError) {
        console.error('Vault error:', vaultError);
        return new Response(
          JSON.stringify({ error: 'Failed to store password securely' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Credentials saved successfully for organization:', organizationId);

    return new Response(
      JSON.stringify({ success: true }),
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
