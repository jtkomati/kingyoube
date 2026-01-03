-- Fix 1: Secure organizations view with SECURITY INVOKER
-- The organizations view is over company_settings which already has RLS
-- Adding SECURITY INVOKER ensures the view respects underlying RLS
CREATE OR REPLACE VIEW public.organizations 
WITH (security_invoker = true) AS
SELECT id,
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

-- Revoke direct access to ensure RLS is enforced
REVOKE SELECT ON public.organizations FROM anon;

-- Fix 2: Create safe view for bank accounts without credentials
-- This allows FINANCEIRO users to see account info without API secrets
CREATE OR REPLACE VIEW public.bank_accounts_safe 
WITH (security_invoker = true) AS
SELECT 
    id,
    bank_name,
    bank_code,
    account_number,
    agency,
    account_type,
    balance,
    currency,
    company_id,
    api_environment,
    open_finance_status,
    open_finance_consent_id,
    consent_expires_at,
    last_sync_at,
    auto_sync_enabled,
    dda_activated,
    pluggy_item_id,
    pluggy_account_id,
    tecnospeed_item_id,
    plugbank_account_id,
    created_at,
    updated_at
    -- Excluded: client_id, client_secret, access_token, refresh_token, certificate_path, account_hash
FROM public.bank_accounts;

-- Grant SELECT on safe view to authenticated users
GRANT SELECT ON public.bank_accounts_safe TO authenticated;

-- Fix 3: Tighten bank_accounts SELECT policy to ADMIN only
-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Users can view org bank accounts" ON public.bank_accounts;

-- Create new restricted SELECT policy - ADMIN+ only for full table with credentials
CREATE POLICY "ADMIN can view full bank accounts"
ON public.bank_accounts
FOR SELECT
USING (
  (get_user_role_level(auth.uid()) >= 4 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);