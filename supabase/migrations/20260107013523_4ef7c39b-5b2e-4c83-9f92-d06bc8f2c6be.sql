-- Fix accountant_client_dashboard security
-- Revoke direct SELECT access from all roles and require using the secured function

-- Revoke direct access to the view from all roles
REVOKE SELECT ON public.accountant_client_dashboard FROM authenticated;
REVOKE SELECT ON public.accountant_client_dashboard FROM anon;
REVOKE SELECT ON public.accountant_client_dashboard FROM public;

-- Grant EXECUTE on the secured function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_accountant_dashboard() TO authenticated;

-- Revoke from public to ensure only authenticated users can use the function
REVOKE EXECUTE ON FUNCTION public.get_accountant_dashboard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_accountant_dashboard() FROM public;