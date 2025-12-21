-- Create the accountant_client_dashboard view for CFO partners
CREATE OR REPLACE VIEW public.accountant_client_dashboard AS
SELECT 
  cs.id as client_company_id,
  COALESCE(cs.nome_fantasia, cs.company_name) as client_name,
  cs.cfo_partner_id,
  COALESCE(COUNT(t.id), 0)::integer as total_transactions,
  COALESCE(SUM(CASE WHEN t.type = 'RECEIVABLE' THEN t.net_amount ELSE 0 END), 0) as total_receivables,
  COALESCE(SUM(CASE WHEN t.type = 'PAYABLE' THEN t.net_amount ELSE 0 END), 0) as total_payables,
  COALESCE(SUM(CASE WHEN t.type = 'RECEIVABLE' THEN t.net_amount ELSE -t.net_amount END), 0) as net_balance,
  COALESCE(SUM(CASE WHEN t.payment_date IS NULL THEN 1 ELSE 0 END), 0)::integer as pending_transactions,
  COALESCE(SUM(CASE WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE THEN 1 ELSE 0 END), 0)::integer as overdue_transactions,
  MAX(t.created_at) as last_transaction_date,
  CASE 
    WHEN COALESCE(SUM(CASE WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE - INTERVAL '30 days' THEN 1 ELSE 0 END), 0) > 0 THEN 'CRITICAL'
    WHEN COALESCE(SUM(CASE WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE THEN 1 ELSE 0 END), 0) > 0 THEN 'WARNING'
    ELSE 'HEALTHY'
  END as health_status
FROM public.company_settings cs
LEFT JOIN public.transactions t ON t.company_id = cs.id
WHERE cs.cfo_partner_id IS NOT NULL
GROUP BY cs.id, cs.company_name, cs.nome_fantasia, cs.cfo_partner_id;

-- Create a security definer function for safe access to the dashboard
CREATE OR REPLACE FUNCTION public.get_accountant_dashboard()
RETURNS TABLE (
  client_company_id uuid,
  client_name text,
  cfo_partner_id uuid,
  total_transactions integer,
  total_receivables numeric,
  total_payables numeric,
  net_balance numeric,
  pending_transactions integer,
  overdue_transactions integer,
  last_transaction_date timestamp with time zone,
  health_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.accountant_client_dashboard
  WHERE cfo_partner_id IN (
    SELECT id FROM public.cfo_partners WHERE user_id = auth.uid()
  )
  OR get_user_role_level(auth.uid()) >= 5
$$;