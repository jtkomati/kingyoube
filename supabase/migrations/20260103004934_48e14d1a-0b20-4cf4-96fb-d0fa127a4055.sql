-- Step 1: Remove duplicate entries keeping the most recent record
DELETE FROM bank_statements a
USING bank_statements b
WHERE a.id < b.id
  AND a.bank_account_id = b.bank_account_id
  AND a.statement_date = b.statement_date
  AND a.amount = b.amount
  AND a.description = b.description;

-- Step 2: Drop the external_id unique constraint (we'll use composite key instead)
ALTER TABLE bank_statements DROP CONSTRAINT IF EXISTS bank_statements_external_id_key;

-- Step 3: Add composite unique constraint for business-level deduplication
ALTER TABLE bank_statements ADD CONSTRAINT bank_statements_unique_transaction 
  UNIQUE (bank_account_id, statement_date, amount, description);