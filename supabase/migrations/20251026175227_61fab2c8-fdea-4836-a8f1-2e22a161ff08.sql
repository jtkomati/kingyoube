-- Create table for budget targets
CREATE TABLE IF NOT EXISTS public.budget_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_company_id UUID NOT NULL REFERENCES public.company_settings(id) ON DELETE CASCADE,
  cfo_partner_id UUID NOT NULL REFERENCES public.cfo_partners(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL, -- 'Marketing Digital', 'Folha de Pagamento', etc.
  account_category TEXT NOT NULL, -- 'MARKETING', 'PESSOAL', 'TECNOLOGIA', etc.
  month DATE NOT NULL, -- First day of the month (YYYY-MM-01)
  target_amount NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Ensure one budget per account per month per client
  UNIQUE(client_company_id, account_name, month)
);

-- Create table for budget variance analysis results
CREATE TABLE IF NOT EXISTS public.budget_variance_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_target_id UUID NOT NULL REFERENCES public.budget_targets(id) ON DELETE CASCADE,
  client_company_id UUID NOT NULL REFERENCES public.company_settings(id) ON DELETE CASCADE,
  cfo_partner_id UUID NOT NULL REFERENCES public.cfo_partners(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  target_amount NUMERIC NOT NULL,
  actual_amount NUMERIC NOT NULL,
  variance_amount NUMERIC NOT NULL, -- actual - target
  variance_percent NUMERIC NOT NULL, -- (actual - target) / target * 100
  variance_status TEXT NOT NULL, -- 'OVER_BUDGET', 'UNDER_BUDGET', 'ON_TARGET'
  severity TEXT NOT NULL, -- 'CRITICAL', 'WARNING', 'INFO', 'OK'
  alert_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.budget_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_variance_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budget_targets
CREATE POLICY "CFO partners can view their clients' budgets"
  ON public.budget_targets
  FOR SELECT
  USING (cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  ));

CREATE POLICY "CFO partners can manage their clients' budgets"
  ON public.budget_targets
  FOR ALL
  USING (cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  ));

-- RLS Policies for budget_variance_analysis
CREATE POLICY "CFO partners can view their variance analysis"
  ON public.budget_variance_analysis
  FOR SELECT
  USING (cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can create variance analysis"
  ON public.budget_variance_analysis
  FOR INSERT
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_budget_targets_client ON public.budget_targets(client_company_id);
CREATE INDEX idx_budget_targets_cfo_partner ON public.budget_targets(cfo_partner_id);
CREATE INDEX idx_budget_targets_month ON public.budget_targets(month);
CREATE INDEX idx_budget_variance_client ON public.budget_variance_analysis(client_company_id);
CREATE INDEX idx_budget_variance_cfo_partner ON public.budget_variance_analysis(cfo_partner_id);
CREATE INDEX idx_budget_variance_analysis_date ON public.budget_variance_analysis(analysis_date);

-- Create updated_at trigger
CREATE TRIGGER update_budget_targets_updated_at
  BEFORE UPDATE ON public.budget_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();