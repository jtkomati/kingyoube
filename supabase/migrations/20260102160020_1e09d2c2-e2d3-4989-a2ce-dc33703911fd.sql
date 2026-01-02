-- Tabela para armazenar protocolos de consulta de notas tomadas
CREATE TABLE public.tomadas_consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  protocolo TEXT NOT NULL,
  codigo_cidade TEXT NOT NULL,
  nome_cidade TEXT,
  periodo_inicial DATE NOT NULL,
  periodo_final DATE NOT NULL,
  situacao TEXT DEFAULT 'PROCESSANDO',
  total_notas INTEGER DEFAULT 0,
  notas_importadas INTEGER DEFAULT 0,
  mensagem_erro TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  CONSTRAINT fk_tomadas_company FOREIGN KEY (company_id) REFERENCES company_settings(id) ON DELETE CASCADE
);

-- Tabela para certificados digitais por empresa
CREATE TABLE public.certificados_digitais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  certificado_id TEXT,
  nome TEXT,
  cnpj TEXT,
  vencimento TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  CONSTRAINT fk_certificado_company FOREIGN KEY (company_id) REFERENCES company_settings(id) ON DELETE CASCADE
);

-- Adicionar campos na config_fiscal para TecnoSpeed Tomadas
ALTER TABLE public.config_fiscal 
ADD COLUMN IF NOT EXISTS tecnospeed_tomadas_ativo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tecnospeed_tomadas_last_sync TIMESTAMPTZ;

-- Habilitar RLS
ALTER TABLE public.tomadas_consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para tomadas_consultas
CREATE POLICY "Users can view org tomadas consultas"
ON public.tomadas_consultas FOR SELECT
USING (
  (company_id = ANY (get_user_organization_ids(auth.uid())))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can create org tomadas consultas"
ON public.tomadas_consultas FOR INSERT
WITH CHECK (
  ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "FINANCEIRO can update org tomadas consultas"
ON public.tomadas_consultas FOR UPDATE
USING (
  ((get_user_role_level(auth.uid()) >= 3) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can delete org tomadas consultas"
ON public.tomadas_consultas FOR DELETE
USING (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

-- Políticas RLS para certificados_digitais
CREATE POLICY "Users can view org certificados"
ON public.certificados_digitais FOR SELECT
USING (
  (company_id = ANY (get_user_organization_ids(auth.uid())))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can create org certificados"
ON public.certificados_digitais FOR INSERT
WITH CHECK (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can update org certificados"
ON public.certificados_digitais FOR UPDATE
USING (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

CREATE POLICY "ADMIN can delete org certificados"
ON public.certificados_digitais FOR DELETE
USING (
  ((get_user_role_level(auth.uid()) >= 4) AND (company_id = ANY (get_user_organization_ids(auth.uid()))))
  OR (get_user_role_level(auth.uid()) >= 5)
);

-- Índices para performance
CREATE INDEX idx_tomadas_consultas_company ON public.tomadas_consultas(company_id);
CREATE INDEX idx_tomadas_consultas_situacao ON public.tomadas_consultas(situacao);
CREATE INDEX idx_certificados_company ON public.certificados_digitais(company_id);

-- Trigger para updated_at
CREATE TRIGGER update_tomadas_consultas_updated_at
  BEFORE UPDATE ON public.tomadas_consultas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certificados_digitais_updated_at
  BEFORE UPDATE ON public.certificados_digitais
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();