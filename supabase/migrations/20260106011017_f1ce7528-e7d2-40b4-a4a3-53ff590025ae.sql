-- Create prefeitura_credentials table for storing encrypted passwords
CREATE TABLE public.prefeitura_credentials (
  company_id UUID PRIMARY KEY REFERENCES public.company_settings(id) ON DELETE CASCADE,
  login TEXT,
  inscricao_municipal TEXT,
  password_ciphertext TEXT,
  password_iv TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.prefeitura_credentials IS 'Stores prefeitura credentials with AES-GCM encrypted passwords';

-- Enable RLS
ALTER TABLE public.prefeitura_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies: members of organization can read
CREATE POLICY "Users can view their organization prefeitura credentials"
ON public.prefeitura_credentials
FOR SELECT
USING (company_id = ANY(get_user_organization_ids(auth.uid())));

-- RLS policies: users with financial role (level >= 3) can insert/update/delete
CREATE POLICY "Financial users can manage prefeitura credentials"
ON public.prefeitura_credentials
FOR ALL
USING (
  company_id = ANY(get_user_organization_ids(auth.uid()))
  AND get_user_role_level(auth.uid()) >= 3
)
WITH CHECK (
  company_id = ANY(get_user_organization_ids(auth.uid()))
  AND get_user_role_level(auth.uid()) >= 3
);

-- Create trigger for updated_at
CREATE TRIGGER update_prefeitura_credentials_updated_at
BEFORE UPDATE ON public.prefeitura_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();