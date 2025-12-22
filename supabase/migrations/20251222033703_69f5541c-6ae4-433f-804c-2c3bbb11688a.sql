-- Atualizar função handle_new_user para atribuir VIEWER automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_company_id UUID;
  temp_cnpj TEXT;
BEGIN
  -- Gerar um CNPJ temporário único baseado no user_id
  temp_cnpj := 'TEMP-' || SUBSTRING(NEW.id::TEXT, 1, 18);
  
  -- Criar company_settings padrão para o novo usuário
  INSERT INTO public.company_settings (company_name, cnpj)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Minha Empresa') || ' - Empresa',
    temp_cnpj
  )
  RETURNING id INTO new_company_id;
  
  -- Criar perfil do usuário com a empresa associada
  INSERT INTO public.profiles (id, email, full_name, phone_number, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.raw_user_meta_data->>'phone_number',
    new_company_id
  );
  
  -- Atribuir role VIEWER por padrão (segurança: usuários do teste grátis não são admin)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'VIEWER');
  
  -- Vincular usuário à organização criada como organização padrão
  INSERT INTO public.user_organizations (user_id, organization_id, is_default)
  VALUES (NEW.id, new_company_id, true);
  
  RETURN NEW;
END;
$function$;

-- Atribuir VIEWER a usuários existentes que não têm role
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'VIEWER'::app_role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE ur.id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;