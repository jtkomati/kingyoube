-- Adicionar campos para Open Finance na tabela bank_accounts existente
ALTER TABLE public.bank_accounts 
ADD COLUMN IF NOT EXISTS open_finance_consent_id TEXT,
ADD COLUMN IF NOT EXISTS open_finance_status TEXT DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS permissions_granted TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS consent_expires_at TIMESTAMP WITH TIME ZONE;

-- Criar tabela para transações do Open Finance
CREATE TABLE IF NOT EXISTS public.open_finance_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL, -- 'ENTRADA' ou 'SAIDA'
  description TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'PENDENTE', -- 'PENDENTE' ou 'CONCILIADO'
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bank_account_id, transaction_id)
);

-- Enable RLS
ALTER TABLE public.open_finance_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para open_finance_transactions
CREATE POLICY "Users can view their company transactions"
  ON public.open_finance_transactions FOR SELECT
  USING (
    bank_account_id IN (
      SELECT id FROM public.bank_accounts 
      WHERE company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "FINANCEIRO can manage company transactions"
  ON public.open_finance_transactions FOR ALL
  USING (
    get_user_role_level(auth.uid()) >= 3 AND
    bank_account_id IN (
      SELECT id FROM public.bank_accounts 
      WHERE company_id = get_user_company_id(auth.uid())
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_open_finance_transactions_updated_at
  BEFORE UPDATE ON public.open_finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();