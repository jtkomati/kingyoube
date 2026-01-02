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
      reason: z.string().min(15, 'Motivo deve ter pelo menos 15 caracteres'),
    });

    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { transaction_id, reason } = validation.data;
    console.log('Cancelando NFS-e:', { transaction_id, reason })

    // 1. Buscar transação
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, company_id, created_by')
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

    if (transaction.invoice_status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: 'Esta nota fiscal já está cancelada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Buscar configuração PlugNotas
    const { data: fiscalConfig } = await supabase
      .from('config_fiscal')
      .select('plugnotas_token, plugnotas_environment, plugnotas_status')
      .eq('company_id', transaction.company_id)
      .maybeSingle()

    let cancelledViaIntegration = false

    if (fiscalConfig?.plugnotas_token && fiscalConfig.plugnotas_status === 'connected') {
      const baseUrl = fiscalConfig.plugnotas_environment === 'PRODUCTION'
        ? 'https://api.plugnotas.com.br'
        : 'https://api.sandbox.plugnotas.com.br'

      const integrationId = transaction.invoice_integration_id || transaction_id

      console.log('Cancelando via PlugNotas:', { baseUrl, integrationId })

      try {
        const plugnotasResponse = await fetch(`${baseUrl}/nfse/${integrationId}/cancelar`, {
          method: 'POST',
          headers: {
            'x-api-key': fiscalConfig.plugnotas_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            motivo: reason,
          })
        })

        const responseText = await plugnotasResponse.text()
        console.log('PlugNotas cancel response:', plugnotasResponse.status, responseText.substring(0, 500))

        if (plugnotasResponse.ok) {
          cancelledViaIntegration = true
          console.log('NFS-e cancelada via PlugNotas')
        } else {
          console.error('Erro ao cancelar no PlugNotas:', responseText)
          // Continuar para cancelar localmente
        }
      } catch (error) {
        console.error('Erro ao chamar PlugNotas:', error)
      }
    }

    // 3. Atualizar transação
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        invoice_status: 'cancelled',
        invoice_cancelled_at: new Date().toISOString(),
        invoice_cancel_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction_id)

    if (updateError) {
      console.error('Erro ao atualizar transação:', updateError)
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar transação: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Registrar log de sincronização
    await supabase.from('sync_logs').insert({
      integration_type: cancelledViaIntegration ? 'PLUGNOTAS' : 'LOCAL',
      status: 'success',
      records_processed: 1,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    })

    // 5. Criar auditoria
    await supabase.from('audit_logs').insert({
      user_id: transaction.created_by,
      user_role: 'FISCAL',
      action: 'cancel_nfse',
      details: `NFS-e ${transaction.invoice_number} cancelada. Motivo: ${reason}`,
    })

    return new Response(
      JSON.stringify({
        success: true,
        cancelled_via_integration: cancelledViaIntegration,
        message: cancelledViaIntegration 
          ? 'Nota fiscal cancelada com sucesso no PlugNotas'
          : 'Nota fiscal marcada como cancelada localmente. Verifique o cancelamento na prefeitura.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro ao cancelar NFS-e:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
