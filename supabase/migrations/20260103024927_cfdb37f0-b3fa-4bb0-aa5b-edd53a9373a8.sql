-- Tabela para pagamentos bancários
CREATE TABLE public.bank_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company_settings(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id),
  unique_id TEXT,
  account_hash TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  payment_form TEXT NOT NULL,
  status TEXT DEFAULT 'CREATED',
  description TEXT,
  barcode TEXT,
  due_date DATE,
  payment_date DATE,
  effective_date DATE,
  nominal_amount DECIMAL(15,2),
  discount_amount DECIMAL(15,2),
  fee_amount DECIMAL(15,2),
  interest_amount DECIMAL(15,2),
  fine_amount DECIMAL(15,2),
  amount DECIMAL(15,2) NOT NULL,
  beneficiary_name TEXT,
  beneficiary_cpf_cnpj TEXT,
  beneficiary_bank_code TEXT,
  beneficiary_agency TEXT,
  beneficiary_account TEXT,
  pix_key TEXT,
  pix_type TEXT,
  pix_txid TEXT,
  occurrences JSONB,
  remittance_linked JSONB,
  reconciliation_linked JSONB,
  tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para tributos (GARE, IPVA, DPVAT, DARF, GPS, FGTS)
CREATE TABLE public.tax_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company_settings(id) ON DELETE CASCADE,
  bank_payment_id UUID REFERENCES public.bank_payments(id) ON DELETE CASCADE,
  tax_type TEXT NOT NULL,
  revenue_code TEXT,
  contributor_document TEXT NOT NULL,
  contributor_name TEXT,
  reference_period TEXT,
  reporting_period TEXT,
  reference_number TEXT,
  state_registration TEXT,
  active_debit TEXT,
  installment TEXT,
  calculation_year TEXT,
  municipal_code TEXT,
  state TEXT,
  vehicle_plates TEXT,
  vehicle_renavam TEXT,
  payment_option INTEGER,
  crvl_withdrawal_option INTEGER,
  increase_amount DECIMAL(15,2),
  honorary_amount DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  other_amount DECIMAL(15,2),
  monetary_adjustment DECIMAL(15,2),
  fgts_identifier TEXT,
  seal_social_connectivity BIGINT,
  seal_social_connectivity_digit INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para remessas
CREATE TABLE public.payment_remessas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company_settings(id) ON DELETE CASCADE,
  account_hash TEXT NOT NULL,
  protocol TEXT,
  status TEXT DEFAULT 'PROCESSING',
  remessa_type TEXT DEFAULT 'DEFAULT',
  unique_ids TEXT[],
  file_content TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para retornos
CREATE TABLE public.payment_retornos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company_settings(id) ON DELETE CASCADE,
  account_hash TEXT NOT NULL,
  unique_id TEXT,
  status TEXT DEFAULT 'RECEIVED',
  file_content TEXT,
  processed_payments JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para certificados digitais de pagamento
CREATE TABLE public.payment_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company_settings(id) ON DELETE CASCADE,
  account_hash TEXT NOT NULL,
  common_name TEXT,
  expiration_date TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para webhooks de pagamento
CREATE TABLE public.payment_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  unique_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.bank_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_remessas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_retornos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_payments
CREATE POLICY "Users can view org bank payments" ON public.bank_payments
  FOR SELECT USING (
    (company_id = ANY (get_user_organization_ids(auth.uid()))) 
    OR (get_user_role_level(auth.uid()) >= 5)
  );

CREATE POLICY "FINANCEIRO can create org bank payments" ON public.bank_payments
  FOR INSERT WITH CHECK (
    ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
    OR (get_user_role_level(auth.uid()) >= 5)
  );

CREATE POLICY "FINANCEIRO can update org bank payments" ON public.bank_payments
  FOR UPDATE USING (
    ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
    OR (get_user_role_level(auth.uid()) >= 5)
  );

CREATE POLICY "FINANCEIRO can delete org bank payments" ON public.bank_payments
  FOR DELETE USING (
    ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
    OR (get_user_role_level(auth.uid()) >= 5)
  );

