import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';

interface ProjectionData {
  date: string;
  balance: number;
  inflows: number;
  outflows: number;
}

export default function CashFlow() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [projection, setProjection] = useState<ProjectionData[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchProjection();
  }, []);

  const fetchProjection = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Você precisa estar autenticado',
        });
        return;
      }

      const response = await supabase.functions.invoke('cash-flow-projection', {
        body: { days },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      setProjection(response.data || []);
    } catch (error) {
      console.error('Erro ao buscar projeção:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao buscar projeção de fluxo de caixa',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjection();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  // Calcular métricas
  const totalInflows = projection.reduce((sum, p) => sum + p.inflows, 0);
  const totalOutflows = projection.reduce((sum, p) => sum + p.outflows, 0);
  const finalBalance = projection.length > 0 ? projection[projection.length - 1].balance : 0;
  const criticalDays = projection.filter(p => p.balance < 0).length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-gradient-primary">
            Projeção de Fluxo de Caixa
          </h1>
          <p className="text-muted-foreground mt-2">
            Visualize o fluxo de caixa projetado para os próximos dias
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Período da Projeção
            </CardTitle>
            <CardDescription>
              Configure o período para análise
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-4 items-end">
              <div className="flex-1 max-w-xs space-y-2">
                <Label htmlFor="days">Número de Dias</Label>
                <Input
                  id="days"
                  type="number"
                  min="1"
                  max="365"
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value))}
                  placeholder="30"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Calculando...' : 'Calcular Projeção'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {projection.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="relative overflow-hidden group hover:shadow-glow transition-all">
                <div className="absolute inset-0 gradient-primary opacity-5 group-hover:opacity-10 transition-opacity" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Saldo Final</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${finalBalance < 0 ? 'text-destructive' : ''}`}>
                    {formatCurrency(finalBalance)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Após {days} dias
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden group hover:shadow-glow transition-all">
                <div className="absolute inset-0 gradient-success opacity-5 group-hover:opacity-10 transition-opacity" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalInflows)}</div>
                  <p className="text-xs text-muted-foreground">
                    Receitas projetadas
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden group hover:shadow-glow transition-all">
                <div className="absolute inset-0 gradient-danger opacity-5 group-hover:opacity-10 transition-opacity" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalOutflows)}</div>
                  <p className="text-xs text-muted-foreground">
                    Despesas projetadas
                  </p>
                </CardContent>
              </Card>

              <Card className={`relative overflow-hidden group hover:shadow-glow transition-all ${criticalDays > 0 ? 'border-destructive' : ''}`}>
                <div className={`absolute inset-0 ${criticalDays > 0 ? 'gradient-danger' : 'gradient-success'} opacity-5 group-hover:opacity-10 transition-opacity`} />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Dias Críticos</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${criticalDays > 0 ? 'text-destructive' : ''}`}>
                    {criticalDays}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {criticalDays > 0 ? 'Dias com saldo negativo' : 'Sem dias críticos'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Gráfico de Projeção</CardTitle>
                <CardDescription>
                  Visualização do saldo projetado ao longo do período
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={projection}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tickFormatter={(value) => formatCurrency(value)}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Data: ${formatDate(label)}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="balance" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Saldo"
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="inflows" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      name="Entradas"
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="outflows" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      name="Saídas"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {!loading && projection.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Nenhuma projeção disponível</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Cadastre transações com datas futuras para visualizar a projeção de fluxo de caixa.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
