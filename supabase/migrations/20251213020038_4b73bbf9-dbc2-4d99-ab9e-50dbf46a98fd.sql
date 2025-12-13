-- Update get_user_role_level function to include new roles
CREATE OR REPLACE FUNCTION public.get_user_role_level(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'SUPERADMIN') THEN 5
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'ADMIN') THEN 4
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'FINANCEIRO') THEN 3
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'CONTADOR') THEN 3
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'FISCAL') THEN 2
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'USUARIO') THEN 1
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'VIEWER') THEN 1
    ELSE 0
  END;
$$;

-- Create RLS policy for ADMIN to manage user roles
CREATE POLICY "ADMIN can manage user roles" ON public.user_roles
  FOR ALL USING (
    get_user_role_level(auth.uid()) >= 4
  );

-- Create policy for inserting new user roles (for signup flow)
CREATE POLICY "System can insert user roles" ON public.user_roles
  FOR INSERT WITH CHECK (true);