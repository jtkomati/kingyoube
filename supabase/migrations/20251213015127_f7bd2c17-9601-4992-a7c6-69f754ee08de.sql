-- Tabela de consentimentos LGPD
CREATE TABLE public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL, -- 'terms', 'privacy', 'marketing', 'data_processing'
  consented BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  consented_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  version TEXT NOT NULL DEFAULT '1.0'
);

-- Tabela de solicitações LGPD (exclusão, exportação)
CREATE TABLE public.lgpd_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  request_type TEXT NOT NULL, -- 'export', 'deletion', 'rectification'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'rejected'
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  notes TEXT,
  result_url TEXT
);

-- Enable RLS
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_requests ENABLE ROW LEVEL SECURITY;

-- Policies for user_consents
CREATE POLICY "Users can view own consents" ON public.user_consents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own consents" ON public.user_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consents" ON public.user_consents
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for lgpd_requests
CREATE POLICY "Users can view own requests" ON public.lgpd_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own requests" ON public.lgpd_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update requests" ON public.lgpd_requests
  FOR UPDATE USING (true);

-- Índices para performance
CREATE INDEX idx_user_consents_user_id ON public.user_consents(user_id);
CREATE INDEX idx_user_consents_type ON public.user_consents(consent_type);
CREATE INDEX idx_lgpd_requests_user_id ON public.lgpd_requests(user_id);
CREATE INDEX idx_lgpd_requests_status ON public.lgpd_requests(status);