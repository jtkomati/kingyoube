-- Adicionar campos do contador em company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS accountant_email TEXT,
ADD COLUMN IF NOT EXISTS accountant_crc TEXT,
ADD COLUMN IF NOT EXISTS accountant_firm_name TEXT,
ADD COLUMN IF NOT EXISTS accountant_linked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accountant_user_id UUID;

-- Criar tabela de convites
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.company_settings(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'CONTADOR',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  crc TEXT,
  firm_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  UNIQUE(organization_id, email)
);

-- Criar constraint de validação via trigger (não CHECK pois usa now())
CREATE OR REPLACE FUNCTION validate_invitation_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted', 'expired', 'revoked') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_invitation_status_trigger ON public.invitations;
CREATE TRIGGER validate_invitation_status_trigger
BEFORE INSERT OR UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION validate_invitation_status();

-- Habilitar RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para invitations
CREATE POLICY "ADMIN can view org invitations"
ON public.invitations
FOR SELECT
USING (
  (get_user_role_level(auth.uid()) >= 4 AND organization_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "ADMIN can create org invitations"
ON public.invitations
FOR INSERT
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 4 AND organization_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "ADMIN can update org invitations"
ON public.invitations
FOR UPDATE
USING (
  (get_user_role_level(auth.uid()) >= 4 AND organization_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "Users can view invitations by token"
ON public.invitations
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Função para aceitar convite
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Buscar convite válido
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now();
    
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Atualizar convite
  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;
  
  -- Criar role do usuário
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, v_invitation.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Vincular usuário à organização
  INSERT INTO public.user_organizations (user_id, organization_id, is_default)
  VALUES (v_user_id, v_invitation.organization_id, false)
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  -- Atualizar company_settings com dados do contador
  UPDATE public.company_settings
  SET 
    accountant_user_id = v_user_id,
    accountant_linked_at = now(),
    accountant_email = v_invitation.email,
    accountant_crc = v_invitation.crc,
    accountant_firm_name = v_invitation.firm_name
  WHERE id = v_invitation.organization_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'organization_id', v_invitation.organization_id,
    'role', v_invitation.role::text
  );
END;
$$;