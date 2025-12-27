-- =====================================================
-- FASE 2: Event Sourcing para Transações
-- =====================================================

-- Tabela de eventos de transação (imutável)
CREATE TABLE public.transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'CREATED', 'UPDATED', 'APPROVED', 'REJECTED', 
    'PAID', 'CANCELLED', 'RECONCILED', 'CATEGORIZED',
    'INVOICE_ISSUED', 'INVOICE_CANCELLED'
  )),
  event_data JSONB NOT NULL DEFAULT '{}',
  previous_state JSONB,
  user_id UUID REFERENCES auth.users(id),
  company_id UUID REFERENCES public.company_settings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_event_data CHECK (jsonb_typeof(event_data) = 'object')
);

-- Índices para performance
CREATE INDEX idx_transaction_events_tx_id ON public.transaction_events(transaction_id);
CREATE INDEX idx_transaction_events_type ON public.transaction_events(event_type);
CREATE INDEX idx_transaction_events_company ON public.transaction_events(company_id);
CREATE INDEX idx_transaction_events_created ON public.transaction_events(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view org transaction events"
ON public.transaction_events FOR SELECT
USING (
  company_id = ANY (get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "System can create transaction events"
ON public.transaction_events FOR INSERT
WITH CHECK (true);

-- Trigger para capturar mudanças automaticamente
CREATE OR REPLACE FUNCTION public.capture_transaction_event()
RETURNS TRIGGER
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type TEXT;
  v_company_id UUID;
BEGIN
  -- Determinar tipo de evento
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'CREATED';
    v_company_id := NEW.company_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detectar tipo de mudança baseado em campos alterados
    IF NEW.invoice_status IS DISTINCT FROM OLD.invoice_status THEN
      IF NEW.invoice_status = 'issued' THEN
        v_event_type := 'INVOICE_ISSUED';
      ELSIF NEW.invoice_status = 'cancelled' THEN
        v_event_type := 'INVOICE_CANCELLED';
      ELSE
        v_event_type := 'UPDATED';
      END IF;
    ELSIF NEW.payment_date IS NOT NULL AND OLD.payment_date IS NULL THEN
      v_event_type := 'PAID';
    ELSIF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      v_event_type := 'CATEGORIZED';
    ELSE
      v_event_type := 'UPDATED';
    END IF;
    v_company_id := NEW.company_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'CANCELLED';
    v_company_id := OLD.company_id;
  END IF;

  -- Inserir evento
  INSERT INTO public.transaction_events (
    transaction_id, 
    event_type, 
    event_data, 
    previous_state,
    user_id,
    company_id
  )
  VALUES (
    COALESCE(NEW.id, OLD.id),
    v_event_type,
    CASE TG_OP
      WHEN 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    auth.uid(),
    v_company_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar trigger na tabela transactions
CREATE TRIGGER transaction_event_capture
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.capture_transaction_event();

-- =====================================================
-- FASE 2: Workflow Engine
-- =====================================================

-- Definição de workflows
CREATE TABLE public.workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('INVOICE', 'TRANSACTION', 'CONTRACT', 'PAYMENT')),
  description TEXT,
  states JSONB NOT NULL DEFAULT '[]',
  transitions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  company_id UUID REFERENCES public.company_settings(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instâncias de workflow
CREATE TABLE public.workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflow_definitions(id),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  current_state TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  company_id UUID REFERENCES public.company_settings(id),
  started_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_entity_workflow UNIQUE (entity_id, workflow_id)
);

-- Histórico de transições
CREATE TABLE public.workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_workflow_instances_entity ON public.workflow_instances(entity_id, entity_type);
CREATE INDEX idx_workflow_instances_state ON public.workflow_instances(current_state);
CREATE INDEX idx_workflow_instances_company ON public.workflow_instances(company_id);
CREATE INDEX idx_workflow_history_instance ON public.workflow_history(instance_id);

-- Habilitar RLS
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_history ENABLE ROW LEVEL SECURITY;

-- Políticas para workflow_definitions
CREATE POLICY "Users can view org workflow definitions"
ON public.workflow_definitions FOR SELECT
USING (
  company_id IS NULL 
  OR company_id = ANY (get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "ADMIN can manage org workflow definitions"
ON public.workflow_definitions FOR ALL
USING (
  (get_user_role_level(auth.uid()) >= 4 AND company_id = ANY (get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Políticas para workflow_instances
CREATE POLICY "Users can view org workflow instances"
ON public.workflow_instances FOR SELECT
USING (
  company_id = ANY (get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "FINANCEIRO can manage org workflow instances"
ON public.workflow_instances FOR ALL
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY (get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Políticas para workflow_history
CREATE POLICY "Users can view org workflow history"
ON public.workflow_history FOR SELECT
USING (
  instance_id IN (
    SELECT id FROM public.workflow_instances 
    WHERE company_id = ANY (get_user_organization_ids(auth.uid()))
  )
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "System can create workflow history"
ON public.workflow_history FOR INSERT
WITH CHECK (true);

-- Função para transição de estado
CREATE OR REPLACE FUNCTION public.workflow_transition(
  p_instance_id UUID,
  p_to_state TEXT,
  p_action TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance RECORD;
  v_workflow RECORD;
  v_transition JSONB;
  v_allowed BOOLEAN := false;
  v_user_role INTEGER;
BEGIN
  -- Buscar instância
  SELECT * INTO v_instance FROM workflow_instances WHERE id = p_instance_id;
  IF v_instance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Instance not found');
  END IF;
  
  -- Buscar definição do workflow
  SELECT * INTO v_workflow FROM workflow_definitions WHERE id = v_instance.workflow_id;
  
  -- Verificar se transição é permitida
  v_user_role := get_user_role_level(auth.uid());
  
  FOR v_transition IN SELECT * FROM jsonb_array_elements(v_workflow.transitions)
  LOOP
    IF v_transition->>'from' = v_instance.current_state 
       AND v_transition->>'to' = p_to_state THEN
      -- Verificar roles permitidos
      IF v_transition->'roles' IS NULL OR v_user_role >= 3 THEN
        v_allowed := true;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transition not allowed');
  END IF;
  
  -- Registrar histórico
  INSERT INTO workflow_history (instance_id, from_state, to_state, action, user_id, notes)
  VALUES (p_instance_id, v_instance.current_state, p_to_state, p_action, auth.uid(), p_notes);
  
  -- Atualizar estado
  UPDATE workflow_instances 
  SET current_state = p_to_state, 
      updated_at = now(),
      completed_at = CASE WHEN p_to_state IN ('APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED') THEN now() ELSE NULL END
  WHERE id = p_instance_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'from_state', v_instance.current_state,
    'to_state', p_to_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION workflow_transition(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Inserir workflows padrão
INSERT INTO public.workflow_definitions (name, entity_type, description, states, transitions) VALUES
(
  'invoice_approval',
  'INVOICE',
  'Fluxo de aprovação de notas fiscais',
  '["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ISSUED", "CANCELLED"]',
  '[
    {"from": "DRAFT", "to": "PENDING_APPROVAL", "action": "submit", "roles": ["USUARIO", "FINANCEIRO"]},
    {"from": "PENDING_APPROVAL", "to": "APPROVED", "action": "approve", "roles": ["FINANCEIRO", "ADMIN"]},
    {"from": "PENDING_APPROVAL", "to": "REJECTED", "action": "reject", "roles": ["FINANCEIRO", "ADMIN"]},
    {"from": "APPROVED", "to": "ISSUED", "action": "issue", "roles": ["FINANCEIRO"]},
    {"from": "APPROVED", "to": "CANCELLED", "action": "cancel", "roles": ["ADMIN"]},
    {"from": "REJECTED", "to": "DRAFT", "action": "revise", "roles": ["USUARIO", "FINANCEIRO"]}
  ]'
),
(
  'transaction_approval',
  'TRANSACTION',
  'Fluxo de aprovação de transações acima de R$ 10.000',
  '["PENDING", "PENDING_APPROVAL", "APPROVED", "REJECTED", "COMPLETED"]',
  '[
    {"from": "PENDING", "to": "PENDING_APPROVAL", "action": "submit", "roles": ["USUARIO", "FINANCEIRO"]},
    {"from": "PENDING_APPROVAL", "to": "APPROVED", "action": "approve", "roles": ["FINANCEIRO", "ADMIN"]},
    {"from": "PENDING_APPROVAL", "to": "REJECTED", "action": "reject", "roles": ["FINANCEIRO", "ADMIN"]},
    {"from": "APPROVED", "to": "COMPLETED", "action": "complete", "roles": ["FINANCEIRO"]},
    {"from": "REJECTED", "to": "PENDING", "action": "revise", "roles": ["USUARIO", "FINANCEIRO"]}
  ]'
),
(
  'contract_approval',
  'CONTRACT',
  'Fluxo de aprovação de contratos',
  '["DRAFT", "REVIEW", "LEGAL_REVIEW", "APPROVED", "SIGNED", "ACTIVE", "EXPIRED", "CANCELLED"]',
  '[
    {"from": "DRAFT", "to": "REVIEW", "action": "submit", "roles": ["USUARIO", "FINANCEIRO"]},
    {"from": "REVIEW", "to": "LEGAL_REVIEW", "action": "approve", "roles": ["FINANCEIRO"]},
    {"from": "LEGAL_REVIEW", "to": "APPROVED", "action": "approve", "roles": ["ADMIN"]},
    {"from": "LEGAL_REVIEW", "to": "REVIEW", "action": "reject", "roles": ["ADMIN"]},
    {"from": "APPROVED", "to": "SIGNED", "action": "sign", "roles": ["ADMIN"]},
    {"from": "SIGNED", "to": "ACTIVE", "action": "activate", "roles": ["FINANCEIRO"]},
    {"from": "ACTIVE", "to": "EXPIRED", "action": "expire", "roles": ["SYSTEM"]},
    {"from": "ACTIVE", "to": "CANCELLED", "action": "cancel", "roles": ["ADMIN"]}
  ]'
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_workflow_definitions_updated_at
BEFORE UPDATE ON public.workflow_definitions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_instances_updated_at
BEFORE UPDATE ON public.workflow_instances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();