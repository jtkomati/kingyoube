import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AES-GCM decryption helper
async function decryptPassword(ciphertext: string, ivBase64: string, masterKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Derive the same 256-bit key from the master key
  const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(masterKey));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  // Decode base64 to Uint8Array
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertextBytes
  );
  
  return decoder.decode(decrypted);
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

    // Fetch from prefeitura_credentials table
    const { data: credentials, error: credError } = await adminClient
      .from('prefeitura_credentials')
      .select('login, inscricao_municipal, password_ciphertext, password_iv')
      .eq('company_id', organizationId)
      .maybeSingle();

    if (credError) {
      console.error('Credentials fetch error:', credError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch credentials', details: credError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let password = null;
    const hasPassword = !!(credentials?.password_ciphertext && credentials?.password_iv);

    // Decrypt password if requested and available
    if (includePassword && hasPassword) {
      try {
        password = await decryptPassword(
          credentials.password_ciphertext,
          credentials.password_iv,
          masterKey
        );
        console.log('Password decrypted successfully');
      } catch (decryptError) {
        console.error('Password decryption failed:', decryptError);
        // Don't fail the request, just don't return the password
      }
    }

    console.log('Credentials fetched for organization:', organizationId, 'hasPassword:', hasPassword);

    return new Response(
      JSON.stringify({
        login: credentials?.login || null,
        inscricaoMunicipal: credentials?.inscricao_municipal || null,
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
