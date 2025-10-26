-- Tabela de Plano de Contas
CREATE TABLE IF NOT EXISTS public.accounting_chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('ATIVO', 'PASSIVO', 'PATRIMONIO_LIQUIDO', 'RECEITA', 'DESPESA')),
  account_subtype TEXT,
  parent_account_id UUID REFERENCES public.accounting_chart_of_accounts(id),
  referential_code VARCHAR(20),
  referential_name TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  is_analytical BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  sped_code VARCHAR(20),
  nature TEXT CHECK (nature IN ('DEBITO', 'CREDITO')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Centros de Custos
CREATE TABLE IF NOT EXISTS public.accounting_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  parent_cost_center_id UUID REFERENCES public.accounting_cost_centers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Centros de Lucros (baseado em clientes)
CREATE TABLE IF NOT EXISTS public.accounting_profit_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Projetos
CREATE TABLE IF NOT EXISTS public.accounting_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES public.customers(id),
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'CONCLUIDO', 'CANCELADO')),
  budget_amount NUMERIC(15,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Lançamentos Contábeis
CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(50) NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  document_type TEXT,
  document_number VARCHAR(50),
  total_amount NUMERIC(15,2) NOT NULL,
  status TEXT DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'LANCADO', 'ESTORNADO')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Itens dos Lançamentos (Débito/Crédito)
