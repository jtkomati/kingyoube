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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting LGPD account deletion for user: ${user.id}`);

    // Use service role for operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get profile to get company_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    const companyId = profile?.company_id;

    // Anonymize personal data in profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: 'Usuário Excluído',
        email: `deleted_${user.id}@anonymized.local`,
        phone_number: null,
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('Error anonymizing profile:', profileError);
    }

    // Anonymize customer data created by this user
    if (companyId) {
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          first_name: 'Dados',
          last_name: 'Anonimizados',
          email: null,
          phone: null,
          address: null,
          cpf: null,
        })
        .eq('company_id', companyId);

      if (customerError) {
        console.error('Error anonymizing customers:', customerError);
      }

      // Anonymize supplier data
      const { error: supplierError } = await supabase
        .from('suppliers')
        .update({
          first_name: 'Dados',
          last_name: 'Anonimizados',
          email: null,
          phone: null,
          address: null,
          cpf: null,
        })
        .eq('company_id', companyId);

      if (supplierError) {
        console.error('Error anonymizing suppliers:', supplierError);
      }

      // Delete bank account tokens (sensitive data)
      const { error: bankError } = await supabase
        .from('bank_accounts')
        .update({
          access_token: null,
          refresh_token: null,
          client_id: null,
          client_secret: null,
        })
        .eq('company_id', companyId);

      if (bankError) {
        console.error('Error clearing bank tokens:', bankError);
      }
    }

    // Revoke all consents
    const { error: consentError } = await supabase
      .from('user_consents')
      .update({
        consented: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (consentError) {
      console.error('Error revoking consents:', consentError);
    }

    // Update the LGPD deletion request status
    const { error: requestError } = await supabase
      .from('lgpd_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: 'Conta anonimizada. Dados fiscais retidos por 5 anos conforme legislação.',
      })
      .eq('user_id', user.id)
      .eq('request_type', 'deletion')
      .eq('status', 'pending');

    if (requestError) {
      console.error('Error updating request status:', requestError);
    }

    // Delete the user from auth (this will cascade delete from profiles due to FK)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`LGPD account deletion completed for user: ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conta excluída com sucesso. Dados pessoais foram anonimizados.',
        note: 'Dados fiscais serão retidos por 5 anos conforme legislação tributária.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in LGPD account deletion:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
