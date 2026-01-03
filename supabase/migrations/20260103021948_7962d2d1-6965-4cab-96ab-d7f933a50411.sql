-- Create business_rules table for dynamic rule engine
CREATE TABLE public.business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  context TEXT NOT NULL,
  logic JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Indexes for efficient queries
CREATE INDEX idx_business_rules_context ON public.business_rules(context);
CREATE INDEX idx_business_rules_active ON public.business_rules(is_active);
CREATE INDEX idx_business_rules_name ON public.business_rules(rule_name);

-- Enable RLS
ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read rules
CREATE POLICY "Authenticated users can read rules"
  ON public.business_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: ADMIN+ can create rules
CREATE POLICY "ADMIN can create rules"
  ON public.business_rules FOR INSERT
  WITH CHECK (get_user_role_level(auth.uid()) >= 4);

-- Policy: ADMIN+ can update rules
CREATE POLICY "ADMIN can update rules"
  ON public.business_rules FOR UPDATE
  USING (get_user_role_level(auth.uid()) >= 4);

-- Policy: SUPERADMIN can delete rules
CREATE POLICY "SUPERADMIN can delete rules"
  ON public.business_rules FOR DELETE
  USING (get_user_role_level(auth.uid()) >= 5);

-- Function to increment version on update
CREATE OR REPLACE FUNCTION public.increment_rule_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for version increment
CREATE TRIGGER trigger_rule_version
  BEFORE UPDATE ON public.business_rules
  FOR EACH ROW EXECUTE FUNCTION public.increment_rule_version();

-- Seed data: Initial business rules
INSERT INTO public.business_rules (rule_name, description, context, logic)
VALUES 
(
  'PAYMENT_APPROVAL_LIMIT',
  'Define o valor máximo para pagamentos automáticos sem aprovação humana. Pagamentos acima deste limite exigem aprovação de um usuário com permissão FINANCEIRO ou superior.',
  'financeiro',
  '{"limit": 2000, "currency": "BRL", "action_above_limit": "require_human_approval", "approval_roles": ["FINANCEIRO", "ADMIN", "SUPERADMIN"]}'::jsonb
),
(
  'AUTO_CATEGORIZE_THRESHOLD',
  'Define a confiança mínima (0-100) para categorização automática de transações pela IA. Abaixo deste valor, a transação vai para fila de revisão.',
  'financeiro',
  '{"confidence_threshold": 85, "fallback_action": "queue_for_review"}'::jsonb
),
(
  'INVOICE_AUTO_ISSUE',
  'Define se notas fiscais devem ser emitidas automaticamente após aprovação de faturamento.',
  'faturamento',
  '{"auto_issue": true, "delay_minutes": 5, "require_certificate": true}'::jsonb
),
(
  'TREASURY_ALERT_THRESHOLD',
  'Define o saldo mínimo em caixa antes de disparar alerta de tesouraria.',
  'tesouraria',
  '{"min_balance": 50000, "currency": "BRL", "alert_days_ahead": 7, "severity": "WARNING"}'::jsonb
),
(
  'SUPPLIER_RISK_SCORE',
  'Instrução para IA avaliar risco de fornecedores antes de aprovar pagamentos.',
  'compras',
  '{"system_instruction": "Rejeite pagamentos para fornecedores com score de risco abaixo de 50. Considere: histórico de entregas, pontualidade, qualidade.", "score_threshold": 50}'::jsonb
);