-- RLS Policies for tax_payments
CREATE POLICY "Users can view org tax payments" ON public.tax_payments
  FOR SELECT USING (
    (company_id = ANY (get_user_organization_ids(auth.uid()))) 
    OR (get_user_role_level(auth.uid()) >= 5)
  );

CREATE POLICY "FINANCEIRO can create org tax payments" ON public.tax_payments
  FOR INSERT WITH CHECK (
    ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
    OR (get_user_role_level(auth.uid()) >= 5)
  );

CREATE POLICY "FINANCEIRO can update org tax payments" ON public.tax_payments
  FOR UPDATE USING (
    ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
    OR (get_user_role_level(auth.uid()) >= 5)
  );

CREATE POLICY "FINANCEIRO can delete org tax payments" ON public.tax_payments
  FOR DELETE USING (
    ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
    OR (get_user_role_level(auth.uid()) >= 5)
  );

-- RLS Policies for payment_remessas
CREATE POLICY "Users can view org payment remessas" ON public.payment_remessas
  FOR SELECT USING (
    (company_id = ANY (get_user_organization_ids(auth.uid()))) 
    OR (get_user_role_level(auth.uid()) >= 5)
  );

CREATE POLICY "FINANCEIRO can create org payment remessas" ON public.payment_remessas
  FOR INSERT WITH CHECK (
    ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
    OR (get_user_role_level(auth.uid()) >= 5)
  );

CREATE POLICY "FINANCEIRO can update org payment remessas" ON public.payment_remessas
  FOR UPDATE USING (
    ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
    OR (get_user_role_level(auth.uid()) >= 5)
  );

-- RLS Policies for payment_retornos
CREATE POLICY "Users can view org payment retornos" ON public.payment_retornos
  FOR SELECT USING (
    (company_id = ANY (get_user_organization_ids(auth.uid()))) 
    OR (get_user_role_level(auth.uid()) >= 5)
  );

CREATE POLICY "FINANCEIRO can create org payment retornos" ON public.payment_retornos
  FOR INSERT WITH CHECK (
    ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
    OR (get_user_role_level(auth.uid()) >= 5)
  );

-- RLS Policies for payment_certificates
CREATE POLICY "Users can view org payment certificates" ON public.payment_certificates
  FOR SELECT USING (
    (company_id = ANY (get_user_organization_ids(auth.uid()))) 
    OR (get_user_role_level(auth.uid()) >= 5)
  );

CREATE POLICY "ADMIN can manage org payment certificates" ON public.payment_certificates
  FOR ALL USING (
    ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
    OR (get_user_role_level(auth.uid()) >= 5)
  );

-- RLS Policies for payment_webhook_logs
CREATE POLICY "System can insert payment webhook logs" ON public.payment_webhook_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ADMIN can view payment webhook logs" ON public.payment_webhook_logs
  FOR SELECT USING (get_user_role_level(auth.uid()) >= 4);

-- Indexes for better query performance
CREATE INDEX idx_bank_payments_company_id ON public.bank_payments(company_id);
CREATE INDEX idx_bank_payments_status ON public.bank_payments(status);
CREATE INDEX idx_bank_payments_payment_date ON public.bank_payments(payment_date);
CREATE INDEX idx_bank_payments_unique_id ON public.bank_payments(unique_id);
CREATE INDEX idx_tax_payments_company_id ON public.tax_payments(company_id);
CREATE INDEX idx_tax_payments_tax_type ON public.tax_payments(tax_type);
CREATE INDEX idx_payment_remessas_company_id ON public.payment_remessas(company_id);
CREATE INDEX idx_payment_retornos_company_id ON public.payment_retornos(company_id);

-- Trigger for updated_at on bank_payments
CREATE TRIGGER update_bank_payments_updated_at
  BEFORE UPDATE ON public.bank_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on payment_certificates
CREATE TRIGGER update_payment_certificates_updated_at
  BEFORE UPDATE ON public.payment_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();