
-- Corrigir a função handle_new_user para gerar CNPJ único
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
  
  RETURN NEW;
END;
$function$;
