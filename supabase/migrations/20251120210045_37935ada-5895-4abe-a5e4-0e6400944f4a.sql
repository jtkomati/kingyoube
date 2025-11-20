-- Criar tabela para configurações fiscais da Reforma Tributária
CREATE TABLE public.config_fiscal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.company_settings(id),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  webhook_url TEXT,
  api_status TEXT DEFAULT 'offline',
  last_connection_test TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para solicitações de apuração
CREATE TABLE public.solicitacoes_apuracao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.company_settings(id),
  periodo_apuracao TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'DEBITO' ou 'CREDITO'
  status TEXT NOT NULL DEFAULT 'PROCESSANDO', -- 'PROCESSANDO', 'CONCLUIDO', 'ERRO'
  resultado_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.config_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_apuracao ENABLE ROW LEVEL SECURITY;

-- Políticas para config_fiscal
CREATE POLICY "Users can view their company fiscal config"
  ON public.config_fiscal FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "FINANCEIRO can manage company fiscal config"
  ON public.config_fiscal FOR ALL
  USING (get_user_role_level(auth.uid()) >= 3 AND company_id = get_user_company_id(auth.uid()));

-- Políticas para solicitacoes_apuracao
CREATE POLICY "Users can view their company apuração requests"
  ON public.solicitacoes_apuracao FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "FINANCEIRO can manage company apuração requests"
  ON public.solicitacoes_apuracao FOR ALL
  USING (get_user_role_level(auth.uid()) >= 3 AND company_id = get_user_company_id(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_config_fiscal_updated_at
  BEFORE UPDATE ON public.config_fiscal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_solicitacoes_apuracao_updated_at
  BEFORE UPDATE ON public.solicitacoes_apuracao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();