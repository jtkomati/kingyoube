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
      return new Response(JSON.stringify({ error: 'Auth failed' }), { 
        status: 500, 
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

        if (status === 'UPDATED') {
          // Fetch accounts for this item
          const accountsResponse = await fetch(`https://api.pluggy.ai/items/${itemId}/accounts`, {
            headers: { 'X-API-KEY': apiKey },
          });

          if (accountsResponse.ok) {
            const accountsData = await accountsResponse.json();
            console.log('Accounts fetched:', accountsData.results?.length);

            for (const account of accountsData.results || []) {
              // Update or insert bank account
              const { error: accountError } = await supabase
                .from('bank_accounts')
                .upsert({
                  pluggy_item_id: itemId,
                  pluggy_account_id: account.id,
                  bank_name: account.bankData?.name || 'Banco',
                  account_type: account.type,
                  account_number: account.number,
                  agency: account.bankData?.code,
                  balance: account.balance,
                  currency: account.currencyCode || 'BRL',
                  last_sync_at: new Date().toISOString(),
                  open_finance_status: 'connected',
                }, {
                  onConflict: 'pluggy_account_id',
                });

              if (accountError) {
                console.error('Error upserting account:', accountError);
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
                  const { error: txError } = await supabase
                    .from('bank_statements')
                    .upsert({
                      external_id: tx.id,
                      bank_account_id: account.id,
                      statement_date: tx.date,
                      amount: tx.amount,
                      description: tx.description,
                      type: tx.type,
                      category: tx.category,
                      imported_at: new Date().toISOString(),
                      imported_by: 'pluggy-webhook',
                    }, {
                      onConflict: 'external_id',
                    });

                  if (txError) {
                    console.error('Error upserting transaction:', txError);
                  }
                }
              }
            }
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
