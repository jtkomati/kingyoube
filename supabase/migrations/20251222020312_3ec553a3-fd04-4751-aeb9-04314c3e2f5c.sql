-- Fix: accountant_client_dashboard view should use SECURITY INVOKER
-- This ensures the view respects RLS policies of the querying user

DROP VIEW IF EXISTS public.accountant_client_dashboard;

CREATE VIEW public.accountant_client_dashboard 
WITH (security_invoker = true) AS
SELECT 
  cs.id AS client_company_id,
  cs.company_name AS client_name,
  cs.cfo_partner_id,
  COUNT(t.id)::integer AS total_transactions,
  COALESCE(SUM(CASE WHEN t.type = 'RECEIVABLE' THEN t.net_amount ELSE 0 END), 0) AS total_receivables,
  COALESCE(SUM(CASE WHEN t.type = 'PAYABLE' THEN t.net_amount ELSE 0 END), 0) AS total_payables,
  COALESCE(SUM(CASE WHEN t.type = 'RECEIVABLE' THEN t.net_amount ELSE -t.net_amount END), 0) AS net_balance,
  COUNT(CASE WHEN t.payment_date IS NULL AND t.due_date >= CURRENT_DATE THEN 1 END)::integer AS pending_transactions,
  COUNT(CASE WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE THEN 1 END)::integer AS overdue_transactions,
  MAX(t.created_at) AS last_transaction_date,
  CASE 
    WHEN COUNT(CASE WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE THEN 1 END) > 5 THEN 'critical'
    WHEN COUNT(CASE WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE THEN 1 END) > 0 THEN 'warning'
    ELSE 'healthy'
  END AS health_status
FROM public.company_settings cs
LEFT JOIN public.transactions t ON t.company_id = cs.id
WHERE cs.cfo_partner_id IS NOT NULL
GROUP BY cs.id, cs.company_name, cs.cfo_partner_id;