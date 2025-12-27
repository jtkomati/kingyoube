-- Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Tabela para embeddings de documentos (RAG)
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company_settings(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- 'CONTRACT', 'INVOICE', 'TRANSACTION', 'NOTE'
  source_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding extensions.vector(768), -- Dimensão Gemini text-embedding-004
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca vetorial eficiente
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector 
ON public.document_embeddings 
USING ivfflat (embedding extensions.vector_cosine_ops) 
WITH (lists = 100);

-- Índice para buscas por company e source
CREATE INDEX IF NOT EXISTS idx_document_embeddings_company 
ON public.document_embeddings(company_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_source 
ON public.document_embeddings(source_type, source_id);

-- RLS para document_embeddings
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver embeddings da sua empresa
CREATE POLICY "Users can view their company embeddings"
ON public.document_embeddings FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
));

-- Política: usuários com role >= FINANCEIRO podem inserir
CREATE POLICY "Financial users can insert embeddings"
ON public.document_embeddings FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
  AND get_user_role_level(auth.uid()) >= 3
);

-- Política: usuários com role >= FINANCEIRO podem deletar
CREATE POLICY "Financial users can delete embeddings"
ON public.document_embeddings FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
  AND get_user_role_level(auth.uid()) >= 3
);

-- Função para busca semântica
CREATE OR REPLACE FUNCTION public.search_embeddings(
  p_company_id UUID,
  p_query_embedding extensions.vector(768),
  p_limit INTEGER DEFAULT 5,
  p_source_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT 
    de.id,
    de.source_type,
    de.source_id,
    de.content,
    de.metadata,
    1 - (de.embedding <=> p_query_embedding) as similarity
  FROM public.document_embeddings de
  WHERE de.company_id = p_company_id
    AND (p_source_type IS NULL OR de.source_type = p_source_type)
  ORDER BY de.embedding <=> p_query_embedding
  LIMIT p_limit;
$$;

-- Trigger para updated_at
CREATE TRIGGER update_document_embeddings_updated_at
  BEFORE UPDATE ON public.document_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();