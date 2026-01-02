import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const requestSchema = z.object({
      transaction_id: z.string().uuid('transaction_id deve ser um UUID válido'),
    });

    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { transaction_id } = validation.data;
    console.log('Consultando status NFS-e:', { transaction_id })

    // 1. Buscar transação
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, company_id')
      .eq('id', transaction_id)
      .single()

    if (txError || !transaction) {
      return new Response(
        JSON.stringify({ error: 'Transação não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!transaction.invoice_number) {
      return new Response(
        JSON.stringify({ error: 'Esta transação não possui nota fiscal emitida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Buscar configuração PlugNotas
    const { data: fiscalConfig } = await supabase
      .from('config_fiscal')
      .select('plugnotas_token, plugnotas_environment, plugnotas_status')
      .eq('company_id', transaction.company_id)
      .maybeSingle()

    if (!fiscalConfig?.plugnotas_token || fiscalConfig.plugnotas_status !== 'connected') {
      return new Response(
        JSON.stringify({ 
          success: true,
          status: transaction.invoice_status,
          invoice_number: transaction.invoice_number,
          message: 'Sem integração PlugNotas configurada para consulta'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseUrl = fiscalConfig.plugnotas_environment === 'PRODUCTION'
      ? 'https://api.plugnotas.com.br'
      : 'https://api.sandbox.plugnotas.com.br'

    // 3. Consultar status no PlugNotas
    const integrationId = transaction.invoice_integration_id || transaction_id
    
    console.log('Consultando PlugNotas:', { baseUrl, integrationId })
    
    const plugnotasResponse = await fetch(`${baseUrl}/nfse/${integrationId}`, {
      method: 'GET',
      headers: {
        'x-api-key': fiscalConfig.plugnotas_token,
        'Content-Type': 'application/json'
      }
    })

    const responseText = await plugnotasResponse.text()
    console.log('PlugNotas status response:', plugnotasResponse.status, responseText.substring(0, 500))

    if (!plugnotasResponse.ok) {
      // Se 404, pode ser que ainda não processou
      if (plugnotasResponse.status === 404) {
        return new Response(
          JSON.stringify({ 
            success: true,
            status: 'processing',
            invoice_number: transaction.invoice_number,
            message: 'Nota fiscal ainda em processamento'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar status: ' + responseText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const plugnotasData = JSON.parse(responseText)
    
    // 4. Mapear status do PlugNotas para nosso sistema
    let newStatus = transaction.invoice_status
    let nfseNumber = transaction.invoice_number
    let nfseKey = transaction.invoice_key
    
    // Status possíveis do PlugNotas:
    // CONCLUIDO - Nota autorizada
    // REJEITADO - Nota rejeitada
    // PROCESSANDO - Em processamento
    // ERRO - Erro no processamento
    // CANCELADO - Nota cancelada
    
    const plugnotasStatus = plugnotasData.situacao || plugnotasData.status
    
    switch (plugnotasStatus) {
      case 'CONCLUIDO':
        newStatus = 'issued'
        nfseNumber = plugnotasData.numero || plugnotasData.nfse?.numero || nfseNumber
        nfseKey = plugnotasData.codigoVerificacao || plugnotasData.nfse?.codigoVerificacao || nfseKey
        break
      case 'REJEITADO':
      case 'ERRO':
        newStatus = 'rejected'
        break
      case 'CANCELADO':
        newStatus = 'cancelled'
        break
      case 'PROCESSANDO':
        newStatus = 'processing'
        break
    }

    // 5. Atualizar transação se status mudou
    if (newStatus !== transaction.invoice_status || nfseNumber !== transaction.invoice_number) {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          invoice_status: newStatus,
          invoice_number: nfseNumber,
          invoice_key: nfseKey,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction_id)

      if (updateError) {
        console.error('Erro ao atualizar status:', updateError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        invoice_number: nfseNumber,
        invoice_key: nfseKey,
        plugnotas_status: plugnotasStatus,
        plugnotas_data: {
          numero: plugnotasData.numero,
          serie: plugnotasData.serie,
          dataEmissao: plugnotasData.dataEmissao,
          valor: plugnotasData.valor,
          codigoVerificacao: plugnotasData.codigoVerificacao,
          mensagem: plugnotasData.mensagem,
        },
        message: newStatus === 'issued' 
          ? 'Nota fiscal autorizada com sucesso'
          : newStatus === 'rejected'
          ? `Nota fiscal rejeitada: ${plugnotasData.mensagem || 'Verifique os dados'}`
          : 'Nota fiscal em processamento'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro ao consultar status NFS-e:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
