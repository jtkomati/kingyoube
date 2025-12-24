
-- Atualizar função handle_new_user para vincular novos usuários à empresa modelo "Tech Consulting Ltda"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  demo_company_id UUID := '45688be2-d6c5-4e1d-8acb-e5c5982f6fdb'; -- Tech Consulting Ltda (CNPJ: 12.345.678/0001-90)
BEGIN
  -- Criar perfil do usuário vinculado à empresa modelo
  INSERT INTO public.profiles (id, email, full_name, phone_number, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Demo'),
    NEW.raw_user_meta_data->>'phone_number',
    demo_company_id
  );
  
  -- Atribuir role VIEWER por padrão (somente leitura para demo)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'VIEWER');
  
  -- Vincular usuário à empresa modelo como organização padrão
  INSERT INTO public.user_organizations (user_id, organization_id, is_default)
  VALUES (NEW.id, demo_company_id, true)
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;
