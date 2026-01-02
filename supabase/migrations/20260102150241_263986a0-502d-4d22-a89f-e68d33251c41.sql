-- Add invoice_environment column to track if invoice was issued in sandbox or production
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS invoice_environment TEXT DEFAULT 'SANDBOX';

-- Add comment for documentation
COMMENT ON COLUMN public.transactions.invoice_environment IS 'Environment where the invoice was issued: SANDBOX or PRODUCTION';