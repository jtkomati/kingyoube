-- Add PlugNotas configuration columns to config_fiscal table
ALTER TABLE public.config_fiscal 
ADD COLUMN IF NOT EXISTS plugnotas_token TEXT,
ADD COLUMN IF NOT EXISTS plugnotas_environment TEXT DEFAULT 'SANDBOX',
ADD COLUMN IF NOT EXISTS plugnotas_last_test TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS plugnotas_status TEXT DEFAULT 'disconnected';

-- Add comments for documentation
COMMENT ON COLUMN public.config_fiscal.plugnotas_token IS 'API token (x-api-key) for PlugNotas integration';
COMMENT ON COLUMN public.config_fiscal.plugnotas_environment IS 'Environment: SANDBOX or PRODUCTION';
COMMENT ON COLUMN public.config_fiscal.plugnotas_last_test IS 'Timestamp of last successful connection test';
COMMENT ON COLUMN public.config_fiscal.plugnotas_status IS 'Connection status: connected, disconnected, or error';