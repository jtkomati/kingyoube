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

    // Test connection using municipios endpoint (lightweight, validates auth)
    // Using Maringá (4115200) as test - TecnoSpeed headquarters
    const testUrl = `${baseUrl}/nfse/municipios?codigoIbge=4115200`
    
    console.log('Testing URL:', testUrl)

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'x-api-key': token,
        'Content-Type': 'application/json'
      }
    })

    const responseText = await response.text()
    console.log('PlugNotas response status:', response.status)
    console.log('PlugNotas response:', responseText.substring(0, 500))

    let newStatus = 'disconnected'
    let errorMessage = null

    if (response.ok) {
      newStatus = 'connected'
      console.log('Connection successful!')
    } else if (response.status === 401) {
      newStatus = 'error'
      errorMessage = 'Token inválido ou expirado'
      console.log('Authentication failed')
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

    if (response.ok) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Conexão estabelecida com sucesso!',
          environment,
          status: newStatus
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          status: newStatus
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
