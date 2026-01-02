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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
    const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');

    const payload = await req.json();
    console.log('Pluggy webhook received:', JSON.stringify(payload, null, 2));

    const { event, data } = payload;

    // Acknowledge immediately
    if (!event || !data) {
      console.log('Invalid payload, acknowledging anyway');
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get API key for subsequent calls
    const authResponse = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET,
      }),
    });

    if (!authResponse.ok) {
      console.error('Failed to get Pluggy API key');
      // Still return 200 to acknowledge webhook
      return new Response(JSON.stringify({ success: true, warning: 'Auth failed' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { apiKey } = await authResponse.json();

    switch (event) {
      case 'item/created':
        console.log('Item created:', data.item?.id);
        break;

      case 'item/updated':
        const itemId = data.item?.id;
        const status = data.item?.status;
        console.log(`Item ${itemId} updated with status: ${status}`);

        if (status === 'UPDATED' || status === 'UPDATING') {
          // First, find the pluggy_connection to get company_id and created_by
          const { data: connection, error: connError } = await supabase
            .from('pluggy_connections')
            .select('company_id, created_by')
            .eq('pluggy_item_id', itemId)
            .single();

          if (connError || !connection) {
            console.error('Could not find pluggy_connection for item:', itemId, connError);
            // Try to continue without company context
          }

          const companyId = connection?.company_id;
          const createdBy = connection?.created_by;

          // Fetch accounts for this item
          const accountsResponse = await fetch(`https://api.pluggy.ai/items/${itemId}/accounts`, {
            headers: { 'X-API-KEY': apiKey },
          });

          if (accountsResponse.ok) {
            const accountsData = await accountsResponse.json();
            console.log('Accounts fetched:', accountsData.results?.length);

            for (const account of accountsData.results || []) {
              // Prepare bank account data
              const bankAccountData: Record<string, unknown> = {
                pluggy_item_id: itemId,
                pluggy_account_id: account.id,
                bank_name: account.bankData?.name || account.name || 'Banco',
                bank_code: account.bankData?.code || null,
                account_type: account.type || 'checking',
                account_number: account.number || null,
                agency: account.branch || null,
                balance: account.balance || 0,
                currency: account.currencyCode || 'BRL',
                last_sync_at: new Date().toISOString(),
                open_finance_status: 'connected',
                updated_at: new Date().toISOString(),
              };

              // Add company_id if we have it
              if (companyId) {
                bankAccountData.company_id = companyId;
              }

              // Upsert bank account using pluggy_account_id as key
              const { data: upsertedAccount, error: accountError } = await supabase
                .from('bank_accounts')
                .upsert(bankAccountData, {
                  onConflict: 'pluggy_account_id',
                })
                .select('id')
                .single();

              if (accountError) {
                console.error('Error upserting account:', accountError);
                continue;
              }

              const bankAccountId = upsertedAccount?.id;
              if (!bankAccountId) {
                console.error('No bank account ID returned after upsert');
                continue;
              }

              // Fetch transactions for this account
              const transactionsResponse = await fetch(
                `https://api.pluggy.ai/transactions?accountId=${account.id}&pageSize=100`,
                { headers: { 'X-API-KEY': apiKey } }
              );

              if (transactionsResponse.ok) {
                const transactionsData = await transactionsResponse.json();
                console.log(`Transactions fetched for account ${account.id}:`, transactionsData.results?.length);

                for (const tx of transactionsData.results || []) {
                  // Prepare transaction data
                  const statementData: Record<string, unknown> = {
                    external_id: tx.id,
                    bank_account_id: bankAccountId, // Use UUID from our database
                    statement_date: tx.date,
                    amount: tx.amount,
                    description: tx.description || tx.descriptionRaw || '',
                    type: tx.type || (tx.amount >= 0 ? 'credit' : 'debit'),
                    category: tx.category || null,
                    imported_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };

                  // Add imported_by only if we have a valid UUID
                  if (createdBy) {
                    statementData.imported_by = createdBy;
                  }

                  const { error: txError } = await supabase
                    .from('bank_statements')
                    .upsert(statementData, {
                      onConflict: 'external_id',
                    });

                  if (txError) {
                    console.error('Error upserting transaction:', txError);
                  }
                }
              }
            }
          }

          // Update connection status
          if (connection) {
            await supabase
              .from('pluggy_connections')
              .update({ status: 'synced', updated_at: new Date().toISOString() })
              .eq('pluggy_item_id', itemId);
          }
        }
        break;

      case 'item/deleted':
        console.log('Item deleted:', data.item?.id);
        // Mark account as disconnected
        await supabase
          .from('bank_accounts')
          .update({ open_finance_status: 'disconnected' })
          .eq('pluggy_item_id', data.item?.id);
        
        // Update connection status
        await supabase
          .from('pluggy_connections')
          .update({ status: 'disconnected', updated_at: new Date().toISOString() })
          .eq('pluggy_item_id', data.item?.id);
        break;

      case 'item/error':
        console.error('Item error:', data.item?.id, data.error);
        // Update connection status to error
        await supabase
          .from('pluggy_connections')
          .update({ status: 'error', updated_at: new Date().toISOString() })
          .eq('pluggy_item_id', data.item?.id);
        break;

      default:
        console.log('Unknown event:', event);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to acknowledge webhook receipt
    return new Response(
      JSON.stringify({ success: true, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
