-- ==============================================
-- SECURITY FIX: Remove hardcoded JWT from cron job
-- ==============================================

-- Remove the cron job that contains hardcoded JWT token
SELECT cron.unschedule('budget-variance-monitor-weekly');

-- ==============================================
-- SECURITY FIX: Update cfo_partners RLS policies
-- The current policies are correct but let's ensure 
-- email/phone are only accessible to the owner
-- ==============================================

-- First, let's verify and recreate policies to ensure they're restrictive
-- Drop existing policies to recreate them with proper restrictions
DROP POLICY IF EXISTS "CFO partners can view their own profile" ON public.cfo_partners;
DROP POLICY IF EXISTS "CFO partners can update their own profile" ON public.cfo_partners;
DROP POLICY IF EXISTS "SUPERADMIN can manage all CFO partners" ON public.cfo_partners;

-- Recreate with explicit PERMISSIVE policies (only one needs to pass)
CREATE POLICY "CFO partners can view their own profile" 
ON public.cfo_partners 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "CFO partners can update their own profile" 
ON public.cfo_partners 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "CFO partners can insert their own profile" 
ON public.cfo_partners 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "CFO partners can delete their own profile" 
ON public.cfo_partners 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- SUPERADMIN full access (separate policy)
CREATE POLICY "SUPERADMIN can manage all CFO partners" 
ON public.cfo_partners 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'SUPERADMIN'::app_role));

-- ==============================================
-- Add index for better RLS performance
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_cfo_partners_user_id ON public.cfo_partners(user_id);