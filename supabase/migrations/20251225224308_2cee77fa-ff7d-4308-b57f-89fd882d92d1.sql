-- Tabela para analytics de formulários
CREATE TABLE public.form_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'form_opened', 'field_completed', 'submitted', 'error'
  form_name TEXT NOT NULL,
  field_name TEXT,
  metadata JSONB DEFAULT '{}',
  session_id TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX idx_form_analytics_event_type ON public.form_analytics(event_type);
CREATE INDEX idx_form_analytics_form_name ON public.form_analytics(form_name);
CREATE INDEX idx_form_analytics_created_at ON public.form_analytics(created_at DESC);

-- RLS: Permitir insert público (sem auth) para tracking de landing page
ALTER TABLE public.form_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert for analytics"
  ON public.form_analytics
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "ADMIN can view all analytics"
  ON public.form_analytics
  FOR SELECT
  USING (get_user_role_level(auth.uid()) >= 4);