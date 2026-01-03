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

    const { accountHash, companyId, syncType = 'MANUAL' } = await req.json();

    if (!accountHash || !companyId) {
      return new Response(JSON.stringify({ error: 'accountHash and companyId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tecnospeedToken = Deno.env.get('TECNOSPEED_TOKEN');
    const cnpjSH = Deno.env.get('TECNOSPEED_CNPJ_SOFTWAREHOUSE');

    if (!tecnospeedToken || !cnpjSH) {
      return new Response(JSON.stringify({ error: 'TecnoSpeed credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create sync log
    const { data: syncLog, error: logError } = await serviceClient
      .from('dda_sync_logs')
      .insert({
        company_id: companyId,
        account_hash: accountHash,
        sync_type: syncType,
        status: 'PROCESSING',
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log:', logError);
    }

    console.log(`Starting DDA sync for account ${accountHash}`);

    // Call TecnoSpeed API to get DDA billets
    const response = await fetch(`https://api.bancos.tecnospeed.com.br/api/v1/dda/list?contaHash=${accountHash}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tecnospeedToken}`,
        'cnpj-sh': cnpjSH,
      },
    });

    const responseText = await response.text();
    console.log(`TecnoSpeed DDA list response: ${response.status}`);

    if (!response.ok) {
      // Update sync log with error
      if (syncLog) {
        await serviceClient
          .from('dda_sync_logs')
          .update({
            status: 'ERROR',
            error_message: responseText,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }

      return new Response(JSON.stringify({ 
        error: 'Failed to fetch DDA billets from TecnoSpeed', 
        details: responseText 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let ddaBoletos = [];
    try {
      ddaBoletos = JSON.parse(responseText);
      if (!Array.isArray(ddaBoletos)) {
        ddaBoletos = ddaBoletos.data || ddaBoletos.boletos || [];
      }
    } catch (e) {
      console.error('Error parsing DDA response:', e);
      ddaBoletos = [];
    }

    console.log(`Found ${ddaBoletos.length} DDA billets`);

    let newBoletosCount = 0;

    // Process each billet
    for (const boleto of ddaBoletos) {
      const uniqueId = boleto.uniqueId || boleto.codigoBarras || `${accountHash}-${boleto.nossoNumero}`;

      // Check if billet already exists
      const { data: existing } = await supabaseClient
        .from('dda_boletos')
        .select('id')
        .eq('unique_id', uniqueId)
        .single();

      if (!existing) {
        // Insert new billet
        const { error: insertError } = await serviceClient
          .from('dda_boletos')
          .insert({
            company_id: companyId,
            account_hash: accountHash,
            unique_id: uniqueId,
            barcode: boleto.codigoBarras || boleto.barcode,
            digitable_line: boleto.linhaDigitavel || boleto.digitableLine,
            beneficiary_name: boleto.beneficiarioNome || boleto.cedente?.nome,
            beneficiary_cpf_cnpj: boleto.beneficiarioCpfCnpj || boleto.cedente?.cpfCnpj,
            beneficiary_bank_code: boleto.bancoCodigo || boleto.banco?.codigo,
            beneficiary_bank_name: boleto.bancoNome || boleto.banco?.nome,
            nominal_amount: parseFloat(boleto.valorNominal || boleto.valor || 0),
            discount_amount: parseFloat(boleto.valorDesconto || 0),
            interest_amount: parseFloat(boleto.valorJuros || 0),
            fine_amount: parseFloat(boleto.valorMulta || 0),
            final_amount: parseFloat(boleto.valorFinal || boleto.valorNominal || boleto.valor || 0),
            issue_date: boleto.dataEmissao || boleto.emissao,
            due_date: boleto.dataVencimento || boleto.vencimento,
            our_number: boleto.nossoNumero,
            document_number: boleto.numeroDocumento,
            description: boleto.descricao,
            dda_file_id: boleto.arquivoId,
            status: 'PENDING',
            raw_data: boleto,
          });

        if (insertError) {
          console.error('Error inserting DDA billet:', insertError);
        } else {
          newBoletosCount++;
        }
      }
    }

    // Update sync log with success
    if (syncLog) {
      await serviceClient
        .from('dda_sync_logs')
        .update({
          status: 'SUCCESS',
          boletos_found: ddaBoletos.length,
          boletos_new: newBoletosCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    console.log(`DDA sync completed: ${ddaBoletos.length} found, ${newBoletosCount} new`);

    return new Response(JSON.stringify({ 
      success: true, 
      boletosFound: ddaBoletos.length,
      boletosNew: newBoletosCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in payment-dda-sync:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
