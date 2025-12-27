import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * RAG Query Edge Function
 * Busca semântica em documentos + resposta contextualizada com Gemini
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { query, companyId, sourceType, limit = 5 } = await req.json()
    
    if (!query || !companyId) {
      throw new Error('Campos obrigatórios: query, companyId')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('RAG Query:', query.substring(0, 100))

    // 1. Gerar embedding da query
    const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/text-embedding-004',
        input: query,
        dimensions: 768
      })
    })

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text()
      console.error('Erro ao gerar embedding da query:', errorText)
      throw new Error('Erro ao processar consulta')
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.data?.[0]?.embedding

    if (!queryEmbedding) {
      throw new Error('Falha ao gerar embedding da query')
    }

    // 2. Buscar documentos similares via pgvector
    const { data: documents, error: searchError } = await supabase.rpc(
      'search_embeddings',
      {
        p_company_id: companyId,
        p_query_embedding: `[${queryEmbedding.join(',')}]`,
        p_limit: limit,
        p_source_type: sourceType || null
      }
    )

    if (searchError) {
      console.error('Erro na busca vetorial:', searchError)
      throw searchError
    }

    console.log('Documentos encontrados:', documents?.length || 0)

    // 3. Se não encontrou documentos, responder sem contexto
    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ 
          answer: 'Não encontrei documentos relevantes para sua consulta.',
          sources: [],
          hasContext: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Montar contexto com documentos encontrados
    const context = documents.map((doc: any, idx: number) => 
      `[Documento ${idx + 1} - ${doc.source_type} - Similaridade: ${(doc.similarity * 100).toFixed(1)}%]\n${doc.content}`
    ).join('\n\n---\n\n')

    // 5. Chamar Gemini com contexto enriquecido
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente financeiro especializado. Responda a pergunta do usuário baseando-se APENAS nos documentos fornecidos abaixo.

DOCUMENTOS DE CONTEXTO:
${context}

INSTRUÇÕES:
1. Use apenas informações dos documentos acima
2. Se a informação não estiver nos documentos, diga claramente
3. Cite os documentos quando relevante (ex: "Conforme o Documento 1...")
4. Responda em português brasileiro
5. Seja preciso e objetivo`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      console.error('Erro Gemini RAG:', errorText)
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error('Erro ao gerar resposta')
    }

    const aiData = await aiResponse.json()
    const answer = aiData.choices?.[0]?.message?.content || 'Não foi possível gerar resposta.'

    console.log('Resposta RAG gerada')

    return new Response(
      JSON.stringify({
        answer,
        sources: documents.map((doc: any) => ({
          id: doc.id,
          sourceType: doc.source_type,
          sourceId: doc.source_id,
          similarity: doc.similarity,
          preview: doc.content.substring(0, 200) + '...'
        })),
        hasContext: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro rag-query:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
