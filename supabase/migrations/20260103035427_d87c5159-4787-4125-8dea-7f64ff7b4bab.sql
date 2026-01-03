-- Fix accountant_client_dashboard view security
-- Revoke direct SELECT access to the view from authenticated users
-- Force usage of the properly secured get_accountant_dashboard() function

-- Revoke direct access to the view
REVOKE SELECT ON public.accountant_client_dashboard FROM authenticated;
REVOKE SELECT ON public.accountant_client_dashboard FROM anon;

-- Ensure the secured function is accessible
GRANT EXECUTE ON FUNCTION public.get_accountant_dashboard() TO authenticated;

-- Recreate view with SECURITY INVOKER for defense in depth
CREATE OR REPLACE VIEW public.accountant_client_dashboard 
WITH (security_invoker = true) AS
SELECT cs.id AS client_company_id,
    cs.company_name AS client_name,
    cs.cfo_partner_id,
    count(t.id)::integer AS total_transactions,
    COALESCE(sum(
        CASE
            WHEN t.type = 'RECEIVABLE'::transaction_type THEN t.net_amount
            ELSE 0::numeric
        END), 0::numeric) AS total_receivables,
    COALESCE(sum(
        CASE
            WHEN t.type = 'PAYABLE'::transaction_type THEN t.net_amount
            ELSE 0::numeric
        END), 0::numeric) AS total_payables,
    COALESCE(sum(
        CASE
            WHEN t.type = 'RECEIVABLE'::transaction_type THEN t.net_amount
            ELSE - t.net_amount
        END), 0::numeric) AS net_balance,
    count(
        CASE
            WHEN t.payment_date IS NULL AND t.due_date >= CURRENT_DATE THEN 1
            ELSE NULL::integer
        END)::integer AS pending_transactions,
    count(
        CASE
            WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE THEN 1
            ELSE NULL::integer
        END)::integer AS overdue_transactions,
    max(t.created_at) AS last_transaction_date,
        CASE
            WHEN count(
            CASE
                WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE THEN 1
                ELSE NULL::integer
            END) > 5 THEN 'critical'::text
            WHEN count(
            CASE
                WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE THEN 1
                ELSE NULL::integer
            END) > 0 THEN 'warning'::text
            ELSE 'healthy'::text
        END AS health_status
   FROM public.company_settings cs
     LEFT JOIN public.transactions t ON t.company_id = cs.id
  WHERE cs.cfo_partner_id IS NOT NULL
  GROUP BY cs.id, cs.company_name, cs.cfo_partner_id;