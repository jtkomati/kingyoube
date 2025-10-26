-- Fase 1.1: Sistema de Timesheet
CREATE TABLE IF NOT EXISTS public.project_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.accounting_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  description TEXT,
  billable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expandir accounting_projects com métricas de projeto
ALTER TABLE public.accounting_projects 
ADD COLUMN IF NOT EXISTS budget_hours NUMERIC(8,2),
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS total_billed NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_hours_logged NUMERIC(8,2) DEFAULT 0;

-- Fase 1.3: Partner Ruleset - O "Moat"
CREATE TABLE IF NOT EXISTS public.cfo_partner_rulesets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cfo_partner_id UUID NOT NULL REFERENCES public.cfo_partners(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'PROJECT_MARGIN_WARNING',
    'PROJECT_MARGIN_CRITICAL', 
    'HOURS_OVERRUN_WARNING',
    'HOURS_OVERRUN_CRITICAL',
    'CASH_FLOW_CRITICAL',
    'AR_OVERDUE_WARNING',
    'UNCATEGORIZED_TRANSACTIONS'
  )),
  threshold_value NUMERIC NOT NULL,
  alert_severity TEXT NOT NULL CHECK (alert_severity IN ('INFO', 'WARNING', 'CRITICAL')),
  custom_message_template TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_project_time_entries_project ON public.project_time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_user ON public.project_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_date ON public.project_time_entries(date);
CREATE INDEX IF NOT EXISTS idx_cfo_partner_rulesets_partner ON public.cfo_partner_rulesets(cfo_partner_id);
CREATE INDEX IF NOT EXISTS idx_cfo_partner_rulesets_active ON public.cfo_partner_rulesets(active) WHERE active = true;

-- RLS Policies para project_time_entries
ALTER TABLE public.project_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view time entries"
ON public.project_time_entries FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create their own time entries"
ON public.project_time_entries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time entries"
ON public.project_time_entries FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "FINANCEIRO and above can manage all time entries"
ON public.project_time_entries FOR ALL
TO authenticated
USING (get_user_role_level(auth.uid()) >= 3);

-- RLS Policies para cfo_partner_rulesets
ALTER TABLE public.cfo_partner_rulesets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CFO partners can view their own rulesets"
ON public.cfo_partner_rulesets FOR SELECT
TO authenticated
USING (
  cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  )
);

CREATE POLICY "CFO partners can manage their own rulesets"
ON public.cfo_partner_rulesets FOR ALL
TO authenticated
USING (
  cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_project_time_entries_updated_at
BEFORE UPDATE ON public.project_time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cfo_partner_rulesets_updated_at
BEFORE UPDATE ON public.cfo_partner_rulesets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function para recalcular total_hours_logged de um projeto
CREATE OR REPLACE FUNCTION public.recalculate_project_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.accounting_projects
  SET total_hours_logged = (
    SELECT COALESCE(SUM(hours), 0)
    FROM public.project_time_entries
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
  )
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para recalcular horas automaticamente
CREATE TRIGGER recalculate_project_hours_on_insert
AFTER INSERT ON public.project_time_entries
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_project_hours();

CREATE TRIGGER recalculate_project_hours_on_update
AFTER UPDATE ON public.project_time_entries
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_project_hours();

CREATE TRIGGER recalculate_project_hours_on_delete
AFTER DELETE ON public.project_time_entries
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_project_hours();