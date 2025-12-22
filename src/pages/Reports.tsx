import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, DollarSign, AlertCircle, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Reports = () => {
  const { currentOrganization } = useAuth();
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [dreData, setDreData] = useState<any>({});
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchFinancialData();
    }
  }, [currentOrganization?.id]);

  const fetchFinancialData = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      setLoading(true);
      
      // Calcular últimos 12 meses dinamicamente
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 11);
      
      const { data: transactions, error } = await (supabase as any)
        .from('transactions')
        .select('*')
        .eq('company_id', currentOrganization.id)
        .gte('due_date', startDate.toISOString().split('T')[0])
        .lte('due_date', endDate.toISOString().split('T')[0])
        .order('due_date');

      if (error) throw error;

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
      
      // Processar transações
      for (const tx of transactions || []) {
        const monthKey = tx.due_date.substring(0, 7);
        if (monthlyData[monthKey]) {
          if (tx.type === 'RECEIVABLE') {
            monthlyData[monthKey].receitaBruta += Number(tx.gross_amount || 0);
          } else {
            monthlyData[monthKey].despesasOperacionais += Number(tx.gross_amount || 0);
          }
        }
      }
      
      // Calcular valores derivados
      for (const monthKey of months) {
        const data = monthlyData[monthKey];
        data.deducoes = data.receitaBruta * 0.10; // 10% impostos aproximado
        data.receitaLiquida = data.receitaBruta - data.deducoes;
        data.resultado = data.receitaLiquida - data.despesasOperacionais;
        
        const [year, month] = monthKey.split('-');
        const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        cashFlow.push({
          mes: monthLabel.replace('.', ''),
          entradas: data.receitaBruta,
          saidas: data.despesasOperacionais,
          saldo: data.resultado
        });
      }

      setDreData(monthlyData);
      setCashFlowData(cashFlow);
      setAvailableMonths(months);
      
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
  
  // Calcular mês anterior
  const [year, month] = selectedMonth.split('-');
  const prevMonthNum = parseInt(month) - 1;
  const previousMonth = prevMonthNum > 0 ? `${year}-${prevMonthNum.toString().padStart(2, '0')}` : `2024-12`;
  const prevData = dreData[previousMonth] || currentData;
  const variation = prevData.resultado !== 0 
    ? ((currentData.resultado - prevData.resultado) / Math.abs(prevData.resultado) * 100).toFixed(1)
    : "0.0";

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
            <div className="flex items-center gap-4 mb-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione o mês" />
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
          </>
        )}

        <Tabs defaultValue="dre" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dre">DRE</TabsTrigger>
            <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
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
                    <BarChart data={Object.entries(dreData).map(([key, data]: [string, any]) => {
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
                    {formatCurrency(cashFlowData.reduce((sum, d) => sum + d.entradas, 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Últimos 2 meses
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
                    {formatCurrency(cashFlowData.reduce((sum, d) => sum + d.saidas, 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Últimos 2 meses
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
                    {formatCurrency(cashFlowData.reduce((sum, d) => sum + d.saldo, 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Resultado positivo
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
                  <LineChart data={cashFlowData}>
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
                  {cashFlowData.map((data) => (
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
