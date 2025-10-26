-- Criar tabela de Parceiros CFO
CREATE TABLE public.cfo_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cfo_partners ENABLE ROW LEVEL SECURITY;

-- Policies para cfo_partners
CREATE POLICY "CFO partners can view their own profile"
ON public.cfo_partners FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "CFO partners can update their own profile"
ON public.cfo_partners FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "SUPERADMIN can manage all CFO partners"
ON public.cfo_partners FOR ALL
USING (has_role(auth.uid(), 'SUPERADMIN'::app_role));

-- Adicionar campo cfo_partner_id em company_settings
ALTER TABLE public.company_settings
ADD COLUMN cfo_partner_id UUID REFERENCES public.cfo_partners(id) ON DELETE SET NULL;

CREATE INDEX idx_company_settings_cfo_partner ON public.company_settings(cfo_partner_id);

-- Criar tabela de alertas do Cockpit
CREATE TABLE public.cfo_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cfo_partner_id UUID NOT NULL REFERENCES public.cfo_partners(id) ON DELETE CASCADE,
  client_company_id UUID REFERENCES public.company_settings(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cfo_alerts ENABLE ROW LEVEL SECURITY;

-- Policies para cfo_alerts
CREATE POLICY "CFO partners can view their own alerts"
ON public.cfo_alerts FOR SELECT
USING (
  cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  )
);

CREATE POLICY "CFO partners can update their own alerts"
ON public.cfo_alerts FOR UPDATE
USING (
  cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can create alerts"
ON public.cfo_alerts FOR INSERT
WITH CHECK (true);

-- Criar tabela de configuração de monitoramento
CREATE TABLE public.cfo_monitoring_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cfo_partner_id UUID NOT NULL REFERENCES public.cfo_partners(id) ON DELETE CASCADE UNIQUE,
  critical_cash_days_threshold INTEGER NOT NULL DEFAULT 7,
  warning_ar_overdue_percentage NUMERIC NOT NULL DEFAULT 15.0,
  warning_uncategorized_threshold INTEGER NOT NULL DEFAULT 20,
  notification_hour INTEGER NOT NULL DEFAULT 7,
  notification_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cfo_monitoring_config ENABLE ROW LEVEL SECURITY;

-- Policies para cfo_monitoring_config
CREATE POLICY "CFO partners can view their own config"
ON public.cfo_monitoring_config FOR SELECT
USING (
  cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  )
);

CREATE POLICY "CFO partners can manage their own config"
ON public.cfo_monitoring_config FOR ALL
USING (
  cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  )
);

-- Criar índices para performance
CREATE INDEX idx_cfo_alerts_partner ON public.cfo_alerts(cfo_partner_id, created_at DESC);
CREATE INDEX idx_cfo_alerts_unread ON public.cfo_alerts(cfo_partner_id, is_read) WHERE NOT is_read;
CREATE INDEX idx_cfo_alerts_severity ON public.cfo_alerts(cfo_partner_id, severity, created_at DESC);

-- Trigger para updated_at
CREATE TRIGGER update_cfo_partners_updated_at
BEFORE UPDATE ON public.cfo_partners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cfo_monitoring_config_updated_at
BEFORE UPDATE ON public.cfo_monitoring_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();