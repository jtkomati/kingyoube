-- ============================================
-- FASE 2: Sistema Multi-Tenant com user_organizations
-- ============================================

-- 1. Criar tabela user_organizations
CREATE TABLE public.user_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.company_settings(id) ON DELETE CASCADE,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Índices para performance
CREATE INDEX idx_user_orgs_user ON public.user_organizations(user_id);
CREATE INDEX idx_user_orgs_org ON public.user_organizations(organization_id);
CREATE INDEX idx_user_orgs_default ON public.user_organizations(user_id, is_default) WHERE is_default = true;

-- Habilitar RLS
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- 2. Migrar dados existentes de profiles para user_organizations
INSERT INTO public.user_organizations (user_id, organization_id, is_default)
SELECT id, company_id, true
FROM public.profiles
WHERE company_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- 3. Criar função get_user_organization_ids()
CREATE OR REPLACE FUNCTION public.get_user_organization_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY_AGG(organization_id), 
    ARRAY[]::uuid[]
  )
  FROM public.user_organizations 
  WHERE user_id = _user_id;
$$;

-- 4. Criar função get_current_organization_id() para compatibilidade
CREATE OR REPLACE FUNCTION public.get_current_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.user_organizations 
  WHERE user_id = _user_id AND is_default = true
  LIMIT 1;
$$;

-- 5. RLS para user_organizations
-- Usuários podem ver suas próprias associações
CREATE POLICY "Users can view own org memberships" 
ON public.user_organizations
FOR SELECT
USING (auth.uid() = user_id);

-- ADMIN+ pode gerenciar membros das suas organizações
CREATE POLICY "ADMIN can manage org memberships" 
ON public.user_organizations
FOR ALL
USING (
  get_user_role_level(auth.uid()) >= 4 
  AND organization_id = ANY(get_user_organization_ids(auth.uid()))
);

-- SUPERADMIN pode tudo
CREATE POLICY "SUPERADMIN full access on user_organizations" 
ON public.user_organizations
FOR ALL
USING (get_user_role_level(auth.uid()) >= 5);

-- ============================================
-- 6. Atualizar RLS policies das tabelas principais
-- ============================================

-- TRANSACTIONS
DROP POLICY IF EXISTS "Users can view their company transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view company transactions" ON public.transactions;

CREATE POLICY "Users can view org transactions" 
ON public.transactions
FOR SELECT
USING (
  company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "FINANCEIRO can create company transactions" ON public.transactions;
CREATE POLICY "FINANCEIRO can create org transactions" 
ON public.transactions
FOR INSERT
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND auth.uid() = created_by AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "FINANCEIRO can update company transactions" ON public.transactions;
CREATE POLICY "FINANCEIRO can update org transactions" 
ON public.transactions
FOR UPDATE
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "Users can delete own company transactions" ON public.transactions;
CREATE POLICY "Users can delete org transactions" 
ON public.transactions
FOR DELETE
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

-- CUSTOMERS
DROP POLICY IF EXISTS "Users can view their company customers" ON public.customers;
CREATE POLICY "Users can view org customers" 
ON public.customers
FOR SELECT
USING (
  company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "FINANCEIRO can create company customers" ON public.customers;
CREATE POLICY "FINANCEIRO can create org customers" 
ON public.customers
FOR INSERT
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "FINANCEIRO can update company customers" ON public.customers;
CREATE POLICY "FINANCEIRO can update org customers" 
ON public.customers
FOR UPDATE
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "Users can delete own company customers" ON public.customers;
CREATE POLICY "Users can delete org customers" 
ON public.customers
FOR DELETE
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

-- SUPPLIERS
DROP POLICY IF EXISTS "Users can view their company suppliers" ON public.suppliers;
CREATE POLICY "Users can view org suppliers" 
ON public.suppliers
FOR SELECT
USING (
  company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "FINANCEIRO can create company suppliers" ON public.suppliers;
CREATE POLICY "FINANCEIRO can create org suppliers" 
ON public.suppliers
FOR INSERT
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "FINANCEIRO can update company suppliers" ON public.suppliers;
CREATE POLICY "FINANCEIRO can update org suppliers" 
ON public.suppliers
FOR UPDATE
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "Users can delete own company suppliers" ON public.suppliers;
CREATE POLICY "Users can delete org suppliers" 
ON public.suppliers
FOR DELETE
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

-- INCOMING_INVOICES
DROP POLICY IF EXISTS "Users can view their incoming invoices" ON public.incoming_invoices;
CREATE POLICY "Users can view org incoming invoices" 
ON public.incoming_invoices
FOR SELECT
USING (
  auth.uid() = created_by
  OR company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "FINANCEIRO can create company incoming invoices" ON public.incoming_invoices;
CREATE POLICY "FINANCEIRO can create org incoming invoices" 
ON public.incoming_invoices
FOR INSERT
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND auth.uid() = created_by AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "FINANCEIRO can update company incoming invoices" ON public.incoming_invoices;
CREATE POLICY "FINANCEIRO can update org incoming invoices" 
ON public.incoming_invoices
FOR UPDATE
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

DROP POLICY IF EXISTS "Users can delete own company incoming invoices" ON public.incoming_invoices;
CREATE POLICY "Users can delete org incoming invoices" 
ON public.incoming_invoices
FOR DELETE
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Comentário na tabela
COMMENT ON TABLE public.user_organizations IS 'Tabela de associação usuário-organização para suporte multi-tenant';