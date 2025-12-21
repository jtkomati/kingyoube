-- Corrigir search_path da função validate_invitation_status
CREATE OR REPLACE FUNCTION validate_invitation_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted', 'expired', 'revoked') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;