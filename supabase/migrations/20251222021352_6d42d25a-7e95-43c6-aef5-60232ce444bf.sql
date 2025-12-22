-- =====================================================
-- PHASE 2: PERFORMANCE OPTIMIZATION
-- Composite Indexes + Materialized View for CFO Dashboard
-- =====================================================

-- 1. COMPOSITE INDEXES FOR TRANSACTIONS TABLE
-- Index for common query patterns: company + type + date
CREATE INDEX IF NOT EXISTS idx_transactions_company_type_due_date 
ON public.transactions(company_id, type, due_date DESC);

-- Index for payment status queries
CREATE INDEX IF NOT EXISTS idx_transactions_company_payment_status 
ON public.transactions(company_id, payment_date, due_date)
WHERE payment_date IS NULL;

-- 2. COMPOSITE INDEXES FOR BANK_STATEMENTS TABLE
-- Index for bank account queries with date ordering
CREATE INDEX IF NOT EXISTS idx_bank_statements_account_date 
ON public.bank_statements(bank_account_id, statement_date DESC);

-- Index for reconciliation status queries
CREATE INDEX IF NOT EXISTS idx_bank_statements_reconciliation 
ON public.bank_statements(bank_account_id, reconciliation_status, statement_date);

-- 3. COMPOSITE INDEXES FOR CFO_ALERTS TABLE
-- Index for partner alerts with severity and status
CREATE INDEX IF NOT EXISTS idx_cfo_alerts_partner_severity 
ON public.cfo_alerts(cfo_partner_id, severity, created_at DESC);

-- Index for unread/unresolved alerts
CREATE INDEX IF NOT EXISTS idx_cfo_alerts_partner_unread 
ON public.cfo_alerts(cfo_partner_id, is_read, resolved)
WHERE is_read = false OR resolved = false;

-- 4. COMPOSITE INDEXES FOR AUDIT_LOGS TABLE
-- Index for user audit trail
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_date 
ON public.audit_logs(user_id, action, created_at DESC);

-- Index for organization audit trail
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_date 
ON public.audit_logs(organization_id, created_at DESC)
WHERE organization_id IS NOT NULL;

-- 5. COMPOSITE INDEXES FOR CUSTOMERS TABLE
-- Index for organization customer search
CREATE INDEX IF NOT EXISTS idx_customers_company_name 
ON public.customers(company_id, company_name, first_name, last_name);

-- 6. COMPOSITE INDEXES FOR SUPPLIERS TABLE
-- Index for organization supplier search
CREATE INDEX IF NOT EXISTS idx_suppliers_company_name 
ON public.suppliers(company_id, company_name, first_name, last_name);

-- 7. MATERIALIZED VIEW FOR CFO CLIENT SUMMARY
-- Aggregated metrics for CFO dashboard - prevents repeated expensive calculations
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_cfo_client_summary AS
SELECT 
    cs.id as company_id,
    cs.company_name,
    cs.cfo_partner_id,
    COALESCE(COUNT(DISTINCT t.id), 0)::integer as total_transactions,
    COALESCE(SUM(CASE WHEN t.type = 'RECEIVABLE' THEN t.net_amount ELSE 0 END), 0) as total_receivables,
    COALESCE(SUM(CASE WHEN t.type = 'PAYABLE' THEN t.net_amount ELSE 0 END), 0) as total_payables,
    COALESCE(SUM(CASE WHEN t.type = 'RECEIVABLE' THEN t.net_amount ELSE -t.net_amount END), 0) as net_balance,
    COALESCE(COUNT(CASE WHEN t.payment_date IS NULL AND t.due_date >= CURRENT_DATE THEN 1 END), 0)::integer as pending_transactions,
    COALESCE(COUNT(CASE WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE THEN 1 END), 0)::integer as overdue_transactions,
    MAX(t.created_at) as last_transaction_date,
    CASE 
        WHEN COUNT(CASE WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) > 0 THEN 'CRITICAL'
        WHEN COUNT(CASE WHEN t.payment_date IS NULL AND t.due_date < CURRENT_DATE THEN 1 END) > 5 THEN 'WARNING'
        ELSE 'HEALTHY'
    END as health_status
FROM public.company_settings cs
LEFT JOIN public.transactions t ON t.company_id = cs.id
WHERE cs.cfo_partner_id IS NOT NULL
GROUP BY cs.id, cs.company_name, cs.cfo_partner_id;

-- Unique index on materialized view for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_cfo_client_summary_company_id 
ON mv_cfo_client_summary(company_id);

-- Index for cfo_partner_id lookups
CREATE INDEX IF NOT EXISTS idx_mv_cfo_client_summary_cfo_partner 
ON mv_cfo_client_summary(cfo_partner_id);

-- 8. FUNCTION TO REFRESH MATERIALIZED VIEW
CREATE OR REPLACE FUNCTION refresh_cfo_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cfo_client_summary;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_cfo_summary() TO authenticated;

-- 9. RLS FOR MATERIALIZED VIEW ACCESS (via function)
CREATE OR REPLACE FUNCTION get_cfo_client_summary(_cfo_partner_id uuid)
RETURNS TABLE (
    company_id uuid,
    company_name text,
    cfo_partner_id uuid,
    total_transactions integer,
    total_receivables numeric,
    total_payables numeric,
    net_balance numeric,
    pending_transactions integer,
    overdue_transactions integer,
    last_transaction_date timestamptz,
    health_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM mv_cfo_client_summary
    WHERE mv_cfo_client_summary.cfo_partner_id = _cfo_partner_id
    OR EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'SUPERADMIN'
    );
$$;