-- Add Pluggy-specific columns to bank_accounts
ALTER TABLE public.bank_accounts 
ADD COLUMN IF NOT EXISTS pluggy_item_id text,
ADD COLUMN IF NOT EXISTS pluggy_account_id text;

-- Create unique index on pluggy_account_id for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_pluggy_account_id 
ON public.bank_accounts(pluggy_account_id) WHERE pluggy_account_id IS NOT NULL;

-- Create index on pluggy_item_id for lookups
CREATE INDEX IF NOT EXISTS idx_bank_accounts_pluggy_item_id 
ON public.bank_accounts(pluggy_item_id) WHERE pluggy_item_id IS NOT NULL;

-- Create pluggy_connections table to track item connections with user context
CREATE TABLE IF NOT EXISTS public.pluggy_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  pluggy_item_id text NOT NULL UNIQUE,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pluggy_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pluggy_connections
CREATE POLICY "Users can view org pluggy connections" 
ON public.pluggy_connections 
FOR SELECT 
USING (
  (company_id = ANY (get_user_organization_ids(auth.uid()))) 
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "Users can create pluggy connections for their org" 
ON public.pluggy_connections 
FOR INSERT 
WITH CHECK (
  (company_id = ANY (get_user_organization_ids(auth.uid()))) 
  AND (auth.uid() = created_by)
);

CREATE POLICY "Users can update their pluggy connections" 
ON public.pluggy_connections 
FOR UPDATE 
USING (
  (company_id = ANY (get_user_organization_ids(auth.uid()))) 
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can delete pluggy connections" 
ON public.pluggy_connections 
FOR DELETE 
USING (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY (get_user_organization_ids(auth.uid())))) 
  OR (get_user_role_level(auth.uid()) >= 5)
);

-- Create trigger for updated_at
CREATE TRIGGER update_pluggy_connections_updated_at
BEFORE UPDATE ON public.pluggy_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();