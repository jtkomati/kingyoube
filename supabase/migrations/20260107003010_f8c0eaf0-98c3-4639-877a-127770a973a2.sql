-- Fix contract_clauses policies - handle existing policies
-- First drop any existing policies that may conflict
DROP POLICY IF EXISTS "System can create contract clauses" ON public.contract_clauses;
DROP POLICY IF EXISTS "Users can view org contract clauses" ON public.contract_clauses;
DROP POLICY IF EXISTS "FINANCEIRO can update org contract clauses" ON public.contract_clauses;
DROP POLICY IF EXISTS "FINANCEIRO can delete org contract clauses" ON public.contract_clauses;
DROP POLICY IF EXISTS "FINANCEIRO can manage org contract clauses" ON public.contract_clauses;

-- Recreate proper policies

-- Allow system (Edge Functions with service role) to create contract clauses
CREATE POLICY "System can create contract clauses"
ON public.contract_clauses
FOR INSERT
WITH CHECK (true);

-- Users can view clauses for contracts in their organizations
CREATE POLICY "Users can view org contract clauses"
ON public.contract_clauses
FOR SELECT
USING (
  contract_id IN (
    SELECT id FROM public.contracts 
    WHERE company_id = ANY(public.get_user_organization_ids(auth.uid()))
  )
  OR public.get_user_role_level(auth.uid()) >= 5
);

-- FINANCEIRO+ can update clauses for their organization's contracts
CREATE POLICY "FINANCEIRO can update org contract clauses"
ON public.contract_clauses
FOR UPDATE
USING (
  (public.get_user_role_level(auth.uid()) >= 3 
   AND contract_id IN (
     SELECT id FROM public.contracts 
     WHERE company_id = ANY(public.get_user_organization_ids(auth.uid()))
   ))
  OR public.get_user_role_level(auth.uid()) >= 5
);

-- FINANCEIRO+ can delete clauses for their organization's contracts
CREATE POLICY "FINANCEIRO can delete org contract clauses"
ON public.contract_clauses
FOR DELETE
USING (
  (public.get_user_role_level(auth.uid()) >= 3 
   AND contract_id IN (
     SELECT id FROM public.contracts 
     WHERE company_id = ANY(public.get_user_organization_ids(auth.uid()))
   ))
  OR public.get_user_role_level(auth.uid()) >= 5
);