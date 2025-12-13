-- ==============================================
-- SECURITY FIX: Add explicit authentication to profiles RLS
-- Recreate policies with `TO authenticated` role restriction
-- ==============================================

-- Drop existing SELECT policy (may have different name variations)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON public.profiles;

-- Recreate with explicit TO authenticated
CREATE POLICY "Authenticated users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Ensure UPDATE policy also has TO authenticated
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);