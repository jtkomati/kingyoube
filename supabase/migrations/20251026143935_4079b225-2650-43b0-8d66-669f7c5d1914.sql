-- Tabela de contratos (para clientes e fornecedores)
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Relacionamento
  entity_type TEXT CHECK (entity_type IN ('customer', 'supplier')) NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  
  -- Dados do contrato
  contract_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  value NUMERIC,
  status TEXT CHECK (status IN ('draft', 'active', 'suspended', 'cancelled', 'expired')) DEFAULT 'draft',
  
  -- Documentos
  file_url TEXT, -- PDF do contrato
  file_name TEXT,
  file_size INTEGER,
  
  -- Análise por IA
  ai_analysis JSONB, -- Resultado da análise
  ai_analyzed_at TIMESTAMPTZ,
  compliance_score INTEGER, -- 0-100
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  
  -- Notificações
  renewal_alert_days INTEGER DEFAULT 30, -- Avisar X dias antes do vencimento
  auto_renew BOOLEAN DEFAULT false,
  
  CONSTRAINT check_entity_reference CHECK (
    (entity_type = 'customer' AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
    (entity_type = 'supplier' AND supplier_id IS NOT NULL AND customer_id IS NULL)
  )
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view contracts"
ON public.contracts
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "FINANCEIRO and above can create contracts"
ON public.contracts
FOR INSERT
WITH CHECK (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "FINANCEIRO and above can update contracts"
ON public.contracts
FOR UPDATE
USING (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "ADMIN and above can delete contracts"
ON public.contracts
FOR DELETE
USING (get_user_role_level(auth.uid()) >= 4);

CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_contracts_customer_id ON public.contracts(customer_id);
CREATE INDEX idx_contracts_supplier_id ON public.contracts(supplier_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contracts_end_date ON public.contracts(end_date);

-- Tabela de cláusulas analisadas (detalhamento)
CREATE TABLE IF NOT EXISTS public.contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  clause_number TEXT,
  clause_title TEXT,
  clause_text TEXT NOT NULL,
  
  -- Análise
  compliance_status TEXT CHECK (compliance_status IN ('compliant', 'non_compliant', 'attention')) NOT NULL,
  risk_category TEXT, -- 'LGPD', 'Financial', 'Liability', 'Abusive', etc.
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  ai_explanation TEXT NOT NULL,
  recommendations TEXT
);

ALTER TABLE public.contract_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view contract clauses"
ON public.contract_clauses
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage contract clauses"
ON public.contract_clauses
FOR ALL
USING (true);

-- Storage bucket para contratos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS para contratos storage
CREATE POLICY "FINANCEIRO can view contracts"
ON storage.objects FOR SELECT
USING (bucket_id = 'contracts' AND get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "FINANCEIRO can upload contracts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contracts' AND get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "ADMIN can delete contracts"
ON storage.objects FOR DELETE
USING (bucket_id = 'contracts' AND get_user_role_level(auth.uid()) >= 4);