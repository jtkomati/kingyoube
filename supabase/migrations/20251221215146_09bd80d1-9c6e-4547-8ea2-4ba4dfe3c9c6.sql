-- 1. Expand bank_accounts with new fields for TecnoSpeed
ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_hash text,
ADD COLUMN IF NOT EXISTS tecnospeed_item_id text,
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BRL';

-- 2. Expand bank_statements with external_id and categorization fields
ALTER TABLE bank_statements
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS type text CHECK (type IS NULL OR type IN ('credit', 'debit')),
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS category_confidence numeric,
ADD COLUMN IF NOT EXISTS linked_transaction_id uuid REFERENCES transactions(id);

-- Create unique index on external_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS bank_statements_external_id_unique 
ON bank_statements (external_id) 
WHERE external_id IS NOT NULL;

-- 3. Create sync_protocols table for tracking synchronization
CREATE TABLE IF NOT EXISTS sync_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE CASCADE,
  protocol_number text,
  status text DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  records_imported integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on sync_protocols
ALTER TABLE sync_protocols ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_protocols
CREATE POLICY "FINANCEIRO and above can view sync protocols" 
ON sync_protocols 
FOR SELECT 
USING (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "FINANCEIRO and above can create sync protocols" 
ON sync_protocols 
FOR INSERT 
WITH CHECK (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "System can update sync protocols" 
ON sync_protocols 
FOR UPDATE 
USING (true);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_sync_protocols_bank_account 
ON sync_protocols (bank_account_id);

CREATE INDEX IF NOT EXISTS idx_sync_protocols_status 
ON sync_protocols (status);

CREATE INDEX IF NOT EXISTS idx_bank_statements_external_id 
ON bank_statements (external_id);

CREATE INDEX IF NOT EXISTS idx_bank_statements_linked_transaction 
ON bank_statements (linked_transaction_id);