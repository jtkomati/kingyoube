-- Add PlugBank columns to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS plugbank_payer_id text,
ADD COLUMN IF NOT EXISTS plugbank_status text DEFAULT 'not_registered';

-- Add PlugBank columns to bank_accounts
ALTER TABLE public.bank_accounts 
ADD COLUMN IF NOT EXISTS plugbank_account_id text,
ADD COLUMN IF NOT EXISTS consent_link text,
ADD COLUMN IF NOT EXISTS bank_code text;

-- Add PlugBank columns to sync_protocols
ALTER TABLE public.sync_protocols
ADD COLUMN IF NOT EXISTS plugbank_unique_id text,
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS company_id uuid;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sync_protocols_unique_id ON public.sync_protocols(plugbank_unique_id);