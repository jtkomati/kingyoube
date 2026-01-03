-- Add balance validation columns to sync_protocols
ALTER TABLE sync_protocols ADD COLUMN IF NOT EXISTS opening_balance numeric;
ALTER TABLE sync_protocols ADD COLUMN IF NOT EXISTS closing_balance numeric;
ALTER TABLE sync_protocols ADD COLUMN IF NOT EXISTS balance_validated boolean DEFAULT false;
ALTER TABLE sync_protocols ADD COLUMN IF NOT EXISTS balance_difference numeric;

-- Add comment for documentation
COMMENT ON COLUMN sync_protocols.opening_balance IS 'Opening balance reported by the bank at start of period';
COMMENT ON COLUMN sync_protocols.closing_balance IS 'Closing balance reported by the bank at end of period';
COMMENT ON COLUMN sync_protocols.balance_validated IS 'Whether calculated balance matches bank closing balance';
COMMENT ON COLUMN sync_protocols.balance_difference IS 'Difference between calculated and bank closing balance';