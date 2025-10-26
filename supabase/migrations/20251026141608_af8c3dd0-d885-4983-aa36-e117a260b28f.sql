-- FASE 1: Adequação de Transações para Emissão Fiscal
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS invoice_key TEXT,
ADD COLUMN IF NOT EXISTS invoice_status TEXT CHECK (invoice_status IN ('pending', 'issued', 'cancelled', 'rejected')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS invoice_xml_url TEXT,
ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS tax_regime TEXT CHECK (tax_regime IN ('SIMPLES', 'LUCRO_PRESUMIDO', 'LUCRO_REAL')) DEFAULT 'SIMPLES',
ADD COLUMN IF NOT EXISTS iss_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cofins_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pis_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS irpj_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS csll_rate NUMERIC(5,2) DEFAULT 0;

-- Tabela de configurações da empresa
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Dados da empresa
  company_name TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  municipal_inscription TEXT,
  state_inscription TEXT,
  address TEXT,
  city_code TEXT, -- código IBGE
  
  -- Configurações fiscais
  tax_regime TEXT CHECK (tax_regime IN ('SIMPLES', 'LUCRO_PRESUMIDO', 'LUCRO_REAL')) DEFAULT 'SIMPLES',
  
  -- Credenciais NFS-e (criptografadas)
  nfse_login TEXT,
  nfse_password TEXT,
  nfse_environment TEXT CHECK (nfse_environment IN ('sandbox', 'production')) DEFAULT 'production',
  
  -- Configurações de email
  notification_email TEXT
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMIN and above can manage company settings"
ON public.company_settings
FOR ALL
USING (get_user_role_level(auth.uid()) >= 4);

-- Tabela de fornecedores (suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  person_type TEXT CHECK (person_type IN ('PF', 'PJ')) NOT NULL,
  
  -- Pessoa Física
  first_name TEXT,
  last_name TEXT,
  cpf TEXT,
  
  -- Pessoa Jurídica
  company_name TEXT,
  cnpj TEXT,
  
  -- Contato
  email TEXT,
  phone TEXT,
  address TEXT
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view suppliers"
ON public.suppliers
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "FINANCEIRO and above can create suppliers"
ON public.suppliers
FOR INSERT
WITH CHECK (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "FINANCEIRO and above can update suppliers"
ON public.suppliers
FOR UPDATE
USING (get_user_role_level(auth.uid()) >= 3);

CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de contas bancárias
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  company_id UUID REFERENCES public.company_settings(id),
  bank_name TEXT NOT NULL, -- 'BRADESCO', 'BANK_OF_AMERICA', etc
  account_number TEXT,
  agency TEXT,
  account_type TEXT CHECK (account_type IN ('checking', 'savings')) DEFAULT 'checking',
  
  -- Credenciais Open Finance/Banking (criptografadas)
  client_id TEXT,
  client_secret TEXT,
  certificate_path TEXT, -- path no storage
  api_environment TEXT CHECK (api_environment IN ('sandbox', 'production')) DEFAULT 'production',
  
  -- OAuth tokens
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  last_sync_at TIMESTAMPTZ,
  auto_sync_enabled BOOLEAN DEFAULT true
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMIN and above can manage bank accounts"
ON public.bank_accounts
FOR ALL
USING (get_user_role_level(auth.uid()) >= 4);

-- Tabela de extratos bancários
CREATE TABLE IF NOT EXISTS public.bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL, -- pode ser positivo ou negativo
  balance NUMERIC,
  
  transaction_id UUID REFERENCES public.transactions(id), -- NULL se não conciliado
  reconciliation_status TEXT CHECK (reconciliation_status IN ('pending', 'matched', 'ignored')) DEFAULT 'pending',
  
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FINANCEIRO and above can manage bank statements"
ON public.bank_statements
FOR ALL
USING (get_user_role_level(auth.uid()) >= 3);

-- Tabela de regras de conciliação
CREATE TABLE IF NOT EXISTS public.reconciliation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  name TEXT NOT NULL,
  pattern_type TEXT CHECK (pattern_type IN ('keyword', 'amount', 'customer_name', 'amount_range')) NOT NULL,
  pattern_value TEXT NOT NULL,
  suggested_category_id UUID REFERENCES public.categories(id),
  auto_match BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true
);

ALTER TABLE public.reconciliation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FINANCEIRO and above can manage reconciliation rules"
ON public.reconciliation_rules
FOR ALL
USING (get_user_role_level(auth.uid()) >= 3);

-- Tabela de integração SCI
CREATE TABLE IF NOT EXISTS public.sci_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  company_id UUID REFERENCES public.company_settings(id),
  sci_company_code TEXT NOT NULL,
  sci_api_url TEXT,
  sci_username TEXT,
  sci_password TEXT, -- criptografado
  
  sync_customers BOOLEAN DEFAULT true,
  sync_suppliers BOOLEAN DEFAULT true,
  sync_transactions BOOLEAN DEFAULT true,
  sync_invoices BOOLEAN DEFAULT true,
  
  last_sync_at TIMESTAMPTZ,
  auto_sync_enabled BOOLEAN DEFAULT true
);

ALTER TABLE public.sci_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMIN and above can manage SCI integrations"
ON public.sci_integrations
FOR ALL
USING (get_user_role_level(auth.uid()) >= 4);

-- Tabela de logs de sincronização
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  integration_type TEXT NOT NULL, -- 'BRADESCO', 'BANK_OF_AMERICA', 'SCI', 'FOCUSNFE'
  integration_id UUID,
  status TEXT CHECK (status IN ('success', 'error', 'partial')) NOT NULL,
  records_processed INTEGER DEFAULT 0,
  error_details TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMIN and above can view sync logs"
ON public.sync_logs
FOR SELECT
USING (get_user_role_level(auth.uid()) >= 4);

CREATE POLICY "System can create sync logs"
ON public.sync_logs
FOR INSERT
WITH CHECK (true);

-- Storage buckets para invoices
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices-xml', 'invoices-xml', false),
       ('invoices-pdf', 'invoices-pdf', false),
       ('bank-certificates', 'bank-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- RLS para invoices storage
CREATE POLICY "FISCAL and above can view invoice XML"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices-xml' AND get_user_role_level(auth.uid()) >= 2);

CREATE POLICY "System can upload invoice XML"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoices-xml');

CREATE POLICY "FISCAL and above can view invoice PDF"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices-pdf' AND get_user_role_level(auth.uid()) >= 2);

CREATE POLICY "System can upload invoice PDF"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoices-pdf');

CREATE POLICY "ADMIN can manage bank certificates"
ON storage.objects FOR ALL
USING (bucket_id = 'bank-certificates' AND get_user_role_level(auth.uid()) >= 4);