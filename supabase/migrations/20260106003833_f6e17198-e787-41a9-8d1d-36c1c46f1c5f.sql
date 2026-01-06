-- Add columns for Prefeitura credentials in config_fiscal table
ALTER TABLE public.config_fiscal 
ADD COLUMN IF NOT EXISTS prefeitura_login TEXT,
ADD COLUMN IF NOT EXISTS prefeitura_inscricao_municipal TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.config_fiscal.prefeitura_login IS 'Login de acesso ao sistema da Prefeitura';
COMMENT ON COLUMN public.config_fiscal.prefeitura_inscricao_municipal IS 'Número de inscrição municipal da empresa';