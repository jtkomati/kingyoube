import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Gemini Voice-to-Text Edge Function
 * Usa Gemini 2.5 Flash multimodal para transcrever áudio
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { audio, mimeType = 'audio/webm' } = await req.json()
    
    if (!audio) {
      throw new Error('Nenhum áudio fornecido')
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    console.log('Transcrevendo áudio com Gemini...')

    // Usar Gemini com input multimodal (áudio inline)
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicações ou formatação adicional.'
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: audio,
                  format: mimeType.includes('webm') ? 'webm' : 'mp3'
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro Gemini STT:', response.status, errorText)
      
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
      
      throw new Error(`Erro na transcrição: ${response.status}`)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content?.trim() || ''

    console.log('Transcrição concluída:', text.substring(0, 100))

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro gemini-voice-to-text:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
