-- Add UNIQUE constraint on external_id for ON CONFLICT to work
ALTER TABLE bank_statements ADD CONSTRAINT bank_statements_external_id_key UNIQUE (external_id);

-- Drop old CHECK constraint on sync_protocols.status if exists
ALTER TABLE sync_protocols DROP CONSTRAINT IF EXISTS sync_protocols_status_check;

-- Create new CHECK constraint with all possible status values from the provider
ALTER TABLE sync_protocols ADD CONSTRAINT sync_protocols_status_check 
  CHECK (status IN ('PROCESSING', 'SUCCESS', 'COMPLETED', 'CONCLUDED', 'FAILED', 'ERROR', 'CANCELLED', 'PENDING'));