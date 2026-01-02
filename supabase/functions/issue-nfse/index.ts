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
    if (error.includes('Empresa com os parâmetros')) return 'Empresa não encontrada no PlugNotas'
    if (error.includes('array de documentos')) return 'Formato de requisição inválido'
    if (error.includes('logradouro')) return 'Endereço: logradouro deve ter no máximo 60 caracteres'
    if (error.includes('estado')) return 'Endereço: estado é obrigatório (ex: SP)'
    return error
  }
  
  // Handle structured validation errors from PlugNotas
  if (error?.error?.data?.fields) {
    const fields = error.error.data.fields
    const fieldErrors: string[] = []
    for (const [field, msg] of Object.entries(fields)) {
      const fieldName = field.replace('endereco.', '')
      fieldErrors.push(`${fieldName}: ${msg}`)
    }
    return 'Erro de validação: ' + fieldErrors.join('; ')
  }
  
  if (error?.message) return translatePlugNotasError(error.message)
  if (error?.error?.message) return error.error.message
  if (error?.error) return translatePlugNotasError(error.error)
  if (Array.isArray(error)) return error.map(translatePlugNotasError).join('; ')
  return JSON.stringify(error)
}

// Helper to sanitize address for PlugNotas (max 60 chars for logradouro)
function sanitizeAddress(fullAddress: string): { logradouro: string; numero: string; estado: string } {
  if (!fullAddress) {
    return { logradouro: "Rua Teste", numero: "100", estado: "SP" }
  }
  
  // Split by comma to get parts
  const parts = fullAddress.split(',').map(p => p.trim())
  
  // First part is usually the street name
  let logradouro = parts[0] || "Rua Teste"
  
  // Extract number from second part if exists
  let numero = "S/N"
  if (parts[1]) {
    const numMatch = parts[1].match(/^(\d+)/)
    if (numMatch) {
      numero = numMatch[1]
    }
  }
  
  // Extract state (UF) - look for 2-letter state code
  let estado = "SP"
  const ufMatch = fullAddress.match(/\b([A-Z]{2})\b/)
  if (ufMatch) {
    const possibleUf = ufMatch[1]
    const validUfs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
    if (validUfs.includes(possibleUf)) {
      estado = possibleUf
    }
  }
  
  // Truncate logradouro to 60 chars (PlugNotas limit)
  if (logradouro.length > 60) {
    logradouro = logradouro.substring(0, 57) + '...'
  }
  
  return { logradouro, numero, estado }
}

