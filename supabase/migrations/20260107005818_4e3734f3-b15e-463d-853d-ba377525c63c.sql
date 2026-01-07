-- Fix company_settings RLS - enforce proper tenant isolation
-- Drop overly permissive policy that allows any ADMIN to access all companies
DROP POLICY IF EXISTS "ADMIN and above can manage company settings" ON public.company_settings;

-- Create organization-scoped SELECT policy
-- Users can only view company settings for organizations they belong to
CREATE POLICY "Users can view own org company settings"
ON public.company_settings
FOR SELECT
USING (
  id = ANY(public.get_user_organization_ids(auth.uid()))
  OR public.get_user_role_level(auth.uid()) >= 5  -- SUPERADMIN only for cross-tenant
);

-- Create organization-scoped INSERT policy
-- ADMINs can only create settings for organizations they belong to
CREATE POLICY "ADMIN can insert own org company settings"
ON public.company_settings
FOR INSERT
WITH CHECK (
  (public.get_user_role_level(auth.uid()) >= 4 
   AND id = ANY(public.get_user_organization_ids(auth.uid())))
  OR public.get_user_role_level(auth.uid()) >= 5
);

-- Create organization-scoped UPDATE policy
-- ADMINs can only update settings for organizations they belong to
CREATE POLICY "ADMIN can update own org company settings"
ON public.company_settings
FOR UPDATE
USING (
  (public.get_user_role_level(auth.uid()) >= 4 
   AND id = ANY(public.get_user_organization_ids(auth.uid())))
  OR public.get_user_role_level(auth.uid()) >= 5
);

-- Create organization-scoped DELETE policy
-- ADMINs can only delete settings for organizations they belong to
CREATE POLICY "ADMIN can delete own org company settings"
ON public.company_settings
FOR DELETE
USING (
  (public.get_user_role_level(auth.uid()) >= 4 
   AND id = ANY(public.get_user_organization_ids(auth.uid())))
  OR public.get_user_role_level(auth.uid()) >= 5
);