-- Criar entradas em company_settings para usuários existentes sem company_id
DO $$
DECLARE
  profile_record RECORD;
  new_company_id UUID;
BEGIN
  FOR profile_record IN 
    SELECT id, full_name, email FROM public.profiles WHERE company_id IS NULL
  LOOP
    -- Criar company_settings para o usuário
    INSERT INTO public.company_settings (company_name, cnpj)
    VALUES (
      profile_record.full_name || ' - Empresa',
      'CONFIGURAR-CNPJ-' || substring(profile_record.id::text, 1, 8)
    )
    RETURNING id INTO new_company_id;
    
    -- Atualizar perfil com a nova empresa
    UPDATE public.profiles
    SET company_id = new_company_id
    WHERE id = profile_record.id;
    
    RAISE NOTICE 'Criada empresa % para usuário %', new_company_id, profile_record.email;
  END LOOP;
END $$;

-- Atualizar função handle_new_user para criar company_settings automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Criar company_settings padrão para o novo usuário
  INSERT INTO public.company_settings (company_name, cnpj)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Minha Empresa') || ' - Empresa',
    'CONFIGURAR-CNPJ'
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
$$;