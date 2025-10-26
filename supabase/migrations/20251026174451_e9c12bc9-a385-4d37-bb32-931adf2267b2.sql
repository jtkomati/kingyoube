-- Create table to track CFO partner ROI and value generated
CREATE TABLE IF NOT EXISTS public.cfo_partner_roi_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cfo_partner_id UUID NOT NULL REFERENCES public.cfo_partners(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'AI_REPORT_GENERATED', 'CRITICAL_ALERT_VIEWED', 'MANUAL_TASK_COMPLETED'
  time_saved_minutes INTEGER NOT NULL DEFAULT 0,
  client_company_id UUID REFERENCES public.company_settings(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for AI feedback and corrections
CREATE TABLE IF NOT EXISTS public.ai_feedback_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cfo_partner_id UUID NOT NULL REFERENCES public.cfo_partners(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES public.cfo_alerts(id),
  client_company_id UUID REFERENCES public.company_settings(id),
  feedback_type TEXT NOT NULL, -- 'INCORRECT_ALERT', 'INCORRECT_CATEGORIZATION', 'FALSE_POSITIVE'
  original_value TEXT,
  correct_value TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for prospect leads
CREATE TABLE IF NOT EXISTS public.partner_prospect_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cfo_partner_id UUID NOT NULL REFERENCES public.cfo_partners(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  industry TEXT,
  region TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'LEAD', -- 'LEAD', 'CONTACTED', 'CONVERTED', 'REJECTED'
  score INTEGER DEFAULT 0, -- AI-generated lead quality score (0-100)
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for client onboarding sandboxes
CREATE TABLE IF NOT EXISTS public.client_sandboxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cfo_partner_id UUID NOT NULL REFERENCES public.cfo_partners(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  sandbox_url TEXT NOT NULL,
  demo_data JSONB, -- Store demo transactions, metrics, etc.
  status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'CONVERTED', 'EXPIRED'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days')
);

-- Enable RLS on all tables
ALTER TABLE public.cfo_partner_roi_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_prospect_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_sandboxes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cfo_partner_roi_tracking
CREATE POLICY "CFO partners can view their own ROI tracking"
  ON public.cfo_partner_roi_tracking
  FOR SELECT
  USING (cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can create ROI tracking"
  ON public.cfo_partner_roi_tracking
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for ai_feedback_corrections
CREATE POLICY "CFO partners can manage their own feedback"
  ON public.ai_feedback_corrections
  FOR ALL
  USING (cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  ));

-- RLS Policies for partner_prospect_leads
CREATE POLICY "CFO partners can manage their own leads"
  ON public.partner_prospect_leads
  FOR ALL
  USING (cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  ));

-- RLS Policies for client_sandboxes
CREATE POLICY "CFO partners can manage their own sandboxes"
  ON public.client_sandboxes
  FOR ALL
  USING (cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  ));

-- Create indexes for performance
CREATE INDEX idx_roi_tracking_cfo_partner ON public.cfo_partner_roi_tracking(cfo_partner_id);
CREATE INDEX idx_roi_tracking_created_at ON public.cfo_partner_roi_tracking(created_at);
CREATE INDEX idx_feedback_cfo_partner ON public.ai_feedback_corrections(cfo_partner_id);
CREATE INDEX idx_feedback_applied ON public.ai_feedback_corrections(applied);
CREATE INDEX idx_leads_cfo_partner ON public.partner_prospect_leads(cfo_partner_id);
CREATE INDEX idx_leads_status ON public.partner_prospect_leads(status);
CREATE INDEX idx_sandboxes_cfo_partner ON public.client_sandboxes(cfo_partner_id);

-- Create updated_at triggers
CREATE TRIGGER update_partner_prospect_leads_updated_at
  BEFORE UPDATE ON public.partner_prospect_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();