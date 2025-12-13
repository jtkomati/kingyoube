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

    console.log(`Starting LGPD data export for user: ${user.id}`);

    // Use service role to fetch all user data
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Collect all user data
    const exportData: Record<string, any> = {
      export_date: new Date().toISOString(),
      user_id: user.id,
      user_email: user.email,
    };

    // Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    exportData.profile = profile;

    // User roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id);
    exportData.roles = roles;

    // Consents
    const { data: consents } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user.id);
    exportData.consents = consents;

    // Get company_id from profile
    const companyId = profile?.company_id;

    if (companyId) {
      // Company settings
      const { data: company } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', companyId)
        .single();
      exportData.company = company;

      // Transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', companyId);
      exportData.transactions = transactions;

      // Customers
      const { data: customers } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId);
      exportData.customers = customers;

      // Suppliers
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId);
      exportData.suppliers = suppliers;

      // Contracts
      const { data: contracts } = await supabase
        .from('contracts')
        .select('*')
        .eq('company_id', companyId);
      exportData.contracts = contracts;

      // Incoming invoices
      const { data: incomingInvoices } = await supabase
        .from('incoming_invoices')
        .select('*')
        .eq('company_id', companyId);
      exportData.incoming_invoices = incomingInvoices;

      // Bank accounts
      const { data: bankAccounts } = await supabase
        .from('bank_accounts')
        .select('id, bank_name, account_number, agency, account_type, created_at')
        .eq('company_id', companyId);
      exportData.bank_accounts = bankAccounts;
    }

    // AI feedback
    const { data: aiFeedback } = await supabase
      .from('ai_feedback')
      .select('*')
      .eq('user_id', user.id);
    exportData.ai_feedback = aiFeedback;

    // LGPD requests
    const { data: lgpdRequests } = await supabase
      .from('lgpd_requests')
      .select('*')
      .eq('user_id', user.id);
    exportData.lgpd_requests = lgpdRequests;

    console.log(`LGPD data export completed for user: ${user.id}`);

    return new Response(
      JSON.stringify(exportData, null, 2),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="lgpd-export-${user.id}-${Date.now()}.json"`
        } 
      }
    );

  } catch (error) {
    console.error('Error exporting LGPD data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
