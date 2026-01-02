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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { token, environment, company_id, check_cnpj } = await req.json()

    console.log('Testing PlugNotas connection:', { environment, company_id, check_cnpj: check_cnpj ? '***' + check_cnpj.slice(-4) : null })

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token não informado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine base URL based on environment
    const baseUrl = environment === 'PRODUCTION' 
      ? 'https://api.plugnotas.com.br'
      : 'https://api.sandbox.plugnotas.com.br'

    const version = '2026-01-02-v4'
    console.log(`PlugNotas test version: ${version}`)

    let newStatus = 'disconnected'
    let errorMessage = null
    let companyExists = false

    // If check_cnpj is provided, check if specific company exists
    if (check_cnpj) {
      const cnpjDigits = check_cnpj.replace(/\D/g, '')
      const checkUrl = `${baseUrl}/empresa/${cnpjDigits}`
      console.log('Checking company URL:', checkUrl.replace(cnpjDigits, '***' + cnpjDigits.slice(-4)))

      const checkResponse = await fetch(checkUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json'
        }
      })

      console.log('Company check response status:', checkResponse.status)

      if (checkResponse.status === 200) {
        companyExists = true
        newStatus = 'connected'
        console.log('Company found in PlugNotas!')
      } else if (checkResponse.status === 404) {
        companyExists = false
        newStatus = 'connected' // Connection works, company just not found
        console.log('Company NOT found in PlugNotas')
      } else if (checkResponse.status === 401 || checkResponse.status === 403) {
        newStatus = 'error'
        errorMessage = 'Token inválido'
        console.log('Authentication failed')
      } else {
        const responseText = await checkResponse.text()
        console.log('Company check response:', responseText.substring(0, 200))
        newStatus = 'error'
        errorMessage = `Erro ${checkResponse.status}`
      }
    } else {
      // Standard connection test using /empresa endpoint
      const testUrl = `${baseUrl}/empresa`
      console.log('Testing URL:', testUrl)

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': token,
          'Content-Type': 'application/json'
        }
      })

      const responseText = await response.text()
      console.log('PlugNotas response status:', response.status)
      console.log('PlugNotas response:', responseText.substring(0, 500))

      if (response.ok) {
        newStatus = 'connected'
        console.log('Connection successful!')
      } else if (response.status === 401 || response.status === 403) {
        newStatus = 'error'
        const envName = environment === 'PRODUCTION' ? 'produção' : 'sandbox'
        errorMessage = `Token inválido para ambiente de ${envName}. Acesse app2.plugnotas.com.br para gerar um novo token.`
        console.log('Authentication failed')
      } else if (response.status === 404) {
        // 404 on /empresa likely means auth succeeded but no companies registered
        newStatus = 'connected'
        console.log('Connection successful (no companies registered)')
      } else {
        newStatus = 'error'
        errorMessage = `Erro ${response.status}: ${responseText}`
        console.log('Connection failed:', errorMessage)
      }
    }

    // Update config_fiscal with connection status
    if (company_id) {
      const { error: updateError } = await supabase
        .from('config_fiscal')
        .update({
          plugnotas_token: token,
          plugnotas_environment: environment,
          plugnotas_status: newStatus,
          plugnotas_last_test: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('company_id', company_id)

      if (updateError) {
        console.error('Error updating config_fiscal:', updateError)
        
        // Try to insert if doesn't exist
        const { error: insertError } = await supabase
          .from('config_fiscal')
          .insert({
            company_id,
            client_id: 'plugnotas',
            client_secret: 'configured',
            plugnotas_token: token,
            plugnotas_environment: environment,
            plugnotas_status: newStatus,
            plugnotas_last_test: new Date().toISOString()
          })
        
        if (insertError) {
          console.error('Error inserting config_fiscal:', insertError)
        }
      }

      // Log the connection test
      await supabase.from('sync_logs').insert({
        integration_type: 'PLUGNOTAS_CONNECTION_TEST',
        status: newStatus === 'connected' ? 'success' : 'error',
        records_processed: 0,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        error_details: errorMessage
      })
    }

    if (newStatus === 'connected') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: companyExists ? 'Empresa encontrada!' : 'Conexão estabelecida com sucesso!',
          environment,
          status: newStatus,
          company_exists: companyExists,
          version
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          status: newStatus,
          company_exists: false,
          version
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error testing PlugNotas connection:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
