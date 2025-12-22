-- Criar tabela ai_usage_logs para tracking de uso e custos de IA por tenant
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Tenant isolation (CNPJ)
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  -- Provider info
  provider_used TEXT NOT NULL CHECK (provider_used IN ('openai', 'anthropic', 'google', 'perplexity', 'lovable')),
  model_used TEXT NOT NULL,
  
  -- Token tracking
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  
  -- Cost estimation (em centavos USD para precisão)
  cost_estimated_cents INTEGER NOT NULL DEFAULT 0,
  
  -- Request metadata
  intent TEXT CHECK (intent IN ('chat_default', 'web_search', 'heavy_analysis', 'coding', 'summarization', 'rag_query')),
  endpoint TEXT,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  fallback_used BOOLEAN DEFAULT FALSE,
  original_provider TEXT,
  
  -- Request/Response metadata
  request_metadata JSONB DEFAULT '{}',
  
  -- Foreign keys
  CONSTRAINT fk_ai_usage_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.company_settings(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_usage_logs_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes para queries frequentes (sem DATE_TRUNC que não é IMMUTABLE)
CREATE INDEX idx_ai_usage_logs_tenant_id ON public.ai_usage_logs(tenant_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_logs_provider ON public.ai_usage_logs(provider_used);
CREATE INDEX idx_ai_usage_logs_tenant_created ON public.ai_usage_logs(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "ADMIN can view org AI usage logs"
ON public.ai_usage_logs
FOR SELECT
USING (
  (get_user_role_level(auth.uid()) >= 4 AND tenant_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "System can insert AI usage logs"
ON public.ai_usage_logs
FOR INSERT
WITH CHECK (true);

-- Função para calcular uso mensal por tenant
CREATE OR REPLACE FUNCTION public.get_ai_usage_summary(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  provider TEXT,
  total_calls BIGINT,
  total_tokens_input BIGINT,
  total_tokens_output BIGINT,
  total_cost_cents BIGINT,
  avg_latency_ms NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    provider_used,
    COUNT(*) as total_calls,
    SUM(tokens_input)::BIGINT as total_tokens_input,
    SUM(tokens_output)::BIGINT as total_tokens_output,
    SUM(cost_estimated_cents)::BIGINT as total_cost_cents,
    AVG(latency_ms)::NUMERIC as avg_latency_ms
  FROM public.ai_usage_logs
  WHERE tenant_id = p_tenant_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    AND success = true
  GROUP BY provider_used
  ORDER BY total_cost_cents DESC;
$$;