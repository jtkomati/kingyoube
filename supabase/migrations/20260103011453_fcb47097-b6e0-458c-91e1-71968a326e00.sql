-- Disable user triggers on the transactions table
ALTER TABLE transactions DISABLE TRIGGER USER;

-- Delete the fictitious transactions  
DELETE FROM transactions WHERE description IN (
  'Serviços de TI - Manutenção',
  '13º Salário - 2ª Parcela',
  'Mensalidade Consultoria - Tech Solutions',
  'Mensalidade BPO - Digital Marketing',
  'Consultoria Estratégica - Projeto Alpha',
  'Desenvolvimento de Software - ERP',
  'Suporte Técnico Mensal',
  'Treinamento Corporativo',
  'Consultoria Financeira',
  'Licença Software Anual',
  'Projeto Mobile App',
  'Integração APIs',
  'Mentoria Startup',
  'Implantação Sistema',
  'Folha de Pagamento - Dezembro',
  'Aluguel Escritório',
  'Serviços Cloud AWS',
  'Marketing Digital',
  'Impostos e Taxas',
  'Equipamentos TI'
);

-- Re-enable user triggers
ALTER TABLE transactions ENABLE TRIGGER USER;