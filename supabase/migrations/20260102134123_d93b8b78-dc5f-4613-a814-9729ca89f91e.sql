-- Modificar a tabela audit_logs para permitir user_id NULL
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- Atualizar a função de trigger para lidar com auth.uid() NULL
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Se não há usuário autenticado, pular audit log
  IF v_user_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Buscar role do usuário atual
  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = v_user_id
  LIMIT 1;

  -- Inserir log de auditoria
  INSERT INTO public.audit_logs (user_id, user_role, action, details)
  VALUES (
    v_user_id,
    COALESCE(v_role, 'VIEWER')::app_role,
    TG_OP || '_' || TG_TABLE_NAME,
    CASE 
      WHEN TG_OP = 'DELETE' THEN jsonb_build_object('old', row_to_json(OLD))::text
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))::text
      ELSE jsonb_build_object('new', row_to_json(NEW))::text
    END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;