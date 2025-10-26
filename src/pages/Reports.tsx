import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, DollarSign, AlertCircle, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Dados fictícios de DRE
const dreData = {
  "jan-2025": {
    receitaBruta: 485000,
    deducoes: 73500,
    receitaLiquida: 411500,
    despesasOperacionais: 245800,
    resultado: 165700,
    breakdown: {
      impostos: 73500,
      folhaPagamento: 145000,
      aluguel: 35000,
      marketing: 28000,
      infraestrutura: 37800
    }
  },
  "fev-2025": {
    receitaBruta: 562000,
    deducoes: 85200,
    receitaLiquida: 476800,
    despesasOperacionais: 268500,
    resultado: 208300,
    breakdown: {
      impostos: 85200,
      folhaPagamento: 148000,
      aluguel: 35000,
      marketing: 42000,
      infraestrutura: 43500
    }
  }
};

// Dados de fluxo de caixa realizado
const cashFlowData = [
  { mes: "Jan/25", entradas: 485000, saidas: 319300, saldo: 165700 },
  { mes: "Fev/25", entradas: 562000, saidas: 353700, saldo: 208300 }
];

const Reports = () => {
  const [selectedMonth, setSelectedMonth] = useState<"jan-2025" | "fev-2025">("fev-2025");
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const currentData = dreData[selectedMonth];
  const previousMonth = selectedMonth === "fev-2025" ? "jan-2025" : "jan-2025";
  const variation = ((currentData.resultado - dreData[previousMonth].resultado) / dreData[previousMonth].resultado * 100).toFixed(1);

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

        <div className="flex items-center gap-4 mb-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={(value: "jan-2025" | "fev-2025") => setSelectedMonth(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jan-2025">Janeiro 2025</SelectItem>
              <SelectItem value="fev-2025">Fevereiro 2025</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
                  <div className="text-2xl font-bold text-success">{formatCurrency(currentData.resultado)}</div>
                  <p className="text-xs text-success">
                    +{variation}% vs mês anterior
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
                      <span>(-) Despesas Operacionais</span>
                      <span className="text-destructive">{formatCurrency(currentData.despesasOperacionais)}</span>
                    </div>
                    <div className="flex justify-between pl-8 text-xs text-muted-foreground">
                      <span>• Folha de Pagamento</span>
                      <span>{formatCurrency(currentData.breakdown.folhaPagamento)}</span>
                    </div>
                    <div className="flex justify-between pl-8 text-xs text-muted-foreground">
                      <span>• Aluguel</span>
                      <span>{formatCurrency(currentData.breakdown.aluguel)}</span>
                    </div>
                    <div className="flex justify-between pl-8 text-xs text-muted-foreground">
                      <span>• Marketing</span>
                      <span>{formatCurrency(currentData.breakdown.marketing)}</span>
                    </div>
                    <div className="flex justify-between pl-8 text-xs text-muted-foreground">
                      <span>• Infraestrutura</span>
                      <span>{formatCurrency(currentData.breakdown.infraestrutura)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>(=) Resultado Operacional</span>
                      <span className="text-success">{formatCurrency(currentData.resultado)}</span>
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
                    <BarChart data={Object.entries(dreData).map(([key, data]) => ({
                      mes: key === "jan-2025" ? "Jan/25" : "Fev/25",
                      receita: data.receitaLiquida,
                      despesas: data.despesasOperacionais,
                      resultado: data.resultado
                    }))}>
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
