import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ERPDataHook {
  getTransactionsSummary: () => Promise<string>;
  getRecentTransactions: (limit?: number) => Promise<string>;
  getCustomers: () => Promise<string>;
  getSuppliers: () => Promise<string>;
  getCashFlowSummary: () => Promise<string>;
}

export function useERPData(): ERPDataHook {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanyId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        
        setCompanyId(profile?.company_id || null);
      }
    };

    fetchCompanyId();
  }, []);

  const getTransactionsSummary = async (): Promise<string> => {
    if (!companyId) return 'Dados da empresa não disponíveis';

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('type, gross_amount, net_amount, due_date')
      .eq('company_id', companyId)
      .order('due_date', { ascending: false })
      .limit(100);

    if (error) return `Erro ao buscar transações: ${error.message}`;

    const receitas = transactions?.filter(t => t.type === 'RECEIVABLE') || [];
    const despesas = transactions?.filter(t => t.type === 'PAYABLE') || [];

    const totalReceitas = receitas.reduce((sum, t) => sum + (Number(t.net_amount) || 0), 0);
    const totalDespesas = despesas.reduce((sum, t) => sum + (Number(t.net_amount) || 0), 0);

    return `Resumo financeiro:
- Total de receitas: R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Total de despesas: R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Saldo: R$ ${(totalReceitas - totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Quantidade de transações: ${transactions?.length || 0}`;
  };

  const getRecentTransactions = async (limit: number = 5): Promise<string> => {
    if (!companyId) return 'Dados da empresa não disponíveis';

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('type, description, gross_amount, due_date')
      .eq('company_id', companyId)
      .order('due_date', { ascending: false })
      .limit(limit);

    if (error) return `Erro ao buscar transações: ${error.message}`;
    if (!transactions || transactions.length === 0) return 'Nenhuma transação encontrada';

    const formatted = transactions.map((t, idx) => 
      `${idx + 1}. ${t.description} - ${t.type} - R$ ${Number(t.gross_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - Vencimento: ${new Date(t.due_date).toLocaleDateString('pt-BR')}`
    ).join('\n');

    return `Últimas ${limit} transações:\n${formatted}`;
  };

  const getCustomers = async (): Promise<string> => {
    if (!companyId) return 'Dados da empresa não disponíveis';

    const { data: customers, error } = await supabase
      .from('customers')
      .select('first_name, last_name, company_name, email, phone')
      .eq('company_id', companyId)
      .limit(10);

    if (error) return `Erro ao buscar clientes: ${error.message}`;
    if (!customers || customers.length === 0) return 'Nenhum cliente cadastrado';

    const formatted = customers.map((c, idx) => {
      const name = c.company_name || `${c.first_name} ${c.last_name}`;
      return `${idx + 1}. ${name}${c.email ? ` - ${c.email}` : ''}${c.phone ? ` - ${c.phone}` : ''}`;
    }).join('\n');

    return `Clientes cadastrados (${customers.length}):\n${formatted}`;
  };

  const getSuppliers = async (): Promise<string> => {
    if (!companyId) return 'Dados da empresa não disponíveis';

    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select('first_name, last_name, company_name, email, phone')
      .eq('company_id', companyId)
      .limit(10);

    if (error) return `Erro ao buscar fornecedores: ${error.message}`;
    if (!suppliers || suppliers.length === 0) return 'Nenhum fornecedor cadastrado';

    const formatted = suppliers.map((s, idx) => {
      const name = s.company_name || `${s.first_name} ${s.last_name}`;
      return `${idx + 1}. ${name}${s.email ? ` - ${s.email}` : ''}${s.phone ? ` - ${s.phone}` : ''}`;
    }).join('\n');

    return `Fornecedores cadastrados (${suppliers.length}):\n${formatted}`;
  };

  const getCashFlowSummary = async (): Promise<string> => {
    if (!companyId) return 'Dados da empresa não disponíveis';

    const hoje = new Date().toISOString().split('T')[0];

    const { data: transactionsVencidas } = await supabase
      .from('transactions')
      .select('type, net_amount')
      .eq('company_id', companyId)
      .lt('due_date', hoje)
      .is('payment_date', null);

    const { data: transactionsProximas } = await supabase
      .from('transactions')
      .select('type, net_amount')
      .eq('company_id', companyId)
      .gte('due_date', hoje)
      .lte('due_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    const vencidasReceitas = transactionsVencidas?.filter(t => t.type === 'RECEIVABLE').reduce((sum, t) => sum + Number(t.net_amount), 0) || 0;
    const vencidasDespesas = transactionsVencidas?.filter(t => t.type === 'PAYABLE').reduce((sum, t) => sum + Number(t.net_amount), 0) || 0;
    const proximasReceitas = transactionsProximas?.filter(t => t.type === 'RECEIVABLE').reduce((sum, t) => sum + Number(t.net_amount), 0) || 0;
    const proximasDespesas = transactionsProximas?.filter(t => t.type === 'PAYABLE').reduce((sum, t) => sum + Number(t.net_amount), 0) || 0;

    return `Fluxo de caixa:

Vencido:
- Receitas a receber: R$ ${vencidasReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Despesas a pagar: R$ ${vencidasDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

Próximos 30 dias:
- Receitas previstas: R$ ${proximasReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Despesas previstas: R$ ${proximasDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Saldo previsto: R$ ${(proximasReceitas - proximasDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return {
    getTransactionsSummary,
    getRecentTransactions,
    getCustomers,
    getSuppliers,
    getCashFlowSummary,
  };
}
