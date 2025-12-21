-- 1. Adicionar coluna updated_by em transactions para auditoria completa
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- 2. Adicionar coluna updated_at em bank_statements (faltava)
ALTER TABLE public.bank_statements ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 3. Criar função de atualização automática de updated_at (se não existir)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para bank_statements
DROP TRIGGER IF EXISTS set_bank_statements_updated_at ON public.bank_statements;
CREATE TRIGGER set_bank_statements_updated_at
  BEFORE UPDATE ON public.bank_statements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Criar trigger para transactions (se não existir)
DROP TRIGGER IF EXISTS set_transactions_updated_at ON public.transactions;
CREATE TRIGGER set_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Índice para payment_date em transactions (busca frequente)
CREATE INDEX IF NOT EXISTS idx_transactions_payment_date ON public.transactions(payment_date);

-- 7. Índice para company_id em transactions (multi-tenancy performance)
CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON public.transactions(company_id);

-- 8. Índice para due_date em transactions (ordenação comum)
CREATE INDEX IF NOT EXISTS idx_transactions_due_date ON public.transactions(due_date);

-- 9. Índice composto para queries de listagem otimizadas
CREATE INDEX IF NOT EXISTS idx_transactions_company_due_date ON public.transactions(company_id, due_date DESC);

-- 10. Função de trigger de auditoria automática para tabelas críticas
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
BEGIN
  -- Buscar role do usuário atual
  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Inserir log de auditoria
  INSERT INTO public.audit_logs (user_id, user_role, action, details)
  VALUES (
    auth.uid(),
    COALESCE(v_role, 'VIEWER')::app_role,
    TG_OP || '_' || TG_TABLE_NAME,
    CASE 
      WHEN TG_OP = 'DELETE' THEN jsonb_build_object('old', row_to_json(OLD))::text
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))::text
      ELSE jsonb_build_object('new', row_to_json(NEW))::text
    END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 11. Aplicar trigger de auditoria em transactions
DROP TRIGGER IF EXISTS audit_transactions ON public.transactions;
CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_function();

-- 12. Aplicar trigger de auditoria em bank_statements
DROP TRIGGER IF EXISTS audit_bank_statements ON public.bank_statements;
CREATE TRIGGER audit_bank_statements
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_statements
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_function();