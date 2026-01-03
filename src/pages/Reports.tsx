import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, DollarSign, AlertCircle, Calendar, Landmark, Link as LinkIcon, Users, Truck, CheckCircle, Clock, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Reports = () => {
  const { currentOrganization } = useAuth();
  const navigate = useNavigate();
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [startMonth, setStartMonth] = useState<string>('2025-11');
const [dreData, setDreData] = useState<any>({});
const [cashFlowData, setCashFlowData] = useState<any[]>([]);
const [availableMonths, setAvailableMonths] = useState<string[]>([]);
const [loading, setLoading] = useState(true);
const [dreDataSource, setDreDataSource] = useState<'accounting' | 'none'>('none');
const [cashFlowDataSource, setCashFlowDataSource] = useState<'bank_statements' | 'transactions' | 'none'>('none');
const [receivables, setReceivables] = useState<any[]>([]);
const [payables, setPayables] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchFinancialData();
    }
  }, [currentOrganization?.id, startMonth]);

  const fetchFinancialData = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      setLoading(true);
      
      // Calcular últimos 12 meses dinamicamente
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 11);
      
      // FONTE PRINCIPAL: Buscar lançamentos contábeis
      const { data: accountingData } = await supabase
        .from('accounting_entry_items')
        .select(`
          debit_amount,
          credit_amount,
          accounting_entries!inner (
            entry_date,
            status,
            company_id
          ),
          accounting_chart_of_accounts (
            account_type,
            nature
          )
        `)
        .eq('accounting_entries.company_id', currentOrganization.id)
        .eq('accounting_entries.status', 'posted')
        .gte('accounting_entries.entry_date', startDate.toISOString().split('T')[0])
        .lte('accounting_entries.entry_date', endDate.toISOString().split('T')[0]);

      // Fallback: buscar contas bancárias da organização
      const { data: bankAccounts } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('company_id', currentOrganization.id);

      const accountIds = bankAccounts?.map(a => a.id) || [];
      
      // Buscar dados do extrato bancário (fonte secundária)
      let bankStatements: any[] = [];
      if (accountIds.length > 0) {
        const { data: statements } = await supabase
          .from('bank_statements')
          .select('statement_date, amount, type, balance')
          .in('bank_account_id', accountIds)
          .gte('statement_date', startDate.toISOString().split('T')[0])
          .lte('statement_date', endDate.toISOString().split('T')[0])
          .order('statement_date');
        
        bankStatements = statements || [];
      }

      // Processar dados por mês
      const monthlyData: any = {};
      const cashFlow: any[] = [];
      const months: string[] = [];
      
      // Criar estrutura para os últimos 12 meses
      for (let i = 0; i < 12; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push(monthKey);
        monthlyData[monthKey] = {
          receitaBruta: 0,
          deducoes: 0,
          receitaLiquida: 0,
          despesasOperacionais: 0,
          resultado: 0
        };
      }
      
      // ========== DRE: APENAS DADOS CONTÁBEIS ==========
      if (accountingData && accountingData.length > 0) {
        setDreDataSource('accounting');
        
        for (const item of accountingData) {
          const entry = item.accounting_entries as any;
          const account = item.accounting_chart_of_accounts as any;
          const monthKey = entry.entry_date.substring(0, 7);
          
          if (monthlyData[monthKey] && account) {
            if (account.account_type === 'RECEITA') {
              monthlyData[monthKey].receitaBruta += Number(item.credit_amount || 0);
            } else if (account.account_type === 'DESPESA') {
              monthlyData[monthKey].despesasOperacionais += Number(item.debit_amount || 0);
            } else if (account.account_type === 'DEDUCAO_RECEITA') {
              monthlyData[monthKey].deducoes += Number(item.debit_amount || 0);
            }
          }
        }
      } else {
        setDreDataSource('none');
      }
      
      // ========== FLUXO DE CAIXA: EXTRATO OU TRANSAÇÕES ==========
      const cashFlowMonthlyData: any = {};
      for (const monthKey of months) {
        cashFlowMonthlyData[monthKey] = { entradas: 0, saidas: 0 };
      }
      
      if (bankStatements.length > 0) {
        setCashFlowDataSource('bank_statements');
        
        for (const stmt of bankStatements) {
          const monthKey = stmt.statement_date.substring(0, 7);
          if (cashFlowMonthlyData[monthKey]) {
            const amount = Number(stmt.amount || 0);
            if (amount > 0 || stmt.type === 'credit') {
              cashFlowMonthlyData[monthKey].entradas += Math.abs(amount);
            } else {
              cashFlowMonthlyData[monthKey].saidas += Math.abs(amount);
            }
          }
        }
      } else {
        const { data: transactions, error } = await (supabase as any)
          .from('transactions')
          .select('*')
          .eq('company_id', currentOrganization.id)
          .gte('due_date', startDate.toISOString().split('T')[0])
          .lte('due_date', endDate.toISOString().split('T')[0])
          .order('due_date');

        if (!error && transactions && transactions.length > 0) {
          setCashFlowDataSource('transactions');
          
          for (const tx of transactions) {
            const monthKey = tx.due_date.substring(0, 7);
            if (cashFlowMonthlyData[monthKey]) {
              if (tx.type === 'RECEIVABLE') {
                cashFlowMonthlyData[monthKey].entradas += Number(tx.gross_amount || 0);
              } else {
                cashFlowMonthlyData[monthKey].saidas += Number(tx.gross_amount || 0);
              }
            }
          }
        } else {
          setCashFlowDataSource('none');
        }
      }
      
      // Calcular valores derivados da DRE
      for (const monthKey of months) {
        const data = monthlyData[monthKey];
        data.receitaLiquida = data.receitaBruta - data.deducoes;
        data.resultado = data.receitaLiquida - data.despesasOperacionais;
      }
      
      // Montar dados do Fluxo de Caixa
      for (const monthKey of months) {
        const cfData = cashFlowMonthlyData[monthKey];
        const [year, month] = monthKey.split('-');
        const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        cashFlow.push({
          mes: monthLabel.replace('.', ''),
          monthKey,
          entradas: cfData.entradas,
          saidas: cfData.saidas,
          saldo: cfData.entradas - cfData.saidas
        });
      }

      setDreData(monthlyData);
      setCashFlowData(cashFlow);
      setAvailableMonths(months);
      
      // Buscar Contas a Receber
      const { data: receivablesData } = await supabase
        .from('transactions')
        .select(`
          id, description, gross_amount, net_amount, 
          due_date, payment_date, customer_id,
          customers:customer_id (first_name, last_name, company_name, person_type)
        `)
        .eq('company_id', currentOrganization.id)
        .eq('type', 'RECEIVABLE')
        .order('due_date', { ascending: true });

      // Buscar Contas a Pagar  
      const { data: payablesData } = await supabase
        .from('transactions')
        .select(`
          id, description, gross_amount, net_amount,
          due_date, payment_date, supplier_id,
          suppliers:supplier_id (first_name, last_name, company_name, person_type)
        `)
        .eq('company_id', currentOrganization.id)
        .eq('type', 'PAYABLE')
        .order('due_date', { ascending: true });

      setReceivables(receivablesData || []);
      setPayables(payablesData || []);
      
      // Atualizar mês selecionado se não estiver na lista
      if (!months.includes(selectedMonth)) {
        setSelectedMonth(months[months.length - 1] || currentMonthKey);
      }
    } catch (error) {
      console.error('Erro ao buscar dados financeiros:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao carregar dados financeiros'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const currentData = dreData[selectedMonth] || { receitaBruta: 0, deducoes: 0, receitaLiquida: 0, despesasOperacionais: 0, resultado: 0 };
  
  // Filtrar dados do fluxo de caixa pela data inicial
  const filteredCashFlowData = cashFlowData.filter((d: any) => d.monthKey >= startMonth);
  
  // Calcular mês anterior
  const [year, month] = selectedMonth.split('-');
  const prevMonthNum = parseInt(month) - 1;
  const previousMonth = prevMonthNum > 0 ? `${year}-${prevMonthNum.toString().padStart(2, '0')}` : `2024-12`;
  const prevData = dreData[previousMonth] || currentData;
  const variation = prevData.resultado !== 0 
    ? ((currentData.resultado - prevData.resultado) / Math.abs(prevData.resultado) * 100).toFixed(1)
    : "0.0";

  // Helper para status de pagamento
  const getPaymentStatus = (dueDate: string, paymentDate: string | null) => {
    if (paymentDate) return { label: 'Pago', variant: 'success' as const, icon: CheckCircle };
    const today = new Date();
    const due = new Date(dueDate);
    if (due < today) return { label: 'Vencido', variant: 'destructive' as const, icon: XCircle };
    return { label: 'A Vencer', variant: 'warning' as const, icon: Clock };
  };

  // Helper para nome do cliente/fornecedor
  const getEntityName = (entity: any) => {
    if (!entity) return 'Não informado';
    if (entity.person_type === 'PJ' && entity.company_name) return entity.company_name;
    return [entity.first_name, entity.last_name].filter(Boolean).join(' ') || 'Não informado';
  };

  // Cálculos de resumo para Contas a Receber
  const receivablesSummary = {
    total: receivables.reduce((sum, r) => sum + Number(r.gross_amount || 0), 0),
    received: receivables.filter(r => r.payment_date).reduce((sum, r) => sum + Number(r.gross_amount || 0), 0),
    overdue: receivables.filter(r => !r.payment_date && new Date(r.due_date) < new Date()).reduce((sum, r) => sum + Number(r.gross_amount || 0), 0),
    upcoming: receivables.filter(r => !r.payment_date && new Date(r.due_date) >= new Date()).reduce((sum, r) => sum + Number(r.gross_amount || 0), 0),
  };

  // Cálculos de resumo para Contas a Pagar
  const payablesSummary = {
    total: payables.reduce((sum, p) => sum + Number(p.gross_amount || 0), 0),
    paid: payables.filter(p => p.payment_date).reduce((sum, p) => sum + Number(p.gross_amount || 0), 0),
    overdue: payables.filter(p => !p.payment_date && new Date(p.due_date) < new Date()).reduce((sum, p) => sum + Number(p.gross_amount || 0), 0),
    upcoming: payables.filter(p => !p.payment_date && new Date(p.due_date) >= new Date()).reduce((sum, p) => sum + Number(p.gross_amount || 0), 0),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-gradient-primary">
            Relatórios Gerenciais
          </h1>
          <p className="text-muted-foreground mt-2">
            Análises e indicadores financeiros
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">Carregando dados financeiros...</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">A partir de:</span>
                <Select value={startMonth} onValueChange={setStartMonth}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Data inicial" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((monthKey) => {
                      const [year, month] = monthKey.split('-');
                      const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                      return (
                        <SelectItem key={monthKey} value={monthKey}>
                          {label.charAt(0).toUpperCase() + label.slice(1)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mês selecionado:</span>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.filter(m => m >= startMonth).map((monthKey) => {
                      const [year, month] = monthKey.split('-');
                      const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                      return (
                        <SelectItem key={monthKey} value={monthKey}>
                          {label.charAt(0).toUpperCase() + label.slice(1)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        <Tabs defaultValue="dre" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="dre">DRE</TabsTrigger>
            <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="receivables">Contas a Receber</TabsTrigger>
            <TabsTrigger value="payables">Contas a Pagar</TabsTrigger>
            <TabsTrigger value="taxes">Impostos</TabsTrigger>
            <TabsTrigger value="delinquency">Inadimplência</TabsTrigger>
          </TabsList>

          <TabsContent value="dre" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Receita Bruta
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{formatCurrency(currentData.receitaBruta)}</div>
                  <p className="text-xs text-muted-foreground">
                    Vendas totais
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Deduções
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{formatCurrency(currentData.deducoes)}</div>
                  <p className="text-xs text-muted-foreground">
                    Impostos sobre receita
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Receita Líquida
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(currentData.receitaLiquida)}</div>
                  <p className="text-xs text-muted-foreground">
                    Após deduções
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Resultado
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${currentData.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(currentData.resultado)}
                  </div>
                  <p className={`text-xs ${parseFloat(variation) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {parseFloat(variation) >= 0 ? '+' : ''}{variation}% vs mês anterior
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Demonstração de Resultado do Exercício (DRE)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between font-semibold border-b pb-2">
                      <span>Receita Bruta</span>
                      <span className="text-success">{formatCurrency(currentData.receitaBruta)}</span>
                    </div>
                    <div className="flex justify-between pl-4">
                      <span>(-) Deduções (Impostos)</span>
                      <span className="text-destructive">{formatCurrency(currentData.deducoes)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-b pb-2">
                      <span>(=) Receita Líquida</span>
                      <span>{formatCurrency(currentData.receitaLiquida)}</span>
                    </div>
                    <div className="flex justify-between pl-4">
                      <span>(-) Custos e Despesas</span>
                      <span className="text-destructive">{formatCurrency(currentData.despesasOperacionais)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>(=) Resultado Operacional</span>
                      <span className={currentData.resultado >= 0 ? 'text-success' : 'text-destructive'}>
                        {formatCurrency(currentData.resultado)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Evolução do Resultado</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(dreData)
                      .filter(([key]) => key >= startMonth)
                      .map(([key, data]: [string, any]) => {
                        const [year, month] = key.split('-');
                        const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                        return {
                          mes: monthLabel.replace('.', ''),
                          receita: data.receitaLiquida,
                          despesas: data.despesasOperacionais,
                          resultado: data.resultado
                        };
                      })}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mes" />
                      <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="receita" fill="hsl(var(--success))" name="Receita Líquida" />
                      <Bar dataKey="despesas" fill="hsl(var(--destructive))" name="Despesas" />
                      <Bar dataKey="resultado" fill="hsl(var(--primary))" name="Resultado" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cashflow" className="space-y-4">
            {/* Data source indicator for Cash Flow */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {cashFlowDataSource === 'bank_statements' && (
                  <Badge variant="default" className="bg-success/20 text-success border-success/30">
                    <Landmark className="h-3 w-3 mr-1" />
                    Dados do Open Finance
                  </Badge>
                )}
                {cashFlowDataSource === 'transactions' && (
                  <Badge variant="secondary">
                    <FileText className="h-3 w-3 mr-1" />
                    Dados de Lançamentos
                  </Badge>
                )}
                {cashFlowDataSource === 'none' && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Sem dados financeiros
                  </Badge>
                )}
              </div>
              {cashFlowDataSource === 'bank_statements' ? (
                <Button variant="outline" size="sm" onClick={() => navigate('/bank-integrations')}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Ver extrato completo
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={() => navigate('/bank-integrations')}>
                  <Landmark className="h-4 w-4 mr-2" />
                  Conectar conta bancária
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Entradas
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    {formatCurrency(filteredCashFlowData.reduce((sum, d) => sum + d.entradas, 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Últimos 12 meses
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Saídas
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {formatCurrency(filteredCashFlowData.reduce((sum, d) => sum + d.saidas, 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Últimos 12 meses
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Saldo Acumulado
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    {formatCurrency(filteredCashFlowData.reduce((sum, d) => sum + d.saldo, 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Resultado do período
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Fluxo de Caixa Realizado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={filteredCashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="entradas" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      name="Entradas"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="saidas" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      name="Saídas"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="saldo" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      name="Saldo"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredCashFlowData.map((data) => (
                    <div key={data.mes} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-2">{data.mes}</h3>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Entradas</p>
                          <p className="font-bold text-success">{formatCurrency(data.entradas)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Saídas</p>
                          <p className="font-bold text-destructive">{formatCurrency(data.saidas)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Saldo</p>
                          <p className="font-bold text-primary">{formatCurrency(data.saldo)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contas a Receber */}
          <TabsContent value="receivables" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(receivablesSummary.total)}</div>
                  <p className="text-xs text-muted-foreground">{receivables.length} lançamentos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recebido</CardTitle>
                  <CheckCircle className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{formatCurrency(receivablesSummary.received)}</div>
                  <p className="text-xs text-muted-foreground">{receivables.filter(r => r.payment_date).length} pagos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Vencido</CardTitle>
                  <XCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{formatCurrency(receivablesSummary.overdue)}</div>
                  <p className="text-xs text-muted-foreground">{receivables.filter(r => !r.payment_date && new Date(r.due_date) < new Date()).length} pendentes</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">A Vencer</CardTitle>
                  <Clock className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{formatCurrency(receivablesSummary.upcoming)}</div>
                  <p className="text-xs text-muted-foreground">{receivables.filter(r => !r.payment_date && new Date(r.due_date) >= new Date()).length} futuros</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento</CardTitle>
              </CardHeader>
              <CardContent>
                {receivables.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma conta a receber cadastrada</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivables.map((r) => {
                        const status = getPaymentStatus(r.due_date, r.payment_date);
                        const StatusIcon = status.icon;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{getEntityName(r.customers)}</TableCell>
                            <TableCell>{r.description || '-'}</TableCell>
                            <TableCell>{new Date(r.due_date).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(r.gross_amount)}</TableCell>
                            <TableCell>
                              <Badge variant={status.variant === 'success' ? 'default' : status.variant === 'destructive' ? 'destructive' : 'secondary'} className={status.variant === 'success' ? 'bg-success/20 text-success' : status.variant === 'warning' ? 'bg-warning/20 text-warning' : ''}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contas a Pagar */}
          <TabsContent value="payables" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(payablesSummary.total)}</div>
                  <p className="text-xs text-muted-foreground">{payables.length} lançamentos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pago</CardTitle>
                  <CheckCircle className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{formatCurrency(payablesSummary.paid)}</div>
                  <p className="text-xs text-muted-foreground">{payables.filter(p => p.payment_date).length} pagos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Vencido</CardTitle>
                  <XCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{formatCurrency(payablesSummary.overdue)}</div>
                  <p className="text-xs text-muted-foreground">{payables.filter(p => !p.payment_date && new Date(p.due_date) < new Date()).length} pendentes</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">A Vencer</CardTitle>
                  <Clock className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{formatCurrency(payablesSummary.upcoming)}</div>
                  <p className="text-xs text-muted-foreground">{payables.filter(p => !p.payment_date && new Date(p.due_date) >= new Date()).length} futuros</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento</CardTitle>
              </CardHeader>
              <CardContent>
                {payables.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma conta a pagar cadastrada</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payables.map((p) => {
                        const status = getPaymentStatus(p.due_date, p.payment_date);
                        const StatusIcon = status.icon;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{getEntityName(p.suppliers)}</TableCell>
                            <TableCell>{p.description || '-'}</TableCell>
                            <TableCell>{new Date(p.due_date).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(p.gross_amount)}</TableCell>
                            <TableCell>
                              <Badge variant={status.variant === 'success' ? 'default' : status.variant === 'destructive' ? 'destructive' : 'secondary'} className={status.variant === 'success' ? 'bg-success/20 text-success' : status.variant === 'warning' ? 'bg-warning/20 text-warning' : ''}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="taxes">
            <Card>
              <CardHeader>
                <CardTitle>Análise de Impostos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Total de impostos pagos por tipo e comparativos
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delinquency">
            <Card>
              <CardHeader>
                <CardTitle>Inadimplência</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Receitas vencidas não pagas e aging
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
