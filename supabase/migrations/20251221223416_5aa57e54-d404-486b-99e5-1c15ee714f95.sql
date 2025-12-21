-- =====================================================
-- FASE 3: Atualizar RLS para multi-organizações
-- Tabelas: bank_accounts, bank_statements, contracts, 
--          config_fiscal, solicitacoes_apuracao, sci_integrations
-- =====================================================

-- =====================================================
-- 1. BANK_ACCOUNTS
-- =====================================================
DROP POLICY IF EXISTS "ADMIN and above can manage bank accounts" ON public.bank_accounts;

CREATE POLICY "Users can view org bank accounts" 
ON public.bank_accounts FOR SELECT 
USING (
  (company_id = ANY(get_user_organization_ids(auth.uid()))) 
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can create org bank accounts" 
ON public.bank_accounts FOR INSERT 
WITH CHECK (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can update org bank accounts" 
ON public.bank_accounts FOR UPDATE 
USING (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can delete org bank accounts" 
ON public.bank_accounts FOR DELETE 
USING (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

-- =====================================================
-- 2. BANK_STATEMENTS
-- =====================================================
DROP POLICY IF EXISTS "FINANCEIRO and above can manage bank statements" ON public.bank_statements;

CREATE POLICY "Users can view org bank statements" 
ON public.bank_statements FOR SELECT 
USING (
  (bank_account_id IN (
    SELECT id FROM public.bank_accounts 
    WHERE company_id = ANY(get_user_organization_ids(auth.uid()))
  ))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can create org bank statements" 
ON public.bank_statements FOR INSERT 
WITH CHECK (
  ((get_user_role_level(auth.uid()) >= 3) AND (bank_account_id IN (
    SELECT id FROM public.bank_accounts 
    WHERE company_id = ANY(get_user_organization_ids(auth.uid()))
  )))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can update org bank statements" 
ON public.bank_statements FOR UPDATE 
USING (
  ((get_user_role_level(auth.uid()) >= 3) AND (bank_account_id IN (
    SELECT id FROM public.bank_accounts 
    WHERE company_id = ANY(get_user_organization_ids(auth.uid()))
  )))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can delete org bank statements" 
ON public.bank_statements FOR DELETE 
USING (
  ((get_user_role_level(auth.uid()) >= 3) AND (bank_account_id IN (
    SELECT id FROM public.bank_accounts 
    WHERE company_id = ANY(get_user_organization_ids(auth.uid()))
  )))
  OR (get_user_role_level(auth.uid()) >= 5)
);

-- =====================================================
-- 3. CONTRACTS
-- =====================================================
DROP POLICY IF EXISTS "Users can view their contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update their contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can delete their contracts" ON public.contracts;

CREATE POLICY "Users can view org contracts" 
ON public.contracts FOR SELECT 
USING (
  (company_id = ANY(get_user_organization_ids(auth.uid())))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can create org contracts" 
ON public.contracts FOR INSERT 
WITH CHECK (
  ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can update org contracts" 
ON public.contracts FOR UPDATE 
USING (
  ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can delete org contracts" 
ON public.contracts FOR DELETE 
USING (
  ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

-- =====================================================
-- 4. CONFIG_FISCAL
-- =====================================================
DROP POLICY IF EXISTS "FINANCEIRO can manage company fiscal config" ON public.config_fiscal;
DROP POLICY IF EXISTS "Users can view their company fiscal config" ON public.config_fiscal;

CREATE POLICY "Users can view org fiscal config" 
ON public.config_fiscal FOR SELECT 
USING (
  (company_id = ANY(get_user_organization_ids(auth.uid())))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can create org fiscal config" 
ON public.config_fiscal FOR INSERT 
WITH CHECK (
  ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can update org fiscal config" 
ON public.config_fiscal FOR UPDATE 
USING (
  ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can delete org fiscal config" 
ON public.config_fiscal FOR DELETE 
USING (
  ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

-- =====================================================
-- 5. SOLICITACOES_APURACAO
-- =====================================================
DROP POLICY IF EXISTS "Users can view their apuracao requests" ON public.solicitacoes_apuracao;
DROP POLICY IF EXISTS "Users can create apuracao requests" ON public.solicitacoes_apuracao;
DROP POLICY IF EXISTS "Users can update apuracao requests" ON public.solicitacoes_apuracao;

CREATE POLICY "Users can view org apuracao requests" 
ON public.solicitacoes_apuracao FOR SELECT 
USING (
  (company_id = ANY(get_user_organization_ids(auth.uid())))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "Users can create org apuracao requests" 
ON public.solicitacoes_apuracao FOR INSERT 
WITH CHECK (
  (company_id = ANY(get_user_organization_ids(auth.uid())))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "Users can update org apuracao requests" 
ON public.solicitacoes_apuracao FOR UPDATE 
USING (
  (company_id = ANY(get_user_organization_ids(auth.uid())))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can delete org apuracao requests" 
ON public.solicitacoes_apuracao FOR DELETE 
USING (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

-- =====================================================
-- 6. SCI_INTEGRATIONS
-- =====================================================
DROP POLICY IF EXISTS "ADMIN and above can manage SCI integrations" ON public.sci_integrations;

CREATE POLICY "Users can view org SCI integrations" 
ON public.sci_integrations FOR SELECT 
USING (
  (company_id = ANY(get_user_organization_ids(auth.uid())))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can create org SCI integrations" 
ON public.sci_integrations FOR INSERT 
WITH CHECK (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can update org SCI integrations" 
ON public.sci_integrations FOR UPDATE 
USING (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can delete org SCI integrations" 
ON public.sci_integrations FOR DELETE 
USING (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);