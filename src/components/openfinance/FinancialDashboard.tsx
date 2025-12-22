import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, TrendingUp, TrendingDown, Wallet, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

export function FinancialDashboard() {
  const [showValues, setShowValues] = useState(true);
  const { currentOrganization } = useAuth();

  // Buscar contas bancárias e saldo
  const { data: bankData, isLoading: isLoadingBank } = useQuery({
    queryKey: ['bank-accounts-balance', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, bank_name, account_type, balance')
        .eq('company_id', currentOrganization.id)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  // Buscar transações do mês para calcular receitas e despesas
  const { data: monthlyData, isLoading: isLoadingMonthly } = useQuery({
    queryKey: ['monthly-transactions', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return { receitas: 0, despesas: 0, chartData: [] };
      
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('type, net_amount, due_date')
        .eq('company_id', currentOrganization.id)
        .gte('due_date', firstDayOfMonth)
        .lte('due_date', lastDayOfMonth);
      
      if (error) throw error;
      
      let receitas = 0;
      let despesas = 0;
      const dailyTotals: Record<string, number> = {};
      
      (transactions || []).forEach((t) => {
        if (t.type === 'RECEIVABLE') {
          receitas += Number(t.net_amount) || 0;
        } else {
          despesas += Number(t.net_amount) || 0;
        }
        
        // Agrupar por dia para o gráfico
        const day = t.due_date;
        if (day) {
          if (!dailyTotals[day]) dailyTotals[day] = 0;
          dailyTotals[day] += t.type === 'RECEIVABLE' ? Number(t.net_amount) : -Number(t.net_amount);
        }
      });
      
      // Gerar dados do gráfico
      const chartData = Object.entries(dailyTotals)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, valor]) => ({
          data: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          valor: valor,
        }));
      
      return { receitas, despesas, chartData };
    },
    enabled: !!currentOrganization?.id,
  });

  const formatCurrency = (value: number) => {
    if (!showValues) return "R$ •••••";
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const isLoading = isLoadingBank || isLoadingMonthly;
  const saldoAtual = bankData?.balance || 0;
  const receitasMes = monthlyData?.receitas || 0;
  const despesasMes = monthlyData?.despesas || 0;
  const chartData = monthlyData?.chartData || [];
  const hasData = bankData || (chartData.length > 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-40 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Saldo Atual
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowValues(!showValues)}
            >
              {showValues ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(saldoAtual)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <Wallet className="inline h-3 w-3 mr-1" />
              {bankData ? `${bankData.bank_name} - ${bankData.account_type === 'checking' ? 'Conta Corrente' : bankData.account_type}` : 'Nenhuma conta conectada'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Receitas do Mês
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(receitasMes)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {receitasMes === 0 ? 'Sem receitas este mês' : 'Total de entradas no mês'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Despesas do Mês
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(despesasMes)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {despesasMes === 0 ? 'Sem despesas este mês' : 'Total de saídas no mês'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Fluxo de Caixa */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Caixa</CardTitle>
          <CardDescription>
            {hasData ? 'Evolução do saldo nos últimos 30 dias' : 'Conecte uma conta bancária para visualizar seus dados financeiros'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="data" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <RefreshCw className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-center">
                Nenhum dado disponível.<br />
                Conecte uma conta bancária e sincronize para visualizar o fluxo de caixa.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