// Função para garantir que a empresa existe no PlugNotas (SANDBOX)
async function ensurePlugNotasCompanyExists(
  companySettings: any,
  plugnotasToken: string,
  baseUrl: string
): Promise<{ exists: boolean; error?: string; validationError?: boolean }> {
  const cnpjDigits = (companySettings.cnpj || '').replace(/\D/g, '')
  const maskedCnpj = `***${cnpjDigits.slice(-4)}`
  
  if (!cnpjDigits) {
    return { exists: false, error: 'CNPJ não configurado' }
  }
  
  console.log(`🔍 Verificando empresa ${maskedCnpj} no PlugNotas...`)
  
  // 1. Verificar se empresa já existe
  try {
    const getResponse = await fetch(`${baseUrl}/empresa/${cnpjDigits}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': plugnotasToken,
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`GET /empresa/${maskedCnpj} status: ${getResponse.status}`)
    
    if (getResponse.status === 200) {
      console.log(`✅ Empresa ${maskedCnpj} já cadastrada no PlugNotas`)
      return { exists: true }
    }
    
    if (getResponse.status !== 404) {
      const errorText = await getResponse.text()
      console.error(`❌ Erro inesperado ao verificar empresa: ${errorText.substring(0, 200)}`)
    }
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error(`❌ Erro de rede ao verificar empresa: ${errMsg}`)
  }
  
  // 2. Empresa não existe, tentar cadastrar
  console.log(`📝 Cadastrando empresa ${maskedCnpj} no PlugNotas SANDBOX...`)
  
  // Sanitize address properly
  const sanitized = sanitizeAddress(companySettings.address || '')
  
  const endereco = {
    logradouro: sanitized.logradouro,
    numero: companySettings.address_number || sanitized.numero,
    bairro: companySettings.neighborhood || "Centro",
    codigoCidade: companySettings.city_code || "3550308",
    cep: (companySettings.postal_code || "01310100").replace(/\D/g, ''),
    estado: companySettings.state || sanitized.estado  // CRITICAL: usar "estado" não "uf"
  }
  
  const empresaPayload = {
    cpfCnpj: cnpjDigits,
    inscricaoMunicipal: companySettings.municipal_inscription || "123456",
    razaoSocial: companySettings.company_name || "Empresa Teste",
    nomeFantasia: companySettings.trade_name || companySettings.company_name || "Empresa Teste",
    simplesNacional: companySettings.tax_regime === 'SIMPLES' || true,
    regimeTributario: 1,
    regimeTributarioEspecial: 0,
    endereco: endereco,
    telefone: {
      ddd: "11",
      numero: "999999999"
    },
    email: companySettings.notification_email || companySettings.email || "teste@exemplo.com",
    nfse: {
      ativo: true,
      tipoContrato: 0,
      config: {
        producao: false,
        rps: { lote: 1, serie: "RPS", numero: 1 },
        prefeitura: {
          login: companySettings.nfse_login || "teste",
          senha: companySettings.nfse_password || "teste"
        }
      }
    }
  }
  
  console.log('Payload empresa:', JSON.stringify(empresaPayload, null, 2))
  
  try {
    const postResponse = await fetch(`${baseUrl}/empresa`, {
      method: 'POST',
      headers: {
        'X-API-KEY': plugnotasToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(empresaPayload)
    })
    
    const postText = await postResponse.text()
    console.log(`POST /empresa status: ${postResponse.status}`)
    console.log(`POST /empresa response: ${postText.substring(0, 500)}`)
    
    if (postResponse.status === 201 || postResponse.status === 200) {
      console.log(`✅ Empresa ${maskedCnpj} cadastrada com sucesso no PlugNotas`)
      return { exists: true }
    }
    
    if (postResponse.status === 409 || postText.includes('já existe') || postText.includes('already exists')) {
      console.log(`✅ Empresa ${maskedCnpj} já existia (conflict)`)
      return { exists: true }
    }
    
    // Parse validation errors
    let errorMsg = "Erro ao cadastrar empresa"
    let isValidationError = false
    try {
      const errorData = JSON.parse(postText)
      if (errorData?.error?.data?.fields) {
        isValidationError = true
        const fields = errorData.error.data.fields
        const fieldErrors: string[] = []
        for (const [field, msg] of Object.entries(fields)) {
          fieldErrors.push(`${field}: ${msg}`)
        }
        errorMsg = 'Validação: ' + fieldErrors.join('; ')
      } else {
        errorMsg = errorData?.error?.message || errorData?.message || postText.substring(0, 200)
      }
    } catch {
      errorMsg = postText.substring(0, 200)
    }
    
    console.error(`❌ Erro ao cadastrar empresa: ${errorMsg}`)
    return { exists: false, error: errorMsg, validationError: isValidationError }
    
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error(`❌ Erro de rede ao cadastrar empresa: ${errMsg}`)
    return { exists: false, error: `Erro de conexão: ${errMsg}` }
  }
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
        JSON.stringify({ success: false, message: validation.error.errors[0].message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ success: false, message: 'Erro ao buscar transação: ' + txError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!transaction) {
      return new Response(
        JSON.stringify({ success: false, message: 'Transação não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ success: false, message: 'Configurações da empresa não encontradas. Configure antes de emitir NF.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          success: false,
          message: 'Validação falhou: ' + validationErrors.join('. ')
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Verificar se já tem NF emitida
    if (transaction.invoice_number && transaction.invoice_status === 'issued') {
      return new Response(
        JSON.stringify({ success: false, message: 'Esta transação já possui nota fiscal emitida' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Buscar configuração PlugNotas
    const { data: fiscalConfig } = await supabase
      .from('config_fiscal')
      .select('plugnotas_token, plugnotas_environment, plugnotas_status')
      .eq('company_id', transaction.company_id)
      .maybeSingle()

    // SANDBOX AUTOMÁTICO: Token oficial do sandbox PlugNotas
    const SANDBOX_TOKEN = '2da392a6-79d2-4304-a8b7-959572c7e44d'
    const isSandboxEnvironment = !fiscalConfig?.plugnotas_environment || fiscalConfig.plugnotas_environment === 'SANDBOX'
    
    // Se ambiente é SANDBOX, SEMPRE usar o token sandbox oficial
    const plugnotasToken = isSandboxEnvironment ? SANDBOX_TOKEN : (fiscalConfig?.plugnotas_token || SANDBOX_TOKEN)
    const plugnotasEnvironment = isSandboxEnvironment ? 'SANDBOX' : fiscalConfig.plugnotas_environment

    console.log('Fiscal Config:', {
      environment: plugnotasEnvironment,
      status: fiscalConfig?.plugnotas_status,
      hasToken: !!fiscalConfig?.plugnotas_token,
      usingSandbox: isSandboxEnvironment
    })

    let invoiceNumber = `NF-${Date.now()}`
    let invoiceKey = `CHAVE-${Date.now()}`
    let integrationUsed = 'MOCK'
    let plugnotasId: string | null = null
    let plugnotasError: string | null = null
    let sandboxMode = isSandboxEnvironment
    
    // 5. Determinar URL base
    const baseUrl = plugnotasEnvironment === 'PRODUCTION'
      ? 'https://api.plugnotas.com.br'
      : 'https://api.sandbox.plugnotas.com.br'

    // 5.1 SANDBOX: Garantir que empresa existe no PlugNotas antes de emitir
    if (isSandboxEnvironment) {
      const companyCheck = await ensurePlugNotasCompanyExists(
        companySettings,
        plugnotasToken,
        baseUrl
      )
      
      if (!companyCheck.exists) {
        console.error('Falha ao garantir empresa no PlugNotas:', companyCheck.error)
        
        // Se foi erro de validação, bloquear a emissão com mensagem clara
        if (companyCheck.validationError) {
          return new Response(
            JSON.stringify({ 
              success: false,
              message: 'Não foi possível cadastrar a empresa no PlugNotas.',
              details: companyCheck.error
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        // Para outros erros, continuar tentando (pode funcionar)
      }
    }

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
        cnae: undefined,
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

    // Função para tentar emitir NFS-e
    const tryEmitNfse = async (): Promise<{ ok: boolean; data?: any; error?: string; alreadyIssued?: boolean }> => {
      console.log(`Enviando para: ${baseUrl}/nfse`)
      
      const plugnotasResponse = await fetch(`${baseUrl}/nfse`, {
        method: 'POST',
        headers: {
          'X-API-KEY': plugnotasToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([plugnotasPayload]) // ARRAY de documentos
      })

      const responseText = await plugnotasResponse.text()
      console.log('PlugNotas Response Status:', plugnotasResponse.status)
      console.log('PlugNotas Response Body:', responseText.substring(0, 500))

      if (plugnotasResponse.ok) {
        const plugnotasData = JSON.parse(responseText)
        return { ok: true, data: plugnotasData }
      } else {
        let errorData: any = {}
        try {
          errorData = JSON.parse(responseText)
        } catch {
          errorData = { message: responseText.substring(0, 200) }
        }
        
        // Handle HTTP 409 - NFSe already exists
        if (plugnotasResponse.status === 409 || 
            responseText.includes('Já existe uma NFSe') || 
            responseText.includes('already exists') ||
            responseText.includes('idIntegracao')) {
          console.log('⚠️ NFS-e já foi emitida anteriormente para esta transação')
          return { ok: true, alreadyIssued: true, data: errorData }
        }
        
        return { ok: false, error: translatePlugNotasError(errorData), data: errorData }
      }
    }

    // Primeira tentativa de emissão
    let emitResult = await tryEmitNfse()
    
    // Se erro de empresa não encontrada no SANDBOX, tentar cadastrar novamente e retry
    if (!emitResult.ok && isSandboxEnvironment) {
      const errorMsg = emitResult.error || ""
      if (errorMsg.includes('não encontrada') || errorMsg.includes('Empresa')) {
        console.log('🔄 Empresa não encontrada, tentando cadastrar novamente...')
        
        const retryCheck = await ensurePlugNotasCompanyExists(
          companySettings,
          plugnotasToken,
          baseUrl
        )
        
        if (retryCheck.exists) {
          console.log('🔄 Retry da emissão após cadastro...')
          emitResult = await tryEmitNfse()
        }
      }
    }

    // Check if already issued (HTTP 409)
    if (emitResult.ok && emitResult.alreadyIssued) {
      console.log('⚠️ NFS-e já emitida anteriormente, atualizando status...')
      
      // Extract existing invoice data from response if available
      const existingData = emitResult.data
      plugnotasId = existingData?.id?.integracao || existingData?.idIntegracao || transaction_id
      invoiceNumber = existingData?.numeroNfse || existingData?.numero || `PN-EXIST-${Date.now()}`
      invoiceKey = existingData?.codigoVerificacao || existingData?.id?.integracao || invoiceKey
      integrationUsed = 'PLUGNOTAS'
      
      // Update transaction with existing data
      await supabase
        .from('transactions')
        .update({
          invoice_number: invoiceNumber,
          invoice_key: invoiceKey,
          invoice_status: 'issued',
          invoice_integration_id: plugnotasId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction_id)
      
      return new Response(
        JSON.stringify({
          success: true,
          already_issued: true,
          invoice_number: invoiceNumber,
          invoice_key: invoiceKey,
          integration: integrationUsed,
          plugnotas_id: plugnotasId,
          sandbox_mode: sandboxMode,
          status: 'issued',
          message: `Esta nota já foi emitida anteriormente (Nº ${invoiceNumber}).`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (emitResult.ok && !emitResult.alreadyIssued) {
      const result = Array.isArray(emitResult.data) ? emitResult.data[0] : emitResult.data
      
      plugnotasId = result.id?.integracao || result.id || transaction_id
      invoiceNumber = result.protocolo?.numero || result.id?.nfse || `PN-${Date.now()}`
      invoiceKey = result.protocolo?.id || result.id?.integracao || invoiceKey
      integrationUsed = 'PLUGNOTAS'
      console.log('✅ NFS-e enviada com sucesso:', { plugnotasId, invoiceNumber, invoiceKey })
    } else if (!emitResult.ok) {
      plugnotasError = emitResult.error || 'Erro desconhecido'
      console.error('❌ Erro PlugNotas final:', plugnotasError)
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
          success: false,
          message: 'Erro ao emitir NFS-e: ' + plugnotasError
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ success: false, message: 'Erro ao atualizar transação: ' + updateError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro ao emitir NFS-e:', error)
    return new Response(
      JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
