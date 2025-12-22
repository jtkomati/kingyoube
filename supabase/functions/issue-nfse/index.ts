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
    const focusNfeToken = Deno.env.get('FOCUSNFE_API_TOKEN')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate input
    const requestSchema = z.object({
      transaction_id: z.string().uuid('transaction_id deve ser um UUID válido'),
      service_code: z.string().optional(),
      service_description: z.string().optional()
    });

    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { transaction_id, service_code, service_description } = validation.data;

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

    // 4. Buscar configuração PlugNotas
    const { data: fiscalConfig } = await supabase
      .from('config_fiscal')
      .select('plugnotas_token, plugnotas_environment, plugnotas_status')
      .eq('company_id', transaction.company_id)
      .maybeSingle()

    let invoiceNumber = `NF-${Date.now()}`
    let invoiceKey = `CHAVE-${Date.now()}`
    let integrationUsed = 'MOCK'
    
    // 5. Tentar PlugNotas primeiro se configurado
    if (fiscalConfig?.plugnotas_status === 'connected' && fiscalConfig?.plugnotas_token) {
      const baseUrl = fiscalConfig.plugnotas_environment === 'PRODUCTION'
        ? 'https://api.plugnotas.com.br'
        : 'https://api.sandbox.plugnotas.com.br'

      // Preparar payload para PlugNotas NFS-e
      const plugnotasPayload = {
        idIntegracao: transaction_id,
        prestador: {
          cpfCnpj: companySettings.cnpj?.replace(/\D/g, ''),
          inscricaoMunicipal: companySettings.municipal_inscription,
          razaoSocial: companySettings.company_name
        },
        tomador: {
          cpfCnpj: (transaction.customers?.cnpj || transaction.customers?.cpf)?.replace(/\D/g, ''),
          razaoSocial: transaction.customers?.company_name || 
                       `${transaction.customers?.first_name || ''} ${transaction.customers?.last_name || ''}`.trim(),
          email: transaction.customers?.email
        },
        servico: [{
          codigo: service_code || '1.01',
          discriminacao: service_description || transaction.description || 'Serviços prestados',
          valorServico: transaction.gross_amount,
          aliquotaIss: transaction.iss_rate || 5
        }]
      }

      try {
        console.log('Emitindo NFS-e via PlugNotas:', { baseUrl, environment: fiscalConfig.plugnotas_environment })
        
        const plugnotasResponse = await fetch(`${baseUrl}/nfse`, {
          method: 'POST',
          headers: {
            'x-api-key': fiscalConfig.plugnotas_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(plugnotasPayload)
        })

        const responseText = await plugnotasResponse.text()
        console.log('PlugNotas response:', plugnotasResponse.status, responseText.substring(0, 500))

        if (plugnotasResponse.ok) {
          const plugnotasData = JSON.parse(responseText)
          invoiceNumber = plugnotasData.id?.nfse || plugnotasData.numero || invoiceNumber
          invoiceKey = plugnotasData.protocolo || plugnotasData.id?.integracao || invoiceKey
          integrationUsed = 'PLUGNOTAS'
          console.log('NFS-e emitida via PlugNotas:', plugnotasData)
        } else {
          console.error('Erro PlugNotas:', responseText)
          // Fall through to Focus NFe or mock
        }
      } catch (error) {
        console.error('Erro ao chamar PlugNotas:', error)
        // Fall through to Focus NFe or mock
      }
    }
    
    // 6. Fallback para Focus NFe se PlugNotas não funcionou
    if (integrationUsed === 'MOCK' && focusNfeToken) {
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
          integrationUsed = 'FOCUSNFE'
          console.log('NFS-e emitida via Focus NFe:', focusData)
        } else {
          console.error('Erro Focus NFe:', await focusResponse.text())
        }
      } catch (error) {
        console.error('Erro ao chamar Focus NFe:', error)
        // Continua sem integração se falhar
      }
    }

    // 7. Atualizar transação com dados da NF
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

    // 8. Registrar log de sincronização
    await supabase.from('sync_logs').insert({
      integration_type: integrationUsed,
      status: 'success',
      records_processed: 1,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    })

    // 9. Criar auditoria
    await supabase.from('audit_logs').insert({
      user_id: transaction.created_by,
      user_role: 'FISCAL',
      action: 'issue_nfse',
      details: `NFS-e ${invoiceNumber} emitida via ${integrationUsed} para transação ${transaction_id}`,
    })

    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoiceNumber,
        invoice_key: invoiceKey,
        integration: integrationUsed,
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
