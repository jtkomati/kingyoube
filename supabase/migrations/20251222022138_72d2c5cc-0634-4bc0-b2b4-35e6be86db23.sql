-- ===========================================
-- FASE 3: OBSERVABILIDADE - Tabela de Logs
-- ===========================================

-- Tabela para logs estruturados de aplicação
CREATE TABLE public.application_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    source TEXT NOT NULL CHECK (source IN ('frontend', 'edge_function', 'cron', 'system')),
    function_name TEXT,
    user_id UUID,
    organization_id UUID,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    error_stack TEXT,
    request_id TEXT,
    duration_ms INTEGER,
    user_agent TEXT,
    page_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comentário descritivo
COMMENT ON TABLE public.application_logs IS 'Logs estruturados de aplicação para observabilidade';

-- Índices otimizados para queries de observabilidade
CREATE INDEX idx_app_logs_level_timestamp ON public.application_logs(level, timestamp DESC);
CREATE INDEX idx_app_logs_source_timestamp ON public.application_logs(source, timestamp DESC);
CREATE INDEX idx_app_logs_user_timestamp ON public.application_logs(user_id, timestamp DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_app_logs_errors_recent ON public.application_logs(timestamp DESC) WHERE level = 'error';
CREATE INDEX idx_app_logs_request_id ON public.application_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_app_logs_function_name ON public.application_logs(function_name, timestamp DESC) WHERE function_name IS NOT NULL;

-- Habilitar RLS
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Sistema pode inserir logs (usado por edge functions)
CREATE POLICY "System can insert logs"
ON public.application_logs
FOR INSERT
WITH CHECK (true);

-- Policy: ADMIN+ pode visualizar todos os logs
CREATE POLICY "ADMIN can view all logs"
ON public.application_logs
FOR SELECT
USING (get_user_role_level(auth.uid()) >= 4);

-- Policy: Usuários podem ver seus próprios logs
CREATE POLICY "Users can view own logs"
ON public.application_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Função para agregar métricas de erro
CREATE OR REPLACE FUNCTION public.get_error_metrics(
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    total_errors BIGINT,
    errors_by_source JSONB,
    errors_by_function JSONB,
    error_rate_per_hour JSONB,
    top_error_messages JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH error_data AS (
        SELECT al.level, al.source, al.function_name, al.message, al.timestamp
        FROM application_logs al
        WHERE al.level = 'error'
          AND al.timestamp > now() - (p_hours || ' hours')::interval
    ),
    by_source AS (
        SELECT jsonb_object_agg(ed.source, cnt) AS data
        FROM (
            SELECT ed2.source, COUNT(*) AS cnt
            FROM error_data ed2
            GROUP BY ed2.source
        ) ed
    ),
    by_function AS (
        SELECT jsonb_object_agg(COALESCE(ed.function_name, 'unknown'), cnt) AS data
        FROM (
            SELECT ed2.function_name, COUNT(*) AS cnt
            FROM error_data ed2
            WHERE ed2.function_name IS NOT NULL
            GROUP BY ed2.function_name
            ORDER BY cnt DESC
            LIMIT 10
        ) ed
    ),
    by_hour AS (
        SELECT jsonb_object_agg(hour_bucket::text, cnt) AS data
        FROM (
            SELECT date_trunc('hour', ed.timestamp) AS hour_bucket, COUNT(*) AS cnt
            FROM error_data ed
            GROUP BY date_trunc('hour', ed.timestamp)
            ORDER BY hour_bucket
        ) h
    ),
    top_messages AS (
        SELECT jsonb_agg(jsonb_build_object('message', msg, 'count', cnt)) AS data
        FROM (
            SELECT LEFT(ed.message, 100) AS msg, COUNT(*) AS cnt
            FROM error_data ed
            GROUP BY LEFT(ed.message, 100)
            ORDER BY cnt DESC
            LIMIT 5
        ) m
    )
    SELECT 
        (SELECT COUNT(*) FROM error_data),
        COALESCE((SELECT bs.data FROM by_source bs), '{}'::jsonb),
        COALESCE((SELECT bf.data FROM by_function bf), '{}'::jsonb),
        COALESCE((SELECT bh.data FROM by_hour bh), '{}'::jsonb),
        COALESCE((SELECT tm.data FROM top_messages tm), '[]'::jsonb);
END;
$$;

-- Função para verificar threshold de erros e criar alertas
CREATE OR REPLACE FUNCTION public.check_error_threshold()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    error_count INTEGER;
    alert_threshold INTEGER := 10;
    v_cfo_partner_id UUID;
BEGIN
    -- Contar erros nos últimos 5 minutos
    SELECT COUNT(*) INTO error_count
    FROM application_logs
    WHERE level = 'error'
      AND timestamp > now() - interval '5 minutes';
    
    -- Se exceder threshold, criar alerta para todos os CFO partners ativos
    IF error_count >= alert_threshold THEN
        FOR v_cfo_partner_id IN SELECT id FROM cfo_partners WHERE active = true
        LOOP
            -- Verificar se já existe alerta similar não resolvido
            IF NOT EXISTS (
                SELECT 1 FROM cfo_alerts 
                WHERE cfo_partner_id = v_cfo_partner_id
                  AND severity = 'critical'
                  AND resolved = false
                  AND metadata->>'alert_type' = 'high_error_rate'
                  AND created_at > now() - interval '30 minutes'
            ) THEN
                INSERT INTO cfo_alerts (
                    cfo_partner_id,
                    client_name,
                    message,
                    severity,
                    metadata
                ) VALUES (
                    v_cfo_partner_id,
                    'Sistema',
                    format('Taxa de erros elevada: %s erros nos últimos 5 minutos', error_count),
                    'critical',
                    jsonb_build_object(
                        'alert_type', 'high_error_rate',
                        'error_count', error_count,
                        'threshold', alert_threshold,
                        'checked_at', now()
                    )
                );
            END IF;
        END LOOP;
    END IF;
END;
$$;