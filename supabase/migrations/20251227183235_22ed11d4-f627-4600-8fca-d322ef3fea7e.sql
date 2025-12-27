-- Add company_number column to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS company_number INTEGER;

-- Set initial values for existing companies
UPDATE public.company_settings 
SET company_number = 0 
WHERE company_name ILIKE '%Demonstração%' OR company_name ILIKE '%Demonstracao%';

UPDATE public.company_settings 
SET company_number = 1 
WHERE company_name ILIKE '%Kingyoube%' OR company_name ILIKE '%KingYouBe%';

-- Create a sequence for auto-incrementing new company numbers
CREATE SEQUENCE IF NOT EXISTS company_number_seq START WITH 2;

-- Set next value based on existing max
SELECT setval('company_number_seq', COALESCE((SELECT MAX(company_number) + 1 FROM public.company_settings), 2));

-- Create a function to auto-assign company numbers
CREATE OR REPLACE FUNCTION public.assign_company_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_number IS NULL THEN
    NEW.company_number := nextval('company_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign company numbers
DROP TRIGGER IF EXISTS assign_company_number_trigger ON public.company_settings;
CREATE TRIGGER assign_company_number_trigger
  BEFORE INSERT ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_company_number();