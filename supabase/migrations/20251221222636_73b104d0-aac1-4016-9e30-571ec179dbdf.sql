-- Fase 1: Preparação da Base de Dados Multi-tenant

-- 1.1 Adicionar campos faltantes em company_settings
ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'));

-- Comentários para documentação
COMMENT ON COLUMN public.company_settings.nome_fantasia IS 'Nome fantasia da empresa (trade name)';
COMMENT ON COLUMN public.company_settings.status IS 'Status do tenant: ACTIVE, INACTIVE, SUSPENDED';

-- 1.2 Adicionar organization_id em audit_logs
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.company_settings(id);

-- Índice para consultas por organization
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);

COMMENT ON COLUMN public.audit_logs.organization_id IS 'Referência à organização/tenant do registro auditado';

-- 1.3 Criar view organizations para compatibilidade futura
CREATE OR REPLACE VIEW public.organizations AS 
SELECT 
  id,
  company_name,
  nome_fantasia,
  cnpj,
  status,
  address,
  city_code,
  tax_regime,
  municipal_inscription,
  state_inscription,
  notification_email,
  cfo_partner_id,
  created_at,
  updated_at
FROM public.company_settings;

COMMENT ON VIEW public.organizations IS 'View de compatibilidade para nomenclatura multi-tenant';