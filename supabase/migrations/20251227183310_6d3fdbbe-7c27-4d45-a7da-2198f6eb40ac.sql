-- Fix security: set search_path on the function
CREATE OR REPLACE FUNCTION public.assign_company_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_number IS NULL THEN
    NEW.company_number := nextval('company_number_seq');
  END IF;
  RETURN NEW;
END;
$$;