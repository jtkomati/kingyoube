import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, DollarSign, AlertCircle, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Reports = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>("2025-10");
  const [dreData, setDreData] = useState<any>({});
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      
      // Buscar transações de janeiro a outubro 2025
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('due_date', '2025-01-01')
        .lte('due_date', '2025-10-31')
        .order('due_date');

      if (error) throw error;

      // Processar dados por mês
      const monthlyData: any = {};
      const cashFlow: any[] = [];
      
      for (let month = 1; month <= 10; month++) {
        const monthStr = month.toString().padStart(2, '0');
        const monthKey = `2025-${monthStr}`;
        const monthLabel = new Date(2025, month - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

        const monthTransactions = transactions?.filter(t => 
          t.due_date.startsWith(monthKey)
        ) || [];

        const receitas = monthTransactions
          .filter(t => t.type === 'RECEIVABLE')
          .reduce((sum, t) => sum + Number(t.gross_amount), 0);
        
        const custos = monthTransactions
          .filter(t => t.type === 'PAYABLE')
          .reduce((sum, t) => sum + Number(t.gross_amount), 0);

        const deducoes = receitas * 0.10; // 10% impostos aproximado
        const receitaLiquida = receitas - deducoes;
        const resultado = receitaLiquida - custos;

        monthlyData[monthKey] = {
          receitaBruta: receitas,
          deducoes: deducoes,
          receitaLiquida: receitaLiquida,
          despesasOperacionais: custos,
          resultado: resultado
        };

        cashFlow.push({
          mes: monthLabel.replace('.', ''),
          entradas: receitas,
          saidas: custos,
          saldo: resultado
        });
      }

      setDreData(monthlyData);
      setCashFlowData(cashFlow);
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
                  <SelectItem value="2025-01">Janeiro 2025</SelectItem>
                  <SelectItem value="2025-02">Fevereiro 2025</SelectItem>
                  <SelectItem value="2025-03">Março 2025</SelectItem>
                  <SelectItem value="2025-04">Abril 2025</SelectItem>
                  <SelectItem value="2025-05">Maio 2025</SelectItem>
                  <SelectItem value="2025-06">Junho 2025</SelectItem>
                  <SelectItem value="2025-07">Julho 2025</SelectItem>
                  <SelectItem value="2025-08">Agosto 2025</SelectItem>
                  <SelectItem value="2025-09">Setembro 2025</SelectItem>
                  <SelectItem value="2025-10">Outubro 2025</SelectItem>
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