CREATE TABLE IF NOT EXISTS public.accounting_entry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.accounting_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounting_chart_of_accounts(id),
  debit_amount NUMERIC(15,2) DEFAULT 0,
  credit_amount NUMERIC(15,2) DEFAULT 0,
  cost_center_id UUID REFERENCES public.accounting_cost_centers(id),
  profit_center_id UUID REFERENCES public.accounting_profit_centers(id),
  project_id UUID REFERENCES public.accounting_projects(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chart_accounts_code ON public.accounting_chart_of_accounts(code);
CREATE INDEX IF NOT EXISTS idx_chart_accounts_type ON public.accounting_chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_entry_items_entry ON public.accounting_entry_items(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_items_account ON public.accounting_entry_items(account_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON public.accounting_entries(entry_date);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_accounting_chart_accounts_updated_at
  BEFORE UPDATE ON public.accounting_chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounting_cost_centers_updated_at
  BEFORE UPDATE ON public.accounting_cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounting_profit_centers_updated_at
  BEFORE UPDATE ON public.accounting_profit_centers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounting_projects_updated_at
  BEFORE UPDATE ON public.accounting_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounting_entries_updated_at
  BEFORE UPDATE ON public.accounting_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.accounting_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_profit_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entry_items ENABLE ROW LEVEL SECURITY;

-- Políticas de visualização (todos autenticados podem ver)
CREATE POLICY "All authenticated users can view chart of accounts"
  ON public.accounting_chart_of_accounts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can view cost centers"
  ON public.accounting_cost_centers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can view profit centers"
  ON public.accounting_profit_centers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can view projects"
  ON public.accounting_projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can view entries"
  ON public.accounting_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can view entry items"
  ON public.accounting_entry_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Políticas de criação/edição (FINANCEIRO e acima)
CREATE POLICY "FINANCEIRO and above can manage chart of accounts"
  ON public.accounting_chart_of_accounts FOR ALL
  USING (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "FINANCEIRO and above can manage cost centers"
  ON public.accounting_cost_centers FOR ALL
  USING (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "FINANCEIRO and above can manage profit centers"
  ON public.accounting_profit_centers FOR ALL
  USING (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "FINANCEIRO and above can manage projects"
  ON public.accounting_projects FOR ALL
  USING (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "FINANCEIRO and above can manage entries"
  ON public.accounting_entries FOR ALL
  USING (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "FINANCEIRO and above can manage entry items"
  ON public.accounting_entry_items FOR ALL
  USING (get_user_role_level(auth.uid()) >= 3);

-- Inserir plano de contas padrão para startups (simplificado conforme SPED)
INSERT INTO public.accounting_chart_of_accounts (code, name, account_type, level, is_analytical, nature, referential_code, referential_name) VALUES
-- ATIVO
('1', 'ATIVO', 'ATIVO', 1, false, 'DEBITO', '1', 'Ativo'),
('1.1', 'ATIVO CIRCULANTE', 'ATIVO', 2, false, 'DEBITO', '1.01', 'Ativo Circulante'),
('1.1.1', 'Caixa e Equivalentes', 'ATIVO', 3, false, 'DEBITO', '1.01.01', 'Caixa e Equivalentes de Caixa'),
('1.1.1.01', 'Caixa', 'ATIVO', 4, true, 'DEBITO', '1.01.01.01', 'Caixa'),
('1.1.1.02', 'Bancos Conta Movimento', 'ATIVO', 4, true, 'DEBITO', '1.01.01.02', 'Bancos Conta Movimento'),
('1.1.1.03', 'Aplicações Financeiras', 'ATIVO', 4, true, 'DEBITO', '1.01.01.03', 'Aplicações Financeiras de Liquidez Imediata'),
('1.1.2', 'Contas a Receber', 'ATIVO', 3, false, 'DEBITO', '1.01.03', 'Contas a Receber'),
('1.1.2.01', 'Clientes Nacionais', 'ATIVO', 4, true, 'DEBITO', '1.01.03.01', 'Clientes'),
('1.1.2.02', 'Duplicatas a Receber', 'ATIVO', 4, true, 'DEBITO', '1.01.03.02', 'Duplicatas a Receber'),
('1.1.2.03', '(-) Perdas Estimadas Créditos Liquidação Duvidosa', 'ATIVO', 4, true, 'CREDITO', '1.01.03.06', 'Perdas Estimadas'),
('1.1.3', 'Estoques', 'ATIVO', 3, false, 'DEBITO', '1.01.04', 'Estoques'),
('1.1.3.01', 'Produtos Acabados', 'ATIVO', 4, true, 'DEBITO', '1.01.04.01', 'Produtos Acabados'),
('1.1.3.02', 'Mercadorias para Revenda', 'ATIVO', 4, true, 'DEBITO', '1.01.04.02', 'Mercadorias para Revenda'),
('1.1.4', 'Tributos a Recuperar', 'ATIVO', 3, false, 'DEBITO', '1.01.05', 'Tributos a Recuperar'),
('1.1.4.01', 'ICMS a Recuperar', 'ATIVO', 4, true, 'DEBITO', '1.01.05.01', 'ICMS a Recuperar'),
('1.1.4.02', 'PIS a Recuperar', 'ATIVO', 4, true, 'DEBITO', '1.01.05.02', 'PIS a Recuperar'),
('1.1.4.03', 'COFINS a Recuperar', 'ATIVO', 4, true, 'DEBITO', '1.01.05.03', 'COFINS a Recuperar'),
('1.1.4.04', 'IBS a Recuperar', 'ATIVO', 4, true, 'DEBITO', '1.01.05.04', 'IBS a Recuperar'),
('1.1.4.05', 'CBS a Recuperar', 'ATIVO', 4, true, 'DEBITO', '1.01.05.05', 'CBS a Recuperar'),

('1.2', 'ATIVO NÃO CIRCULANTE', 'ATIVO', 2, false, 'DEBITO', '1.02', 'Ativo Não Circulante'),
('1.2.1', 'Realizável a Longo Prazo', 'ATIVO', 3, false, 'DEBITO', '1.02.01', 'Ativo Realizável a Longo Prazo'),
('1.2.1.01', 'Contas a Receber LP', 'ATIVO', 4, true, 'DEBITO', '1.02.01.01', 'Títulos a Receber'),
('1.2.2', 'Investimentos', 'ATIVO', 3, false, 'DEBITO', '1.02.02', 'Investimentos'),
('1.2.2.01', 'Participações Societárias', 'ATIVO', 4, true, 'DEBITO', '1.02.02.01', 'Participações Societárias'),
('1.2.3', 'Imobilizado', 'ATIVO', 3, false, 'DEBITO', '1.02.03', 'Imobilizado'),
('1.2.3.01', 'Móveis e Utensílios', 'ATIVO', 4, true, 'DEBITO', '1.02.03.01', 'Móveis e Utensílios'),
('1.2.3.02', 'Máquinas e Equipamentos', 'ATIVO', 4, true, 'DEBITO', '1.02.03.02', 'Máquinas e Equipamentos'),
('1.2.3.03', 'Veículos', 'ATIVO', 4, true, 'DEBITO', '1.02.03.03', 'Veículos'),
('1.2.3.04', '(-) Depreciação Acumulada', 'ATIVO', 4, true, 'CREDITO', '1.02.03.08', 'Depreciação Acumulada'),
('1.2.4', 'Intangível', 'ATIVO', 3, false, 'DEBITO', '1.02.04', 'Intangível'),
('1.2.4.01', 'Software e Licenças', 'ATIVO', 4, true, 'DEBITO', '1.02.04.01', 'Marcas, Direitos e Patentes'),
('1.2.4.02', '(-) Amortização Acumulada', 'ATIVO', 4, true, 'CREDITO', '1.02.04.06', 'Amortização Acumulada'),

-- PASSIVO
('2', 'PASSIVO', 'PASSIVO', 1, false, 'CREDITO', '2', 'Passivo'),
('2.1', 'PASSIVO CIRCULANTE', 'PASSIVO', 2, false, 'CREDITO', '2.01', 'Passivo Circulante'),
('2.1.1', 'Fornecedores', 'PASSIVO', 3, false, 'CREDITO', '2.01.01', 'Obrigações Sociais e Trabalhistas'),
('2.1.1.01', 'Fornecedores Nacionais', 'PASSIVO', 4, true, 'CREDITO', '2.01.01.01', 'Fornecedores'),
('2.1.2', 'Obrigações Trabalhistas', 'PASSIVO', 3, false, 'CREDITO', '2.01.02', 'Obrigações Trabalhistas'),
('2.1.2.01', 'Salários a Pagar', 'PASSIVO', 4, true, 'CREDITO', '2.01.02.01', 'Salários a Pagar'),
('2.1.2.02', 'FGTS a Recolher', 'PASSIVO', 4, true, 'CREDITO', '2.01.02.02', 'FGTS a Recolher'),
('2.1.2.03', 'INSS a Recolher', 'PASSIVO', 4, true, 'CREDITO', '2.01.02.03', 'INSS a Recolher'),
('2.1.3', 'Obrigações Tributárias', 'PASSIVO', 3, false, 'CREDITO', '2.01.03', 'Obrigações Fiscais'),
('2.1.3.01', 'ICMS a Recolher', 'PASSIVO', 4, true, 'CREDITO', '2.01.03.01', 'ICMS a Recolher'),
('2.1.3.02', 'PIS a Recolher', 'PASSIVO', 4, true, 'CREDITO', '2.01.03.02', 'PIS a Recolher'),
('2.1.3.03', 'COFINS a Recolher', 'PASSIVO', 4, true, 'CREDITO', '2.01.03.03', 'COFINS a Recolher'),
('2.1.3.04', 'IRPJ a Recolher', 'PASSIVO', 4, true, 'CREDITO', '2.01.03.04', 'IRPJ a Recolher'),
('2.1.3.05', 'CSLL a Recolher', 'PASSIVO', 4, true, 'CREDITO', '2.01.03.05', 'CSLL a Recolher'),
('2.1.3.06', 'ISS a Recolher', 'PASSIVO', 4, true, 'CREDITO', '2.01.03.06', 'ISS a Recolher'),
('2.1.3.07', 'IBS a Recolher', 'PASSIVO', 4, true, 'CREDITO', '2.01.03.07', 'IBS a Recolher'),
('2.1.3.08', 'CBS a Recolher', 'PASSIVO', 4, true, 'CREDITO', '2.01.03.08', 'CBS a Recolher'),
('2.1.4', 'Empréstimos e Financiamentos', 'PASSIVO', 3, false, 'CREDITO', '2.01.04', 'Empréstimos e Financiamentos'),
('2.1.4.01', 'Empréstimos Bancários CP', 'PASSIVO', 4, true, 'CREDITO', '2.01.04.01', 'Empréstimos'),

('2.2', 'PASSIVO NÃO CIRCULANTE', 'PASSIVO', 2, false, 'CREDITO', '2.02', 'Passivo Não Circulante'),
('2.2.1', 'Empréstimos e Financiamentos LP', 'PASSIVO', 3, false, 'CREDITO', '2.02.01', 'Empréstimos de Longo Prazo'),
('2.2.1.01', 'Empréstimos Bancários LP', 'PASSIVO', 4, true, 'CREDITO', '2.02.01.01', 'Empréstimos'),
('2.2.1.02', 'Financiamentos LP', 'PASSIVO', 4, true, 'CREDITO', '2.02.01.02', 'Financiamentos'),

-- PATRIMÔNIO LÍQUIDO
('2.3', 'PATRIMÔNIO LÍQUIDO', 'PATRIMONIO_LIQUIDO', 2, false, 'CREDITO', '2.03', 'Patrimônio Líquido'),
('2.3.1', 'Capital Social', 'PATRIMONIO_LIQUIDO', 3, false, 'CREDITO', '2.03.01', 'Capital Social'),
('2.3.1.01', 'Capital Subscrito', 'PATRIMONIO_LIQUIDO', 4, true, 'CREDITO', '2.03.01.01', 'Capital Social Subscrito'),
('2.3.1.02', '(-) Capital a Integralizar', 'PATRIMONIO_LIQUIDO', 4, true, 'DEBITO', '2.03.01.02', 'Capital Social a Integralizar'),
('2.3.2', 'Reservas', 'PATRIMONIO_LIQUIDO', 3, false, 'CREDITO', '2.03.04', 'Reservas'),
('2.3.2.01', 'Reservas de Lucros', 'PATRIMONIO_LIQUIDO', 4, true, 'CREDITO', '2.03.04.01', 'Reservas de Lucros'),
('2.3.3', 'Lucros/Prejuízos Acumulados', 'PATRIMONIO_LIQUIDO', 3, false, 'CREDITO', '2.03.07', 'Lucros ou Prejuízos Acumulados'),
('2.3.3.01', 'Lucros Acumulados', 'PATRIMONIO_LIQUIDO', 4, true, 'CREDITO', '2.03.07.01', 'Lucros Acumulados'),
('2.3.3.02', 'Prejuízos Acumulados', 'PATRIMONIO_LIQUIDO', 4, true, 'DEBITO', '2.03.07.02', 'Prejuízos Acumulados'),

-- RECEITAS
('3', 'RECEITAS', 'RECEITA', 1, false, 'CREDITO', '3', 'Receita'),
('3.1', 'RECEITAS OPERACIONAIS', 'RECEITA', 2, false, 'CREDITO', '3.01', 'Receita Bruta'),
('3.1.1', 'Receita de Vendas', 'RECEITA', 3, false, 'CREDITO', '3.01.01', 'Vendas'),
('3.1.1.01', 'Vendas de Produtos', 'RECEITA', 4, true, 'CREDITO', '3.01.01.01', 'Vendas de Produtos'),
('3.1.1.02', 'Vendas de Mercadorias', 'RECEITA', 4, true, 'CREDITO', '3.01.01.02', 'Vendas de Mercadorias'),
('3.1.2', 'Receita de Serviços', 'RECEITA', 3, false, 'CREDITO', '3.01.02', 'Prestação de Serviços'),
('3.1.2.01', 'Serviços Prestados', 'RECEITA', 4, true, 'CREDITO', '3.01.02.01', 'Serviços Prestados'),
('3.1.2.02', 'Assinaturas/Recorrência', 'RECEITA', 4, true, 'CREDITO', '3.01.02.02', 'Receitas Recorrentes'),
('3.2', 'DEDUÇÕES DA RECEITA', 'RECEITA', 2, false, 'DEBITO', '3.02', 'Deduções da Receita Bruta'),
('3.2.1', 'Impostos sobre Vendas', 'RECEITA', 3, false, 'DEBITO', '3.02.01', 'Impostos Incidentes sobre Vendas'),
('3.2.1.01', 'ICMS sobre Vendas', 'RECEITA', 4, true, 'DEBITO', '3.02.01.01', 'ICMS'),
('3.2.1.02', 'PIS sobre Vendas', 'RECEITA', 4, true, 'DEBITO', '3.02.01.02', 'PIS'),
('3.2.1.03', 'COFINS sobre Vendas', 'RECEITA', 4, true, 'DEBITO', '3.02.01.03', 'COFINS'),
('3.2.1.04', 'ISS sobre Serviços', 'RECEITA', 4, true, 'DEBITO', '3.02.01.04', 'ISS'),
('3.2.1.05', 'IBS sobre Vendas', 'RECEITA', 4, true, 'DEBITO', '3.02.01.05', 'IBS'),
('3.2.1.06', 'CBS sobre Vendas', 'RECEITA', 4, true, 'DEBITO', '3.02.01.06', 'CBS'),
('3.2.2', 'Devoluções e Cancelamentos', 'RECEITA', 3, false, 'DEBITO', '3.02.02', 'Devoluções de Vendas'),
('3.2.2.01', 'Devoluções de Vendas', 'RECEITA', 4, true, 'DEBITO', '3.02.02.01', 'Devoluções'),

-- DESPESAS
('4', 'CUSTOS E DESPESAS', 'DESPESA', 1, false, 'DEBITO', '4', 'Despesas'),
('4.1', 'CUSTO DAS VENDAS', 'DESPESA', 2, false, 'DEBITO', '4.01', 'Custo dos Produtos Vendidos'),
('4.1.1', 'CMV - Custo Mercadoria Vendida', 'DESPESA', 3, false, 'DEBITO', '4.01.01', 'CMV'),
('4.1.1.01', 'CMV - Produtos', 'DESPESA', 4, true, 'DEBITO', '4.01.01.01', 'CMV Produtos'),
('4.1.1.02', 'CMV - Mercadorias', 'DESPESA', 4, true, 'DEBITO', '4.01.01.02', 'CMV Mercadorias'),
('4.1.2', 'CSP - Custo Serviços Prestados', 'DESPESA', 3, false, 'DEBITO', '4.01.02', 'CSP'),
('4.1.2.01', 'CSP - Mão de Obra', 'DESPESA', 4, true, 'DEBITO', '4.01.02.01', 'Custos de Serviços'),

('4.2', 'DESPESAS OPERACIONAIS', 'DESPESA', 2, false, 'DEBITO', '4.02', 'Despesas Operacionais'),
('4.2.1', 'Despesas com Pessoal', 'DESPESA', 3, false, 'DEBITO', '4.02.01', 'Despesas com Pessoal'),
('4.2.1.01', 'Salários', 'DESPESA', 4, true, 'DEBITO', '4.02.01.01', 'Salários'),
('4.2.1.02', 'Encargos Sociais', 'DESPESA', 4, true, 'DEBITO', '4.02.01.02', 'Encargos Sociais'),
('4.2.1.03', 'Benefícios', 'DESPESA', 4, true, 'DEBITO', '4.02.01.03', 'Benefícios'),
('4.2.1.04', 'Pro-labore', 'DESPESA', 4, true, 'DEBITO', '4.02.01.04', 'Pró-labore'),
('4.2.2', 'Despesas Administrativas', 'DESPESA', 3, false, 'DEBITO', '4.02.02', 'Despesas Administrativas'),
('4.2.2.01', 'Aluguel', 'DESPESA', 4, true, 'DEBITO', '4.02.02.01', 'Aluguéis'),
('4.2.2.02', 'Energia Elétrica', 'DESPESA', 4, true, 'DEBITO', '4.02.02.02', 'Energia'),
('4.2.2.03', 'Telefone e Internet', 'DESPESA', 4, true, 'DEBITO', '4.02.02.03', 'Telefone'),
('4.2.2.04', 'Material de Escritório', 'DESPESA', 4, true, 'DEBITO', '4.02.02.04', 'Material de Escritório'),
('4.2.2.05', 'Serviços de Terceiros', 'DESPESA', 4, true, 'DEBITO', '4.02.02.05', 'Serviços Profissionais'),
('4.2.3', 'Despesas com Vendas', 'DESPESA', 3, false, 'DEBITO', '4.02.03', 'Despesas com Vendas'),
('4.2.3.01', 'Marketing e Publicidade', 'DESPESA', 4, true, 'DEBITO', '4.02.03.01', 'Marketing'),
('4.2.3.02', 'Comissões', 'DESPESA', 4, true, 'DEBITO', '4.02.03.02', 'Comissões'),
('4.2.3.03', 'Fretes e Entregas', 'DESPESA', 4, true, 'DEBITO', '4.02.03.03', 'Fretes'),
('4.2.4', 'Despesas Financeiras', 'DESPESA', 3, false, 'DEBITO', '4.02.04', 'Despesas Financeiras'),
('4.2.4.01', 'Juros Pagos', 'DESPESA', 4, true, 'DEBITO', '4.02.04.01', 'Juros Passivos'),
('4.2.4.02', 'Tarifas Bancárias', 'DESPESA', 4, true, 'DEBITO', '4.02.04.02', 'Tarifas Bancárias'),
('4.2.4.03', 'IOF', 'DESPESA', 4, true, 'DEBITO', '4.02.04.03', 'IOF'),
('4.2.5', 'Depreciação e Amortização', 'DESPESA', 3, false, 'DEBITO', '4.02.05', 'Depreciações'),
('4.2.5.01', 'Depreciação', 'DESPESA', 4, true, 'DEBITO', '4.02.05.01', 'Depreciação'),
('4.2.5.02', 'Amortização', 'DESPESA', 4, true, 'DEBITO', '4.02.05.02', 'Amortização')
ON CONFLICT (code) DO NOTHING;

-- Inserir centros de custos padrão
INSERT INTO public.accounting_cost_centers (code, name, description) VALUES
('CC001', 'Administrativo', 'Despesas administrativas gerais'),
('CC002', 'Comercial', 'Despesas com vendas e marketing'),
('CC003', 'Operacional', 'Despesas operacionais diretas'),
('CC004', 'Tecnologia', 'Desenvolvimento e infraestrutura'),
('CC005', 'Financeiro', 'Gestão financeira e contábil')
ON CONFLICT (code) DO NOTHING;