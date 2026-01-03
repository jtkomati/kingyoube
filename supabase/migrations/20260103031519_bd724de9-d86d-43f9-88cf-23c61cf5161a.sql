-- Add dda_activated column to bank_accounts
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS dda_activated BOOLEAN DEFAULT false;

-- Create dda_boletos table
CREATE TABLE public.dda_boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company_settings(id) ON DELETE CASCADE,
  account_hash TEXT NOT NULL,
  unique_id TEXT UNIQUE,
  
  -- Dados do Boleto
  barcode TEXT,
  digitable_line TEXT,
  beneficiary_name TEXT,
  beneficiary_cpf_cnpj TEXT,
  beneficiary_bank_code TEXT,
  beneficiary_bank_name TEXT,
  
  -- Valores
  nominal_amount DECIMAL(15,2),
  discount_amount DECIMAL(15,2) DEFAULT 0,
  interest_amount DECIMAL(15,2) DEFAULT 0,
  fine_amount DECIMAL(15,2) DEFAULT 0,
  final_amount DECIMAL(15,2),
  
  -- Datas
  issue_date DATE,
  due_date DATE,
  
  -- Status: PENDING, PAID, IGNORED, EXPIRED
  status TEXT DEFAULT 'PENDING',
  dda_file_id TEXT,
  processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_id UUID REFERENCES public.bank_payments(id),
  
  -- Metadados
  our_number TEXT,
  document_number TEXT,
  description TEXT,
  raw_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create dda_sync_logs table
CREATE TABLE public.dda_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company_settings(id) ON DELETE CASCADE,
  account_hash TEXT NOT NULL,
  sync_type TEXT DEFAULT 'MANUAL', -- 'AUTOMATIC' | 'MANUAL'
  boletos_found INTEGER DEFAULT 0,
  boletos_new INTEGER DEFAULT 0,
  status TEXT DEFAULT 'PROCESSING', -- 'PROCESSING' | 'SUCCESS' | 'ERROR'
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS on dda_boletos
ALTER TABLE public.dda_boletos ENABLE ROW LEVEL SECURITY;

-- RLS policies for dda_boletos
CREATE POLICY "Users can view org dda_boletos"
ON public.dda_boletos FOR SELECT
USING (
  company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "FINANCEIRO can create org dda_boletos"
ON public.dda_boletos FOR INSERT
WITH CHECK (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "FINANCEIRO can update org dda_boletos"
ON public.dda_boletos FOR UPDATE
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "FINANCEIRO can delete org dda_boletos"
ON public.dda_boletos FOR DELETE
USING (
  (get_user_role_level(auth.uid()) >= 3 AND company_id = ANY(get_user_organization_ids(auth.uid())))
  OR get_user_role_level(auth.uid()) >= 5
);

-- Enable RLS on dda_sync_logs
ALTER TABLE public.dda_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for dda_sync_logs
CREATE POLICY "Users can view org dda_sync_logs"
ON public.dda_sync_logs FOR SELECT
USING (
  company_id = ANY(get_user_organization_ids(auth.uid()))
  OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "System can insert dda_sync_logs"
ON public.dda_sync_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update dda_sync_logs"
ON public.dda_sync_logs FOR UPDATE
USING (true);

-- Create indexes for performance
CREATE INDEX idx_dda_boletos_company_id ON public.dda_boletos(company_id);
CREATE INDEX idx_dda_boletos_status ON public.dda_boletos(status);
CREATE INDEX idx_dda_boletos_due_date ON public.dda_boletos(due_date);
CREATE INDEX idx_dda_boletos_account_hash ON public.dda_boletos(account_hash);
CREATE INDEX idx_dda_sync_logs_company_id ON public.dda_sync_logs(company_id);

-- Add updated_at trigger for dda_boletos
CREATE TRIGGER update_dda_boletos_updated_at
BEFORE UPDATE ON public.dda_boletos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();