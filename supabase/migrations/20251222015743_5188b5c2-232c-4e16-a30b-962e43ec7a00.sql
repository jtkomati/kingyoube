-- =====================================================
-- FIX: Accounting tables tenant isolation
-- =====================================================

-- Step 1: Add company_id columns to tables that need them
ALTER TABLE public.accounting_entries 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company_settings(id);

ALTER TABLE public.accounting_chart_of_accounts 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company_settings(id);

ALTER TABLE public.accounting_cost_centers 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company_settings(id);

ALTER TABLE public.accounting_profit_centers 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company_settings(id);

ALTER TABLE public.accounting_projects 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company_settings(id);

ALTER TABLE public.accounting_entry_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company_settings(id);

-- Step 2: Migrate existing data - set company_id from creator's profile
UPDATE public.accounting_entries 
SET company_id = (
  SELECT company_id FROM public.profiles WHERE id = accounting_entries.created_by
) 
WHERE company_id IS NULL AND created_by IS NOT NULL;

-- For projects, get company_id from customer
UPDATE public.accounting_projects 
SET company_id = (
  SELECT company_id FROM public.customers WHERE id = accounting_projects.customer_id
) 
WHERE company_id IS NULL AND customer_id IS NOT NULL;

-- For profit centers, get company_id from customer
UPDATE public.accounting_profit_centers 
SET company_id = (
  SELECT company_id FROM public.customers WHERE id = accounting_profit_centers.customer_id
) 
WHERE company_id IS NULL AND customer_id IS NOT NULL;

-- Step 3: Drop vulnerable SELECT policies that allow any authenticated user
DROP POLICY IF EXISTS "All authenticated users can view chart of accounts" ON public.accounting_chart_of_accounts;
DROP POLICY IF EXISTS "All authenticated users can view entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "All authenticated users can view entry items" ON public.accounting_entry_items;
DROP POLICY IF EXISTS "All authenticated users can view profit centers" ON public.accounting_profit_centers;
DROP POLICY IF EXISTS "All authenticated users can view projects" ON public.accounting_projects;
DROP POLICY IF EXISTS "All authenticated users can view cost centers" ON public.accounting_cost_centers;
DROP POLICY IF EXISTS "All authenticated users can view time entries" ON public.project_time_entries;

-- Step 4: Create organization-scoped SELECT policies

