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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { boletoId, action, paymentDate, description } = await req.json();

    if (!boletoId || !action) {
      return new Response(JSON.stringify({ error: 'boletoId and action are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the DDA boleto
    const { data: boleto, error: boletoError } = await supabaseClient
      .from('dda_boletos')
      .select('*')
      .eq('id', boletoId)
      .single();

    if (boletoError || !boleto) {
      return new Response(JSON.stringify({ error: 'DDA boleto not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'ignore') {
      // Mark as ignored
      const { error: updateError } = await serviceClient
        .from('dda_boletos')
        .update({
          status: 'IGNORED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', boletoId);

      if (updateError) {
        console.error('Error updating boleto:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to update boleto' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, action: 'ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'pay') {
      const tecnospeedToken = Deno.env.get('TECNOSPEED_TOKEN');
      const cnpjSH = Deno.env.get('TECNOSPEED_CNPJ_SOFTWAREHOUSE');

      if (!tecnospeedToken || !cnpjSH) {
        return new Response(JSON.stringify({ error: 'TecnoSpeed credentials not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create payment in TecnoSpeed
      const paymentData = {
        contaHash: boleto.account_hash,
        tipoPagamento: 'BOLETO',
        codigoBarras: boleto.barcode,
        valor: boleto.final_amount,
        dataPagamento: paymentDate || new Date().toISOString().split('T')[0],
        descricao: description || boleto.description || `Pagamento DDA - ${boleto.beneficiary_name}`,
      };

      console.log('Creating DDA payment:', paymentData);

      const response = await fetch('https://api.bancos.tecnospeed.com.br/api/v1/pagamentos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tecnospeedToken}`,
          'cnpj-sh': cnpjSH,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const responseText = await response.text();
      console.log(`TecnoSpeed payment response: ${response.status} - ${responseText}`);

      let paymentResult;
      try {
        paymentResult = JSON.parse(responseText);
      } catch (e) {
        paymentResult = { message: responseText };
      }

      if (!response.ok) {
        return new Response(JSON.stringify({ 
          error: 'Failed to create payment in TecnoSpeed', 
          details: paymentResult 
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create local bank payment record
      const { data: payment, error: paymentError } = await serviceClient
        .from('bank_payments')
        .insert({
          company_id: boleto.company_id,
          account_hash: boleto.account_hash,
          payment_type: 'BOLETO',
          payment_form: 'DDA',
          barcode: boleto.barcode,
          amount: boleto.final_amount,
          nominal_amount: boleto.nominal_amount,
          discount_amount: boleto.discount_amount,
          interest_amount: boleto.interest_amount,
          fine_amount: boleto.fine_amount,
          beneficiary_name: boleto.beneficiary_name,
          beneficiary_cpf_cnpj: boleto.beneficiary_cpf_cnpj,
          due_date: boleto.due_date,
          payment_date: paymentDate || new Date().toISOString().split('T')[0],
          description: description || boleto.description,
          unique_id: paymentResult.uniqueId || paymentResult.idIntegracao,
          status: 'CREATED',
          metadata: {
            dda_boleto_id: boletoId,
            tecnospeed_response: paymentResult,
          },
        })
        .select()
        .single();

      if (paymentError) {
        console.error('Error creating bank payment:', paymentError);
        return new Response(JSON.stringify({ error: 'Failed to create local payment record' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update DDA boleto status
      await serviceClient
        .from('dda_boletos')
        .update({
          status: 'PAID',
          processed_at: new Date().toISOString(),
          payment_id: payment.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boletoId);

      return new Response(JSON.stringify({ 
        success: true, 
        action: 'paid',
        paymentId: payment.id,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use "pay" or "ignore"' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in payment-dda-process:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
