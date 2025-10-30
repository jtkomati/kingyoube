import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { message } = await req.json()

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Mensagem inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Chamando webhook do Make.com para usuário:', user.id)

    // Registrar auditoria
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'ai_assistant_query',
      details: `Query: ${message.substring(0, 100)}`,
    })

    // Chamar webhook do Make.com (webhooks públicos - não requerem autenticação)
    const webhookUrl = 'https://hook.us2.make.com/zjysfc4yoio3kjma1omuqeip0g1z06i5'
    
    console.log('Enviando para Make.com webhook:', {
      url: webhookUrl,
      user_id: user.id,
      message_preview: message.substring(0, 50)
    })

    const webhookPayload = {
      user_id: user.id,
      user_email: user.email,
      message: message,
      timestamp: new Date().toISOString(),
    }

    const makeApiKey = Deno.env.get('MAKE_WEBHOOK_KEY')
    
    console.log('Make API Key configurada:', makeApiKey ? 'SIM' : 'NÃO')
    
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-make-apikey': makeApiKey || '',
      },
      body: JSON.stringify(webhookPayload),
    })

    console.log('Resposta do webhook Make.com:', {
      status: webhookResponse.status,
      statusText: webhookResponse.statusText,
      headers: Object.fromEntries(webhookResponse.headers.entries())
    })

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text()
      console.error('ERRO DETALHADO do webhook:', {
        status: webhookResponse.status,
        statusText: webhookResponse.statusText,
        body: errorText,
        payload_sent: webhookPayload
      })
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao processar requisição no Make.com',
          details: `Status ${webhookResponse.status}: ${errorText}`,
          webhook_status: webhookResponse.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    let responseData
    try {
      responseData = await webhookResponse.json()
      console.log('Resposta JSON do Make.com:', responseData)
    } catch (jsonError) {
      const textResponse = await webhookResponse.text()
      console.log('Resposta texto do Make.com:', textResponse)
      responseData = { response: textResponse }
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Erro na função ai-assistant-webhook:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao processar requisição',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
