-- Add invoice_integration_id column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS invoice_integration_id TEXT;

COMMENT ON COLUMN public.transactions.invoice_integration_id IS 'ID de integração retornado pelo PlugNotas após emissão';