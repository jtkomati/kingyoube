-- Fix Critical Security Issues: Remove Duplicate RLS Policies and Enforce Tenant Isolation

-- STEP 1: Update existing incoming_invoices to have company_id from user's profile
UPDATE incoming_invoices
SET company_id = profiles.company_id
FROM profiles
WHERE incoming_invoices.created_by = profiles.id
  AND incoming_invoices.company_id IS NULL
  AND profiles.company_id IS NOT NULL;

-- STEP 2: Drop all legacy broad RLS policies that don't enforce company_id

-- Customers
DROP POLICY IF EXISTS "FINANCEIRO and above can create customers" ON customers;
DROP POLICY IF EXISTS "FINANCEIRO and above can update customers" ON customers;

-- Suppliers
DROP POLICY IF EXISTS "FINANCEIRO and above can create suppliers" ON suppliers;
DROP POLICY IF EXISTS "FINANCEIRO and above can update suppliers" ON suppliers;

-- Transactions
DROP POLICY IF EXISTS "FINANCEIRO and above can create transactions" ON transactions;
DROP POLICY IF EXISTS "FINANCEIRO and above can update transactions" ON transactions;

-- Contracts
DROP POLICY IF EXISTS "FINANCEIRO and above can create contracts" ON contracts;
DROP POLICY IF EXISTS "FINANCEIRO and above can update contracts" ON contracts;

-- Incoming Invoices
DROP POLICY IF EXISTS "FINANCEIRO and above can create incoming invoices" ON incoming_invoices;
DROP POLICY IF EXISTS "FINANCEIRO and above can update incoming invoices" ON incoming_invoices;
DROP POLICY IF EXISTS "ADMIN and above can delete incoming invoices" ON incoming_invoices;

-- Also drop the broad delete policy for contracts
DROP POLICY IF EXISTS "ADMIN and above can delete contracts" ON contracts;

-- STEP 3: Set company_id defaults using existing get_user_company_id function
-- Customers (all 5 have company_id)
ALTER TABLE customers 
  ALTER COLUMN company_id SET DEFAULT get_user_company_id(auth.uid());

-- Suppliers (all 5 have company_id)
ALTER TABLE suppliers 
  ALTER COLUMN company_id SET DEFAULT get_user_company_id(auth.uid());

-- Transactions (all 83 have company_id)
ALTER TABLE transactions 
  ALTER COLUMN company_id SET DEFAULT get_user_company_id(auth.uid());

-- Contracts (empty table)
ALTER TABLE contracts 
  ALTER COLUMN company_id SET DEFAULT get_user_company_id(auth.uid());

-- Incoming Invoices (updated above)
ALTER TABLE incoming_invoices 
  ALTER COLUMN company_id SET DEFAULT get_user_company_id(auth.uid());

-- STEP 4: Add validation trigger to prevent NULL company_id on insert
CREATE OR REPLACE FUNCTION public.validate_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If company_id is still NULL after default, get it from user profile
  IF NEW.company_id IS NULL THEN
    NEW.company_id := get_user_company_id(auth.uid());
  END IF;
  
  -- If still NULL, only allow for SUPERADMIN role
  IF NEW.company_id IS NULL THEN
    IF get_user_role_level(auth.uid()) < 5 THEN
      RAISE EXCEPTION 'company_id is required for this operation';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply validation trigger to all multi-tenant tables
DROP TRIGGER IF EXISTS validate_company_id_trigger ON customers;
CREATE TRIGGER validate_company_id_trigger
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION validate_company_id();

DROP TRIGGER IF EXISTS validate_company_id_trigger ON suppliers;
CREATE TRIGGER validate_company_id_trigger
  BEFORE INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION validate_company_id();

DROP TRIGGER IF EXISTS validate_company_id_trigger ON transactions;
CREATE TRIGGER validate_company_id_trigger
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_company_id();

DROP TRIGGER IF EXISTS validate_company_id_trigger ON contracts;
CREATE TRIGGER validate_company_id_trigger
  BEFORE INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION validate_company_id();

DROP TRIGGER IF EXISTS validate_company_id_trigger ON incoming_invoices;
CREATE TRIGGER validate_company_id_trigger
  BEFORE INSERT ON incoming_invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_company_id();

-- STEP 5: Add comprehensive company-scoped delete policies
CREATE POLICY "Users can delete own company customers"
ON customers FOR DELETE
USING (
  get_user_role_level(auth.uid()) >= 3 
  AND (
    company_id = get_user_company_id(auth.uid())
    OR get_user_role_level(auth.uid()) >= 4
  )
);

CREATE POLICY "Users can delete own company suppliers"
ON suppliers FOR DELETE
USING (
  get_user_role_level(auth.uid()) >= 3 
  AND (
    company_id = get_user_company_id(auth.uid())
    OR get_user_role_level(auth.uid()) >= 4
  )
);

CREATE POLICY "Users can delete own company transactions"
ON transactions FOR DELETE
USING (
  get_user_role_level(auth.uid()) >= 3 
  AND (
    company_id = get_user_company_id(auth.uid())
    OR get_user_role_level(auth.uid()) >= 4
  )
);

CREATE POLICY "Users can delete own company contracts"
ON contracts FOR DELETE
USING (
  get_user_role_level(auth.uid()) >= 3 
  AND (
    company_id = get_user_company_id(auth.uid())
    OR get_user_role_level(auth.uid()) >= 4
  )
);

CREATE POLICY "Users can delete own company incoming invoices"
ON incoming_invoices FOR DELETE
USING (
  get_user_role_level(auth.uid()) >= 3 
  AND (
    company_id = get_user_company_id(auth.uid())
    OR get_user_role_level(auth.uid()) >= 4
  )
);