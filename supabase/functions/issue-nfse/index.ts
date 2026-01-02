import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to translate PlugNotas errors to Portuguese
function translatePlugNotasError(error: any): string {
  if (typeof error === 'string') {
    if (error.includes('inscricaoMunicipal')) return 'Inscrição Municipal do prestador é obrigatória'
    if (error.includes('cpfCnpj')) return 'CPF/CNPJ é obrigatório'
    if (error.includes('razaoSocial')) return 'Razão Social é obrigatória'
    if (error.includes('codigoCidade')) return 'Código da cidade (IBGE) é obrigatório'
    return error
  }
  if (error?.message) return translatePlugNotasError(error.message)
  if (error?.error) return translatePlugNotasError(error.error)
  if (Array.isArray(error)) return error.map(translatePlugNotasError).join('; ')
  return JSON.stringify(error)
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
      service_description: z.string().optional(),
      nature_operation: z.string().optional(),
      special_tax_regime: z.string().optional(),
    });

    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { 
      transaction_id, 
      service_code, 
      service_description,
      nature_operation,
      special_tax_regime 
    } = validation.data;

    console.log('=== EMISSÃO NFS-e INICIADA ===')
    console.log('Transaction ID:', transaction_id)
    console.log('Service Code:', service_code)

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

    console.log('Transação encontrada:', {
      id: transaction.id,
      description: transaction.description,
      gross_amount: transaction.gross_amount,
      customer: transaction.customers?.first_name || transaction.customers?.company_name
    })

    // 2. Buscar configurações da empresa
    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', transaction.company_id)
      .maybeSingle()

    if (!companySettings) {
      return new Response(
        JSON.stringify({ error: 'Configurações da empresa não encontradas. Configure antes de emitir NF.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Company Settings:', {
      company_name: companySettings.company_name,
      cnpj: companySettings.cnpj,
      municipal_inscription: companySettings.municipal_inscription,
      city_code: companySettings.city_code
    })

    // 2.1 VALIDAÇÕES PRÉ-EMISSÃO
    const validationErrors: string[] = []
    
    if (!companySettings.cnpj) {
      validationErrors.push('CNPJ da empresa não está configurado')
    }
    if (!companySettings.municipal_inscription) {
      validationErrors.push('Inscrição Municipal da empresa não está configurada')
    }
    if (!companySettings.city_code) {
      validationErrors.push('Código da cidade (IBGE) da empresa não está configurado')
    }
    if (!transaction.customers) {
      validationErrors.push('Transação não possui cliente vinculado')
    } else if (!transaction.customers.cpf && !transaction.customers.cnpj) {
      validationErrors.push('Cliente não possui CPF ou CNPJ cadastrado')
    }

    if (validationErrors.length > 0) {
      console.error('Erros de validação:', validationErrors)
      return new Response(
        JSON.stringify({ 
          error: 'Validação falhou', 
          details: validationErrors,
          message: validationErrors.join('. ')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Verificar se já tem NF emitida
    if (transaction.invoice_number && transaction.invoice_status === 'issued') {
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

    // SANDBOX AUTOMÁTICO: Se não tem token configurado, usar sandbox
    const SANDBOX_TOKEN = '2da392a6-79d2-4304-a8b7-576b3c623c8c'
    const useSandbox = !fiscalConfig?.plugnotas_token
    const plugnotasToken = fiscalConfig?.plugnotas_token || SANDBOX_TOKEN
    const plugnotasEnvironment = useSandbox ? 'SANDBOX' : (fiscalConfig?.plugnotas_environment || 'SANDBOX')

    console.log('Fiscal Config:', {
      environment: plugnotasEnvironment,
      status: fiscalConfig?.plugnotas_status,
      hasToken: !!fiscalConfig?.plugnotas_token,
      usingSandbox: useSandbox
    })

    let invoiceNumber = `NF-${Date.now()}`
    let invoiceKey = `CHAVE-${Date.now()}`
    let integrationUsed = 'MOCK'
    let plugnotasId: string | null = null
    let plugnotasError: string | null = null
    let sandboxMode = useSandbox
    
    // 5. Tentar PlugNotas (sempre, pois usamos sandbox automático)
    const baseUrl = plugnotasEnvironment === 'PRODUCTION'
      ? 'https://api.plugnotas.com.br'
      : 'https://api.sandbox.plugnotas.com.br'

      // Preparar endereço do tomador
      let tomadorEndereco: any = undefined
      if (transaction.customers?.address) {
        try {
          const addr = typeof transaction.customers.address === 'string' 
            ? JSON.parse(transaction.customers.address) 
            : transaction.customers.address
          tomadorEndereco = {
            logradouro: addr.street || 'Não informado',
            numero: addr.number || 'S/N',
            complemento: addr.complement || undefined,
            bairro: addr.neighborhood || 'Centro',
            codigoCidade: addr.city_code || companySettings.city_code,
            cep: (addr.zip || '').replace(/\D/g, '') || undefined,
            uf: addr.state || 'SP',
          }
        } catch (e) {
          console.log('Endereço não é JSON, usando como string')
          tomadorEndereco = {
            logradouro: String(transaction.customers.address),
            numero: 'S/N',
            bairro: 'Centro',
            codigoCidade: companySettings.city_code,
            uf: 'SP',
          }
        }
      }

      // Preparar payload para PlugNotas NFS-e
      const plugnotasPayload = {
        idIntegracao: transaction_id,
        prestador: {
          cpfCnpj: companySettings.cnpj?.replace(/\D/g, ''),
          inscricaoMunicipal: companySettings.municipal_inscription,
          razaoSocial: companySettings.company_name,
          simplesNacional: companySettings.tax_regime === 'SIMPLES',
          regimeEspecialTributacao: special_tax_regime || '6',
          incentivadorCultural: false,
        },
        tomador: {
          cpfCnpj: (transaction.customers?.cnpj || transaction.customers?.cpf)?.replace(/\D/g, ''),
          razaoSocial: transaction.customers?.company_name || 
                       `${transaction.customers?.first_name || ''} ${transaction.customers?.last_name || ''}`.trim(),
          email: transaction.customers?.email,
          endereco: tomadorEndereco,
        },
        servico: [{
          codigo: service_code || '01.01',
          codigoTributacao: service_code || '01.01',
          discriminacao: service_description || transaction.description || 'Serviços prestados conforme contrato',
          cnae: undefined, // Opcional
          iss: {
            tipoTributacao: 6,
            exigibilidade: 1,
            aliquota: transaction.iss_rate || 5,
            valorAliquota: transaction.iss_rate || 5,
            retido: false,
          },
          valor: {
            servico: transaction.gross_amount,
            baseCalculo: transaction.gross_amount,
          },
        }],
        naturezaOperacao: nature_operation || '1',
      }

      console.log('=== PAYLOAD PLUGNOTAS ===')
      console.log(JSON.stringify(plugnotasPayload, null, 2))

      try {
        console.log(`Enviando para: ${baseUrl}/nfse`)
        
        const plugnotasResponse = await fetch(`${baseUrl}/nfse`, {
          method: 'POST',
          headers: {
            'X-API-KEY': plugnotasToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(plugnotasPayload)
        })

        const responseText = await plugnotasResponse.text()
        console.log('PlugNotas Response Status:', plugnotasResponse.status)
        console.log('PlugNotas Response Body:', responseText)

        if (plugnotasResponse.ok) {
          const plugnotasData = JSON.parse(responseText)
          const result = Array.isArray(plugnotasData) ? plugnotasData[0] : plugnotasData
          
          plugnotasId = result.id?.integracao || result.id || transaction_id
          invoiceNumber = result.protocolo?.numero || result.id?.nfse || `PN-${Date.now()}`
          invoiceKey = result.protocolo?.id || result.id?.integracao || invoiceKey
          integrationUsed = 'PLUGNOTAS'
          console.log('✅ NFS-e enviada com sucesso:', { plugnotasId, invoiceNumber, invoiceKey })
        } else {
          // Parse e traduzir erro
          try {
            const errorData = JSON.parse(responseText)
            plugnotasError = translatePlugNotasError(errorData)
            console.error('❌ Erro PlugNotas:', plugnotasError)
          } catch {
            plugnotasError = responseText
            console.error('❌ Erro PlugNotas (raw):', responseText)
          }
        }
      } catch (error) {
        plugnotasError = error instanceof Error ? error.message : 'Erro de conexão com PlugNotas'
        console.error('❌ Erro ao chamar PlugNotas:', error)
      }
    
    // 6. Fallback para Focus NFe se PlugNotas não funcionou
    if (integrationUsed === 'MOCK' && focusNfeToken) {
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
      }
    }

    // Se houve erro no PlugNotas e não temos fallback, retornar erro detalhado
    if (integrationUsed === 'MOCK' && plugnotasError) {
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao emitir NFS-e via PlugNotas',
          details: plugnotasError,
          message: plugnotasError
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Atualizar transação com dados da NF
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        invoice_number: invoiceNumber,
        invoice_key: invoiceKey,
        invoice_status: integrationUsed === 'MOCK' ? 'pending' : 'processing',
        invoice_integration_id: plugnotasId,
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

    // 9. Criar auditoria (apenas se tiver user_id)
    if (transaction.created_by) {
      await supabase.from('audit_logs').insert({
        user_id: transaction.created_by,
        user_role: 'FISCAL',
        action: 'issue_nfse',
        details: `NFS-e ${invoiceNumber} emitida via ${integrationUsed} para transação ${transaction_id}`,
      })
    }

    console.log('=== EMISSÃO NFS-e CONCLUÍDA ===')
    console.log('Integration:', integrationUsed)
    console.log('Invoice Number:', invoiceNumber)

    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoiceNumber,
        invoice_key: invoiceKey,
        integration: integrationUsed,
        plugnotas_id: plugnotasId,
        sandbox_mode: sandboxMode,
        status: integrationUsed === 'MOCK' ? 'pending' : 'processing',
        message: sandboxMode 
          ? 'Nota fiscal emitida em modo SANDBOX (teste).'
          : 'Nota fiscal enviada para processamento.',
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
