-- Recriar view organizations com SECURITY INVOKER (mais seguro)
DROP VIEW IF EXISTS public.organizations;

CREATE VIEW public.organizations 
WITH (security_invoker = true) AS 
SELECT 
  id,
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

COMMENT ON VIEW public.organizations IS 'View de compatibilidade para nomenclatura multi-tenant (SECURITY INVOKER)';