-- Chart of Accounts: allow viewing org-specific OR shared (company_id IS NULL means template)
CREATE POLICY "Users can view org chart of accounts"
ON public.accounting_chart_of_accounts FOR SELECT
TO authenticated
USING (
  company_id IS NULL 
  OR company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Cost Centers: org-scoped
CREATE POLICY "Users can view org cost centers"
ON public.accounting_cost_centers FOR SELECT
TO authenticated
USING (
  company_id IS NULL 
  OR company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Profit Centers: org-scoped
CREATE POLICY "Users can view org profit centers"
ON public.accounting_profit_centers FOR SELECT
TO authenticated
USING (
  company_id IS NULL
  OR company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Projects: org-scoped
CREATE POLICY "Users can view org projects"
ON public.accounting_projects FOR SELECT
TO authenticated
USING (
  company_id IS NULL
  OR company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Accounting Entries: org-scoped
CREATE POLICY "Users can view org accounting entries"
ON public.accounting_entries FOR SELECT
TO authenticated
USING (
  company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Entry Items: org-scoped via entry relationship
CREATE POLICY "Users can view org entry items"
ON public.accounting_entry_items FOR SELECT
TO authenticated
USING (
  entry_id IN (
    SELECT id FROM public.accounting_entries
    WHERE company_id = ANY(get_user_organization_ids(auth.uid()))
  )
  OR get_user_role_level(auth.uid()) >= 5
);

-- Time Entries: org-scoped via project relationship
CREATE POLICY "Users can view org time entries"
ON public.project_time_entries FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.accounting_projects
    WHERE company_id IS NULL 
    OR company_id = ANY(get_user_organization_ids(auth.uid()))
  )
  OR get_user_role_level(auth.uid()) >= 5
);

-- Step 5: Update INSERT/UPDATE/DELETE policies to enforce company_id

-- Chart of Accounts: update existing ALL policy to be more specific
DROP POLICY IF EXISTS "FINANCEIRO and above can manage chart of accounts" ON public.accounting_chart_of_accounts;
CREATE POLICY "FINANCEIRO can manage org chart of accounts"
ON public.accounting_chart_of_accounts FOR ALL
TO authenticated
USING (
  (get_user_role_level(auth.uid()) >= 3 AND (company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR get_user_role_level(auth.uid()) >= 5
)
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND (company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Cost Centers
DROP POLICY IF EXISTS "FINANCEIRO and above can manage cost centers" ON public.accounting_cost_centers;
CREATE POLICY "FINANCEIRO can manage org cost centers"
ON public.accounting_cost_centers FOR ALL
TO authenticated
USING (
  (get_user_role_level(auth.uid()) >= 3 AND (company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR get_user_role_level(auth.uid()) >= 5
)
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND (company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Profit Centers
DROP POLICY IF EXISTS "FINANCEIRO and above can manage profit centers" ON public.accounting_profit_centers;
CREATE POLICY "FINANCEIRO can manage org profit centers"
ON public.accounting_profit_centers FOR ALL
TO authenticated
USING (
  (get_user_role_level(auth.uid()) >= 3 AND (company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR get_user_role_level(auth.uid()) >= 5
)
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND (company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Projects
DROP POLICY IF EXISTS "FINANCEIRO and above can manage projects" ON public.accounting_projects;
CREATE POLICY "FINANCEIRO can manage org projects"
ON public.accounting_projects FOR ALL
TO authenticated
USING (
  (get_user_role_level(auth.uid()) >= 3 AND (company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR get_user_role_level(auth.uid()) >= 5
)
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND (company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Accounting Entries
DROP POLICY IF EXISTS "FINANCEIRO and above can manage entries" ON public.accounting_entries;
CREATE POLICY "FINANCEIRO can manage org entries"
ON public.accounting_entries FOR ALL
TO authenticated
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
)
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Entry Items
DROP POLICY IF EXISTS "FINANCEIRO and above can manage entry items" ON public.accounting_entry_items;
CREATE POLICY "FINANCEIRO can manage org entry items"
ON public.accounting_entry_items FOR ALL
TO authenticated
USING (
  (get_user_role_level(auth.uid()) >= 3 AND entry_id IN (
    SELECT id FROM public.accounting_entries WHERE company_id = ANY(get_user_organization_ids(auth.uid()))
  ))
  OR get_user_role_level(auth.uid()) >= 5
)
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND entry_id IN (
    SELECT id FROM public.accounting_entries WHERE company_id = ANY(get_user_organization_ids(auth.uid()))
  ))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Time Entries: update policies
DROP POLICY IF EXISTS "FINANCEIRO and above can manage all time entries" ON public.project_time_entries;
CREATE POLICY "FINANCEIRO can manage org time entries"
ON public.project_time_entries FOR ALL
TO authenticated
USING (
  (get_user_role_level(auth.uid()) >= 3 AND project_id IN (
    SELECT id FROM public.accounting_projects 
    WHERE company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))
  ))
  OR get_user_role_level(auth.uid()) >= 5
)
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND project_id IN (
    SELECT id FROM public.accounting_projects 
    WHERE company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))
  ))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Step 6: Add triggers to auto-populate company_id on insert
CREATE OR REPLACE FUNCTION public.set_company_id_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := get_user_company_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Add triggers to accounting tables
DROP TRIGGER IF EXISTS set_accounting_entries_company_id ON public.accounting_entries;
CREATE TRIGGER set_accounting_entries_company_id
BEFORE INSERT ON public.accounting_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id_from_user();

DROP TRIGGER IF EXISTS set_chart_of_accounts_company_id ON public.accounting_chart_of_accounts;
CREATE TRIGGER set_chart_of_accounts_company_id
BEFORE INSERT ON public.accounting_chart_of_accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id_from_user();

DROP TRIGGER IF EXISTS set_cost_centers_company_id ON public.accounting_cost_centers;
CREATE TRIGGER set_cost_centers_company_id
BEFORE INSERT ON public.accounting_cost_centers
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id_from_user();

DROP TRIGGER IF EXISTS set_profit_centers_company_id ON public.accounting_profit_centers;
CREATE TRIGGER set_profit_centers_company_id
BEFORE INSERT ON public.accounting_profit_centers
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id_from_user();

DROP TRIGGER IF EXISTS set_projects_company_id ON public.accounting_projects;
CREATE TRIGGER set_projects_company_id
BEFORE INSERT ON public.accounting_projects
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id_from_user();