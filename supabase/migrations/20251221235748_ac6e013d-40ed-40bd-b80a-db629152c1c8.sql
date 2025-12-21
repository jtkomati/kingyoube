-- Add LGPD/GDPR compliant fields to waitlist_leads table
ALTER TABLE public.waitlist_leads 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS marketing_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'testar_gratis',
ADD COLUMN IF NOT EXISTS synced_to_sheets BOOLEAN DEFAULT false;

-- Create index for SDR queries
CREATE INDEX IF NOT EXISTS idx_waitlist_leads_synced ON public.waitlist_leads(synced_to_sheets);
CREATE INDEX IF NOT EXISTS idx_waitlist_leads_created ON public.waitlist_leads(created_at DESC);