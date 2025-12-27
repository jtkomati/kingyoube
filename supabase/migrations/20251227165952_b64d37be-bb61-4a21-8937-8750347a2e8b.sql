-- =============================================
-- SERVICE AS A SOFTWARE - INFRASTRUCTURE
-- =============================================

-- Fila de aprovações do Gerente Financeiro
CREATE TABLE public.approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID REFERENCES public.workflow_instances(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL, -- billing, receivables, collection, payables, treasury
  action_type TEXT NOT NULL, -- issue_invoice, approve_payment, approve_collection, etc
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1=urgente, 10=baixo
  request_data JSONB NOT NULL DEFAULT '{}',
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  review_notes TEXT,
  auto_approved BOOLEAN DEFAULT false,
  company_id UUID NOT NULL REFERENCES public.company_settings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comunicações automatizadas (emails, WhatsApp, SMS)
CREATE TABLE public.automated_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- INVOICE, COLLECTION, PAYMENT, etc
  entity_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms', 'push')),
  template_id TEXT,
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  subject TEXT,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  company_id UUID NOT NULL REFERENCES public.company_settings(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Regras de automação por agente
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL, -- billing, receivables, collection, payables, treasury, manager
  rule_name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron', 'event', 'manual', 'threshold')),
  trigger_config JSONB DEFAULT '{}', -- cron expression, event name, etc
  conditions JSONB DEFAULT '[]', -- array of conditions to check
  actions JSONB DEFAULT '[]', -- array of actions to execute
  requires_approval BOOLEAN DEFAULT true,
  approval_threshold NUMERIC DEFAULT 0, -- valor acima do qual requer aprovação
  auto_approve_below NUMERIC DEFAULT 0, -- valor abaixo do qual aprova automaticamente
  is_active BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  company_id UUID NOT NULL REFERENCES public.company_settings(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Histórico de execução de agentes
CREATE TABLE public.agent_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'pending_approval', 'approved', 'rejected')),
  error_message TEXT,
  duration_ms INTEGER,
  approval_queue_id UUID REFERENCES public.approval_queue(id) ON DELETE SET NULL,
  workflow_instance_id UUID REFERENCES public.workflow_instances(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.company_settings(id) ON DELETE CASCADE,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_approval_queue_status ON public.approval_queue(status);
CREATE INDEX idx_approval_queue_company ON public.approval_queue(company_id);
CREATE INDEX idx_approval_queue_agent ON public.approval_queue(agent_id);
CREATE INDEX idx_approval_queue_priority ON public.approval_queue(priority, created_at);

CREATE INDEX idx_automated_communications_status ON public.automated_communications(status);
CREATE INDEX idx_automated_communications_scheduled ON public.automated_communications(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_automated_communications_entity ON public.automated_communications(entity_type, entity_id);

CREATE INDEX idx_automation_rules_agent ON public.automation_rules(agent_id);
CREATE INDEX idx_automation_rules_active ON public.automation_rules(is_active, agent_id);

CREATE INDEX idx_agent_execution_logs_agent ON public.agent_execution_logs(agent_id);
CREATE INDEX idx_agent_execution_logs_company ON public.agent_execution_logs(company_id);
CREATE INDEX idx_agent_execution_logs_created ON public.agent_execution_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_queue
CREATE POLICY "Users can view org approval queue"
  ON public.approval_queue FOR SELECT
  USING (
    company_id = ANY(get_user_organization_ids(auth.uid()))
    OR get_user_role_level(auth.uid()) >= 5
  );

CREATE POLICY "FINANCEIRO can manage org approval queue"
  ON public.approval_queue FOR ALL
  USING (
    (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
  )
  WITH CHECK (
    (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
  );

-- RLS Policies for automated_communications
CREATE POLICY "Users can view org communications"
  ON public.automated_communications FOR SELECT
  USING (
    company_id = ANY(get_user_organization_ids(auth.uid()))
    OR get_user_role_level(auth.uid()) >= 5
  );

CREATE POLICY "FINANCEIRO can manage org communications"
  ON public.automated_communications FOR ALL
  USING (
    (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
  )
  WITH CHECK (
    (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
  );

-- RLS Policies for automation_rules
CREATE POLICY "Users can view org automation rules"
  ON public.automation_rules FOR SELECT
  USING (
    company_id = ANY(get_user_organization_ids(auth.uid()))
    OR get_user_role_level(auth.uid()) >= 5
  );

CREATE POLICY "ADMIN can manage org automation rules"
  ON public.automation_rules FOR ALL
  USING (
    (get_user_role_level(auth.uid()) >= 4 AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
  )
  WITH CHECK (
    (get_user_role_level(auth.uid()) >= 4 AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
  );

-- RLS Policies for agent_execution_logs
CREATE POLICY "Users can view org agent logs"
  ON public.agent_execution_logs FOR SELECT
  USING (
    company_id = ANY(get_user_organization_ids(auth.uid()))
    OR get_user_role_level(auth.uid()) >= 5
  );

CREATE POLICY "System can insert agent logs"
  ON public.agent_execution_logs FOR INSERT
  WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_approval_queue_updated_at
  BEFORE UPDATE ON public.approval_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_automated_communications_updated_at
  BEFORE UPDATE ON public.automated_communications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get pending approvals count
CREATE OR REPLACE FUNCTION public.get_pending_approvals_count(_company_id UUID)
RETURNS TABLE(agent_id TEXT, pending_count BIGINT, urgent_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    aq.agent_id,
    COUNT(*) as pending_count,
    COUNT(*) FILTER (WHERE aq.priority <= 3) as urgent_count
  FROM public.approval_queue aq
  WHERE aq.company_id = _company_id
    AND aq.status = 'pending'
  GROUP BY aq.agent_id;
$$;

-- Function to approve/reject items
CREATE OR REPLACE FUNCTION public.process_approval(
  p_approval_id UUID,
  p_action TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_approval RECORD;
  v_result JSONB;
BEGIN
  -- Get approval record
  SELECT * INTO v_approval FROM public.approval_queue WHERE id = p_approval_id;
  
  IF v_approval IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approval not found');
  END IF;
  
  IF v_approval.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approval already processed');
  END IF;
  
  -- Update approval
  UPDATE public.approval_queue
  SET 
    status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = p_notes
  WHERE id = p_approval_id;
  
  -- If there's a workflow instance, update it too
  IF v_approval.workflow_instance_id IS NOT NULL THEN
    UPDATE public.workflow_instances
    SET 
      current_state = CASE WHEN p_action = 'approve' THEN 'APPROVED' ELSE 'REJECTED' END,
      completed_at = now(),
      updated_at = now()
    WHERE id = v_approval.workflow_instance_id;
  END IF;
  
  -- Log the execution result
  UPDATE public.agent_execution_logs
  SET 
    status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    output_data = jsonb_build_object('reviewed_by', auth.uid(), 'notes', p_notes)
  WHERE approval_queue_id = p_approval_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'approval_id', p_approval_id
  );
END;
$$;