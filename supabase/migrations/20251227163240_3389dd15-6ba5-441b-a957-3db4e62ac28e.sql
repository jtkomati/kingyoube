-- =====================================================
-- FASE 1: SEGURANÇA - Revogar Acesso à Materialized View
-- =====================================================

-- Revogar acesso direto à materialized view sensível
-- Usuários devem usar a função get_cfo_client_summary() que já tem RLS
REVOKE ALL ON mv_cfo_client_summary FROM anon;
REVOKE ALL ON mv_cfo_client_summary FROM authenticated;

-- Garantir que a função de acesso seguro existe e está acessível
GRANT EXECUTE ON FUNCTION get_cfo_client_summary(uuid) TO authenticated;

-- Também proteger a view accountant_client_dashboard
REVOKE ALL ON accountant_client_dashboard FROM anon;

-- Garantir que a função segura de dashboard está acessível
GRANT EXECUTE ON FUNCTION get_accountant_dashboard() TO authenticated;