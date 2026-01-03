-- Disable user triggers on the transactions table
ALTER TABLE transactions DISABLE TRIGGER USER;

-- Delete ALL transactions (all are demo/fictitious data)
DELETE FROM transactions;

-- Re-enable user triggers
ALTER TABLE transactions ENABLE TRIGGER USER;