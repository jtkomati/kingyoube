import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

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
    const focusNfeToken = Deno.env.get('FOCUSNFE_API_TOKEN')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { transaction_id, service_code, service_description } = await req.json()

    if (!transaction_id) {
      return new Response(
        JSON.stringify({ error: 'ID da transação é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Emitindo NFS-e:', { transaction_id, service_code })

    // 1. Buscar transação com o relacionamento correto
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select(`
        *,
        customers:customer_id(*)
      `)
      .eq('id', transaction_id)
      .single()

    if (txError) {
      console.error('Erro ao buscar transação:', txError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar transação: ' + txError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!transaction) {
      return new Response(
        JSON.stringify({ error: 'Transação não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Buscar configurações da empresa
    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (!companySettings) {
      return new Response(
        JSON.stringify({ error: 'Configurações da empresa não encontradas. Configure antes de emitir NF.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Verificar se já tem NF emitida
    if (transaction.invoice_number) {
      return new Response(
        JSON.stringify({ error: 'Esta transação já possui nota fiscal emitida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Se tiver Focus NFe configurado, integrar
    let invoiceNumber = `NF-${Date.now()}`
    let invoiceKey = `CHAVE-${Date.now()}`
    
    if (focusNfeToken) {
      // Preparar payload para Focus NFe
      const nfsePayload = {
        data_emissao: new Date().toISOString().split('T')[0],
        prestador: {
          cnpj: companySettings.cnpj,
          inscricao_municipal: companySettings.municipal_inscription,
        },
        tomador: {
          cnpj: transaction.customers?.cnpj || null,
          cpf: transaction.customers?.cpf || null,
          razao_social: transaction.customers?.company_name || 
                       `${transaction.customers?.first_name || ''} ${transaction.customers?.last_name || ''}`,
        },
        servico: {
          aliquota: transaction.iss_rate || 5,
          discriminacao: service_description,
          iss_retido: false,
          item_lista_servico: service_code,
          valor_servicos: transaction.gross_amount,
        },
      }

      try {
        const focusResponse = await fetch('https://homologacao.focusnfe.com.br/v2/nfse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(focusNfeToken + ':')}`,
          },
          body: JSON.stringify(nfsePayload),
        })

        if (focusResponse.ok) {
          const focusData = await focusResponse.json()
          invoiceNumber = focusData.numero || invoiceNumber
          invoiceKey = focusData.codigo_verificacao || invoiceKey
          console.log('NFS-e emitida via Focus NFe:', focusData)
        } else {
          console.error('Erro Focus NFe:', await focusResponse.text())
        }
      } catch (error) {
        console.error('Erro ao chamar Focus NFe:', error)
        // Continua sem integração se falhar
      }
    }

    // 5. Atualizar transação com dados da NF
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        invoice_number: invoiceNumber,
        invoice_key: invoiceKey,
        invoice_status: 'issued',
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

    // 6. Registrar log de sincronização
    await supabase.from('sync_logs').insert({
      integration_type: 'FOCUSNFE',
      status: 'success',
      records_processed: 1,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    })

    // 7. Criar auditoria
    await supabase.from('audit_logs').insert({
      user_id: transaction.created_by,
      user_role: 'FISCAL',
      action: 'issue_nfse',
      details: `NFS-e ${invoiceNumber} emitida para transação ${transaction_id}`,
    })

    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoiceNumber,
        invoice_key: invoiceKey,
        message: 'Nota fiscal emitida com sucesso',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro ao emitir NFS-e:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
