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

    const { token, environment, company_id } = await req.json()

    console.log('Testing PlugNotas connection:', { environment, company_id })

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

    // Test connection using /empresa endpoint - more reliable for auth validation
    const testUrl = `${baseUrl}/empresa`
    
    const version = '2026-01-02-v3'
    console.log(`PlugNotas test version: ${version}`)
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

    let newStatus = 'disconnected'
    let errorMessage = null

    if (response.ok) {
      // 200 - Authentication successful
      newStatus = 'connected'
      console.log('Connection successful!')
    } else if (response.status === 401 || response.status === 403) {
      // 401/403 - Invalid or expired token
      newStatus = 'error'
      const envName = environment === 'PRODUCTION' ? 'produção' : 'sandbox'
      errorMessage = `Token inválido para ambiente de ${envName}. Acesse app2.plugnotas.com.br para gerar um novo token.`
      console.log('Authentication failed')
    } else if (response.status === 404) {
      // 404 on /empresa likely means auth succeeded but no companies registered
      // This is still a successful connection
      newStatus = 'connected'
      console.log('Connection successful (no companies registered)')
    } else {
      newStatus = 'error'
      errorMessage = `Erro ${response.status}: ${responseText}`
      console.log('Connection failed:', errorMessage)
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
          message: 'Conexão estabelecida com sucesso!',
          environment,
          status: newStatus,
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
