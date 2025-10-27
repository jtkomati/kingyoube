-- Add company_id to profiles for multi-tenant isolation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_settings(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- Add company_id to key tables that need tenant isolation
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_settings(id);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_settings(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_settings(id);
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_settings(id);
ALTER TABLE public.incoming_invoices ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_settings(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON public.transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_incoming_invoices_company_id ON public.incoming_invoices(company_id);

-- Helper function to get user's company_id (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id;
$$;

-- Drop existing overly permissive policies and create tenant-scoped ones

-- Customers policies
DROP POLICY IF EXISTS "All authenticated users can view customers" ON public.customers;
CREATE POLICY "Users can view their company customers" 
ON public.customers FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid()) 
  OR get_user_role_level(auth.uid()) >= 4
);

CREATE POLICY "FINANCEIRO can create company customers"
ON public.customers FOR INSERT
WITH CHECK (
  get_user_role_level(auth.uid()) >= 3 
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "FINANCEIRO can update company customers"
ON public.customers FOR UPDATE
USING (
  get_user_role_level(auth.uid()) >= 3 
  AND company_id = get_user_company_id(auth.uid())
);

-- Suppliers policies
DROP POLICY IF EXISTS "All authenticated users can view suppliers" ON public.suppliers;
CREATE POLICY "Users can view their company suppliers"
ON public.suppliers FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid())
  OR get_user_role_level(auth.uid()) >= 4
);

CREATE POLICY "FINANCEIRO can create company suppliers"
ON public.suppliers FOR INSERT
WITH CHECK (
  get_user_role_level(auth.uid()) >= 3
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "FINANCEIRO can update company suppliers"
ON public.suppliers FOR UPDATE
USING (
  get_user_role_level(auth.uid()) >= 3
  AND company_id = get_user_company_id(auth.uid())
);

-- Transactions policies
DROP POLICY IF EXISTS "All authenticated users can view transactions" ON public.transactions;
CREATE POLICY "Users can view their company transactions"
ON public.transactions FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid())
  OR get_user_role_level(auth.uid()) >= 4
);

CREATE POLICY "FINANCEIRO can create company transactions"
ON public.transactions FOR INSERT
WITH CHECK (
  get_user_role_level(auth.uid()) >= 3
  AND auth.uid() = created_by
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "FINANCEIRO can update company transactions"
ON public.transactions FOR UPDATE
USING (
  get_user_role_level(auth.uid()) >= 3
  AND company_id = get_user_company_id(auth.uid())
);

-- Contracts policies
DROP POLICY IF EXISTS "All authenticated users can view contracts" ON public.contracts;
CREATE POLICY "Users can view their company contracts"
ON public.contracts FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid())
  OR get_user_role_level(auth.uid()) >= 4
);

CREATE POLICY "FINANCEIRO can create company contracts"
ON public.contracts FOR INSERT
WITH CHECK (
  get_user_role_level(auth.uid()) >= 3
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "FINANCEIRO can update company contracts"
ON public.contracts FOR UPDATE
USING (
  get_user_role_level(auth.uid()) >= 3
  AND company_id = get_user_company_id(auth.uid())
);

-- Incoming invoices policies
DROP POLICY IF EXISTS "All authenticated users can view incoming invoices" ON public.incoming_invoices;
CREATE POLICY "Users can view their company incoming invoices"
ON public.incoming_invoices FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid())
  OR get_user_role_level(auth.uid()) >= 4
);

CREATE POLICY "FINANCEIRO can create company incoming invoices"
ON public.incoming_invoices FOR INSERT
WITH CHECK (
  get_user_role_level(auth.uid()) >= 3
  AND auth.uid() = created_by
  AND company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "FINANCEIRO can update company incoming invoices"
ON public.incoming_invoices FOR UPDATE
USING (
  get_user_role_level(auth.uid()) >= 3
  AND company_id = get_user_company_id(auth.uid())
);