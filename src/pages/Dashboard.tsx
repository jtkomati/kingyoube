import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target,
  Zap,
  Calendar,
  AlertCircle,
  RefreshCw,
  BarChart3,
  PiggyBank
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StartupMetricCard } from '@/components/dashboard/StartupMetricCard';
import { MetricsChart } from '@/components/dashboard/MetricsChart';
import { getFriendlyError } from '@/lib/errorMessages';
import { useToast } from '@/hooks/use-toast';

interface StartupMetrics {
  mrr: number;
  mrrGrowth: number;
  arr: number;
  cac: number;
  ltv: number;
  churnRate: number;
  ltvCacRatio: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  activeCustomers: number;
  avgRevenuePerCustomer: number;
  burnRate: number;
  runway: number;
  paybackPeriod: number;
  cashBalance: number;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    totalReceivables: 0,
    totalPayables: 0,
    balance: 0,
    customersCount: 0,
  });
  const [startupMetrics, setStartupMetrics] = useState<StartupMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Mock data para o gráfico (em produção, viria de um histórico)
  const chartData = [
    { month: 'Jan', mrr: 15000, customers: 25 },
    { month: 'Fev', mrr: 18000, customers: 28 },
    { month: 'Mar', mrr: 22000, customers: 32 },
    { month: 'Abr', mrr: 25000, customers: 35 },
    { month: 'Mai', mrr: 28000, customers: 38 },
    { month: 'Jun', mrr: startupMetrics?.mrr || 30000, customers: startupMetrics?.totalCustomers || 40 },
  ];

  useEffect(() => {
    fetchAllMetrics();
  }, []);

  const fetchAllMetrics = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchBasicMetrics(), fetchStartupMetrics()]);
    setLoading(false);
  };

  const fetchBasicMetrics = async () => {
    try {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('type, net_amount, payment_date');

      const { data: customers } = await supabase
        .from('customers')
        .select('id');

      let totalReceivables = 0;
      let totalPayables = 0;
      const today = new Date().toISOString().split('T')[0];

      transactions?.forEach((tx) => {
        if (!tx.payment_date || tx.payment_date >= today || 
            new Date(tx.payment_date).getMonth() === new Date().getMonth()) {
          if (tx.type === 'RECEIVABLE') {
            totalReceivables += Number(tx.net_amount);
          } else {
            totalPayables += Number(tx.net_amount);
          }
        }
      });

      setMetrics({
        totalReceivables,
        totalPayables,
        balance: totalReceivables - totalPayables,
        customersCount: customers?.length || 0,
      });
    } catch (error: any) {
      console.error('Erro ao buscar métricas básicas:', error);
    }
  };

  const fetchStartupMetrics = async () => {
    setMetricsLoading(true);
    try {
      // Dados fictícios para demonstração
      const mockData: StartupMetrics = {
        mrr: 45000,
        mrrGrowth: 15.5,
        arr: 540000,
        cac: 850,
        ltv: 3400,
        churnRate: 3.2,
        ltvCacRatio: 4.0,
        totalCustomers: 42,
        newCustomersThisMonth: 6,
        activeCustomers: 38,
        avgRevenuePerCustomer: 1071.43,
        burnRate: 12000,
        runway: 18.5,
        paybackPeriod: 7.5,
        cashBalance: 222000,
      };
      
      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setStartupMetrics(mockData);
      setError(null);
    } catch (error: any) {
      const friendlyError = getFriendlyError(error);
      setError(friendlyError.message);
      console.error('Erro ao buscar métricas de startup:', error);
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleRefreshMetrics = async () => {
    toast({
      title: 'Atualizando métricas...',
      description: 'Aguarde enquanto recalculamos seus KPIs',
    });
    await fetchStartupMetrics();
    toast({
      title: 'Métricas atualizadas!',
      description: 'Todos os KPIs foram recalculados com sucesso',
    });
  };

  const basicMetricCards = [
    {
      title: 'Receitas a Receber',
      value: metrics.totalReceivables,
      description: 'Total de receitas pendentes',
      icon: TrendingUp,
      gradient: 'gradient-success',
      prefix: 'R$ ',
    },
    {
      title: 'Despesas a Pagar',
      value: metrics.totalPayables,
      description: 'Total de despesas pendentes',
      icon: TrendingDown,
      gradient: 'gradient-danger',
      prefix: 'R$ ',
    },
    {
      title: 'Saldo Projetado',
      value: metrics.balance,
      description: 'Receitas - Despesas',
      icon: DollarSign,
      gradient: 'gradient-primary',
      prefix: 'R$ ',
    },
    {
      title: 'Clientes Cadastrados',
      value: metrics.customersCount,
      description: 'Total de clientes ativos',
      icon: Users,
      gradient: 'gradient-primary',
    },
  ];

  const getHealthStatus = () => {
    if (!startupMetrics) return { color: 'text-muted-foreground', label: 'Calculando...' };
    
    const { ltvCacRatio, churnRate, runway } = startupMetrics;
    
    // Regras de saúde
    const isHealthy = ltvCacRatio >= 3 && churnRate <= 5 && runway > 18;
    const isWarning = (ltvCacRatio >= 2 && ltvCacRatio < 3) || (churnRate > 5 && churnRate <= 10) || (runway > 6 && runway <= 18);
    
    if (isHealthy) return { color: 'text-success', label: 'Saudável' };
    if (isWarning) return { color: 'text-warning', label: 'Atenção' };
    return { color: 'text-destructive', label: 'Crítico' };
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gradient-primary">
              Dashboard Financeiro
            </h1>
            <p className="text-muted-foreground mt-2">
              Visão completa da saúde financeira e KPIs de Startup
            </p>
          </div>
          <Button 
            onClick={handleRefreshMetrics} 
            disabled={metricsLoading}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${metricsLoading ? 'animate-spin' : ''}`} />
            Atualizar KPIs
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="startup" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="startup">
              <BarChart3 className="h-4 w-4 mr-2" />
              Métricas de Startup
            </TabsTrigger>
            <TabsTrigger value="financial">
              <DollarSign className="h-4 w-4 mr-2" />
              Visão Financeira
            </TabsTrigger>
            <TabsTrigger value="growth">
              <TrendingUp className="h-4 w-4 mr-2" />
              Crescimento
            </TabsTrigger>
          </TabsList>

          {/* Tab: Métricas de Startup */}
          <TabsContent value="startup" className="space-y-6">
            {/* Health Status Badge */}
            {startupMetrics && (
              <Card className="border-l-4 border-l-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Status de Saúde da Startup</CardTitle>
                      <CardDescription>
                        Baseado em LTV:CAC, Churn e Runway
                      </CardDescription>
                    </div>
                    <div className={`text-2xl font-bold ${getHealthStatus().color}`}>
                      {getHealthStatus().label}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )}

            {loading || metricsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="space-y-2">
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-8 bg-muted rounded w-3/4" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : startupMetrics ? (
              <>
                {/* Row 1: Receita */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Métricas de Receita
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StartupMetricCard
                      title="MRR"
                      value={startupMetrics.mrr}
                      description="Receita Recorrente Mensal"
                      tooltip="Monthly Recurring Revenue: receita previsível e recorrente gerada mensalmente. Fundamental para SaaS e modelos de assinatura."
                      icon={DollarSign}
                      trend={startupMetrics.mrrGrowth}
                      trendLabel="vs mês anterior"
                      gradient="gradient-success"
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title="ARR"
                      value={startupMetrics.arr}
                      description="Receita Recorrente Anual"
                      tooltip="Annual Recurring Revenue: MRR projetado para 12 meses. Métrica crucial para investidores e planejamento."
                      icon={Target}
                      gradient="gradient-primary"
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title="Receita Média"
                      value={startupMetrics.avgRevenuePerCustomer}
                      description="Por cliente/mês"
                      tooltip="Valor médio de receita gerado por cliente mensalmente. Indica o ticket médio do seu negócio."
                      icon={Users}
                      gradient="gradient-primary"
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title="Caixa Atual"
                      value={startupMetrics.cashBalance}
                      description="Saldo disponível"
                      tooltip="Total de caixa disponível atualmente. Fundamental para manter operações e crescimento."
                      icon={PiggyBank}
                      gradient={startupMetrics.cashBalance > 0 ? 'gradient-success' : 'gradient-danger'}
                      prefix="R$ "
                    />
                  </div>
                </div>

                {/* Row 2: Aquisição e Retenção */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Aquisição e Retenção
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StartupMetricCard
                      title="CAC"
                      value={startupMetrics.cac}
                      description="Custo de Aquisição de Cliente"
                      tooltip="Customer Acquisition Cost: quanto você gasta em marketing e vendas para adquirir cada novo cliente. Deve ser menor que LTV."
                      icon={TrendingDown}
                      gradient="gradient-danger"
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title="LTV"
                      value={startupMetrics.ltv}
                      description="Valor de Vida do Cliente"
                      tooltip="Lifetime Value: receita total que um cliente gera durante todo seu relacionamento com sua empresa. Ideal: LTV > 3x CAC."
                      icon={TrendingUp}
                      gradient="gradient-success"
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title="LTV:CAC"
                      value={startupMetrics.ltvCacRatio.toFixed(2)}
                      description="Razão de Eficiência"
                      tooltip="Relação entre LTV e CAC. Ideal: >3x. Se <1x, você está perdendo dinheiro em cada cliente. Se >5x, deveria investir mais em aquisição."
                      icon={Zap}
                      gradient={
                        startupMetrics.ltvCacRatio >= 3 ? 'gradient-success' :
                        startupMetrics.ltvCacRatio >= 1 ? 'gradient-warning' :
                        'gradient-danger'
                      }
                      suffix="x"
                    />

                    <StartupMetricCard
                      title="Payback"
                      value={startupMetrics.paybackPeriod.toFixed(1)}
                      description="Período de Retorno"
                      tooltip="Tempo em meses para recuperar o CAC através da receita mensal. Ideal: <12 meses para SaaS."
                      icon={Calendar}
                      gradient="gradient-primary"
                      suffix=" meses"
                    />
                  </div>
                </div>

                {/* Row 3: Crescimento e Saúde */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Crescimento e Saúde
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StartupMetricCard
                      title="Churn Rate"
                      value={startupMetrics.churnRate.toFixed(2)}
                      description="Taxa de Cancelamento"
                      tooltip="Percentual de clientes que cancelam mensalmente. Ideal: <5% para SaaS B2B, <7% para B2C. Churn alto indica problemas no produto/serviço."
                      icon={TrendingDown}
                      gradient={
                        startupMetrics.churnRate <= 5 ? 'gradient-success' :
                        startupMetrics.churnRate <= 10 ? 'gradient-warning' :
                        'gradient-danger'
                      }
                      suffix="%"
                    />

                    <StartupMetricCard
                      title="Total de Clientes"
                      value={startupMetrics.totalCustomers}
                      description="Base total"
                      tooltip="Número total de clientes cadastrados. Crescimento consistente indica tração do produto."
                      icon={Users}
                      gradient="gradient-primary"
                    />

                    <StartupMetricCard
                      title="Clientes Ativos"
                      value={startupMetrics.activeCustomers}
                      description="Com transações recentes"
                      tooltip="Clientes que realizaram transações nos últimos 60 dias. Indica engajamento real com o produto."
                      icon={Zap}
                      gradient="gradient-success"
                    />

                    <StartupMetricCard
                      title="Novos este Mês"
                      value={startupMetrics.newCustomersThisMonth}
                      description="Clientes adquiridos"
                      tooltip="Novos clientes conquistados no mês atual. Mede efetividade dos esforços de aquisição."
                      icon={TrendingUp}
                      gradient="gradient-primary"
                    />
                  </div>
                </div>

                {/* Row 4: Burn e Runway */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Sustentabilidade
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <StartupMetricCard
                      title="Burn Rate"
                      value={Math.abs(startupMetrics.burnRate)}
                      description="Queima de caixa mensal"
                      tooltip="Quanto você gasta além do que gera em receita por mês. Negativo indica lucro, positivo indica queima de capital."
                      icon={TrendingDown}
                      gradient={startupMetrics.burnRate < 0 ? 'gradient-success' : 'gradient-danger'}
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title="Runway"
                      value={startupMetrics.runway > 100 ? '∞' : startupMetrics.runway.toFixed(0)}
                      description="Meses até acabar o caixa"
                      tooltip="Quanto tempo você pode operar com o caixa atual no ritmo de queima atual. Ideal: >18 meses. <6 meses é crítico."
                      icon={Calendar}
                      gradient={
                        startupMetrics.runway > 18 || startupMetrics.burnRate < 0 ? 'gradient-success' :
                        startupMetrics.runway > 6 ? 'gradient-warning' :
                        'gradient-danger'
                      }
                      suffix={startupMetrics.runway <= 100 ? ' meses' : ''}
                    />
                  </div>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                    <p>Não foi possível carregar as métricas de startup.</p>
                    <p className="text-sm mt-2">Clique em "Atualizar KPIs" para tentar novamente.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Growth Chart */}
            {startupMetrics && (
              <MetricsChart
                title="Evolução MRR e Clientes"
                description="Tendência de crescimento nos últimos 6 meses"
                data={chartData}
              />
            )}
          </TabsContent>

          {/* Tab: Visão Financeira */}
          <TabsContent value="financial" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {basicMetricCards.map((card) => (
                <Card key={card.title} className="relative overflow-hidden group hover:shadow-glow transition-all">
                  <div className={`absolute inset-0 ${card.gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {card.title}
                    </CardTitle>
                    <card.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {card.prefix}{card.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <CardDescription className="text-xs">
                      {card.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bem-vindo ao FAS AI</CardTitle>
                <CardDescription>
                  Gerencie suas transações financeiras com facilidade e segurança
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use o menu lateral para navegar entre as diferentes funcionalidades da plataforma.
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Registre transações com cálculo automático de impostos</li>
                  <li>Cadastre clientes (Pessoa Física ou Jurídica)</li>
                  <li>Visualize projeções de fluxo de caixa</li>
                  <li>Acompanhe métricas de startup em tempo real</li>
                  <li>Todas as ações são auditadas e seguras</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Crescimento */}
          <TabsContent value="growth" className="space-y-6">
            {startupMetrics && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Crescimento MRR</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {startupMetrics.mrrGrowth > 0 ? '+' : ''}{startupMetrics.mrrGrowth.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        vs mês anterior
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Taxa de Crescimento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {((startupMetrics.newCustomersThisMonth / Math.max(startupMetrics.totalCustomers - startupMetrics.newCustomersThisMonth, 1)) * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Novos clientes / Base anterior
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Retenção</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {(100 - startupMetrics.churnRate).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Clientes mantidos
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <MetricsChart
                  title="Evolução MRR e Base de Clientes"
                  description="Acompanhe o crescimento da sua startup"
                  data={chartData}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
