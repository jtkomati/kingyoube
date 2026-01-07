-- Fix critical privilege escalation vulnerability in user_roles table
-- Drop the vulnerable policy that allows any user to insert any role
DROP POLICY IF EXISTS "System can insert user roles" ON public.user_roles;

-- Create secure policy that only allows ADMIN+ to insert user roles
CREATE POLICY "Only admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role_level(auth.uid()) >= 4
);