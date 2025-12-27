import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Generate Embeddings Edge Function
 * Gera embeddings usando Gemini e salva no pgvector
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { content, sourceType, sourceId, companyId, metadata = {} } = await req.json()
    
    if (!content || !sourceType || !sourceId || !companyId) {
      throw new Error('Campos obrigatórios: content, sourceType, sourceId, companyId')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Gerando embedding para:', sourceType, sourceId)

    // Gerar embedding usando Gemini
    const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/text-embedding-004',
        input: content.substring(0, 8000), // Limitar tamanho do texto
        dimensions: 768
      })
    })

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text()
      console.error('Erro ao gerar embedding:', errorText)
      
      if (embeddingResponse.status === 429 || embeddingResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Limite de API excedido' }),
          { status: embeddingResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`Erro ao gerar embedding: ${embeddingResponse.status}`)
    }

    const embeddingData = await embeddingResponse.json()
    const embedding = embeddingData.data?.[0]?.embedding

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Embedding inválido recebido')
    }

    console.log('Embedding gerado, dimensão:', embedding.length)

    // Verificar se já existe embedding para este source
    const { data: existing } = await supabase
      .from('document_embeddings')
      .select('id')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .single()

    if (existing) {
      // Atualizar embedding existente
      const { error: updateError } = await supabase
        .from('document_embeddings')
        .update({
          content,
          embedding: `[${embedding.join(',')}]`,
          metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Erro ao atualizar embedding:', updateError)
        throw updateError
      }

      console.log('Embedding atualizado:', existing.id)
      return new Response(
        JSON.stringify({ success: true, id: existing.id, action: 'updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Inserir novo embedding
    const { data: inserted, error: insertError } = await supabase
      .from('document_embeddings')
      .insert({
        company_id: companyId,
        source_type: sourceType,
        source_id: sourceId,
        content,
        embedding: `[${embedding.join(',')}]`,
        metadata
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Erro ao inserir embedding:', insertError)
      throw insertError
    }

    console.log('Embedding inserido:', inserted?.id)

    return new Response(
      JSON.stringify({ success: true, id: inserted?.id, action: 'created' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro generate-embeddings:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
