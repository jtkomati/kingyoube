import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AES-GCM encryption helper
async function encryptPassword(password: string, masterKey: string): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  
  // Derive a 256-bit key from the master key using SHA-256
  const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(masterKey));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the password
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(password)
  );
  
  // Convert to base64
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return { ciphertext, iv: ivBase64 };
}

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
    const masterKey = Deno.env.get('PREFEITURA_CREDENTIALS_MASTER_KEY');

    if (!masterKey) {
      console.error('PREFEITURA_CREDENTIALS_MASTER_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Check if credentials already exist in prefeitura_credentials table
    const { data: existingCreds, error: fetchError } = await adminClient
      .from('prefeitura_credentials')
      .select('company_id, password_ciphertext')
      .eq('company_id', organizationId)
      .maybeSingle();

    if (fetchError) {
      console.error('Fetch credentials error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing credentials', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      login: login || null,
      inscricao_municipal: inscricaoMunicipal || null,
      updated_at: new Date().toISOString()
    };

    // Encrypt password if provided and not a masked placeholder
    if (password && password !== '••••••••') {
      const encrypted = await encryptPassword(password, masterKey);
      updateData.password_ciphertext = encrypted.ciphertext;
      updateData.password_iv = encrypted.iv;
      console.log('Password encrypted successfully');
    }

    if (existingCreds) {
      // Update existing record
      const { error: updateError } = await adminClient
        .from('prefeitura_credentials')
        .update(updateData)
        .eq('company_id', organizationId);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update credentials', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Credentials updated for organization:', organizationId);
    } else {
      // Insert new record
      const insertData = {
        company_id: organizationId,
        ...updateData
      };

      const { error: insertError } = await adminClient
        .from('prefeitura_credentials')
        .insert(insertData);

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create credentials', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Credentials created for organization:', organizationId);
    }

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
