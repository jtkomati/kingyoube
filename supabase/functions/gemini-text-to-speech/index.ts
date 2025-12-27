import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Gemini Text-to-Speech Edge Function
 * Usa Gemini TTS para sintetizar voz
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { text, voice = 'Kore' } = await req.json()
    
    if (!text) {
      throw new Error('Nenhum texto fornecido')
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    console.log('Sintetizando voz com Gemini TTS...')

    // Chamar Gemini TTS via Lovable Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-preview-tts',
        messages: [
          {
            role: 'user',
            content: text
          }
        ],
        modalities: ['audio'],
        audio: {
          voice: voice, // Kore, Charon, Puck, Zephyr, Aoede
          format: 'mp3'
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro Gemini TTS:', response.status, errorText)
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Fallback: se TTS não disponível, usar OpenAI TTS
      console.log('Tentando fallback OpenAI TTS...')
      const openaiKey = Deno.env.get('OPENAI_API_KEY')
      
      if (openaiKey) {
        const fallbackResponse = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: text,
            voice: 'alloy',
            response_format: 'mp3',
          }),
        })

        if (fallbackResponse.ok) {
          const arrayBuffer = await fallbackResponse.arrayBuffer()
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
          
          return new Response(
            JSON.stringify({ audioContent: base64Audio, format: 'mp3' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
      
      throw new Error(`Erro na síntese de voz: ${response.status}`)
    }

    const data = await response.json()
    
    // Extrair áudio da resposta Gemini
    const audioContent = data.choices?.[0]?.message?.audio?.data || 
                         data.choices?.[0]?.message?.content || ''

    console.log('Síntese de voz concluída')

    return new Response(
      JSON.stringify({ audioContent, format: 'mp3' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro gemini-text-to-speech:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
