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
  PiggyBank,
  Languages
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StartupMetricCard } from '@/components/dashboard/StartupMetricCard';
import { MetricsChart } from '@/components/dashboard/MetricsChart';
import { getFriendlyError } from '@/lib/errorMessages';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

type Language = 'pt' | 'en' | 'es';

const translations = {
  pt: {
    title: 'Dashboard Financeiro',
    subtitle: 'Visão completa da saúde financeira e KPIs de Startup',
    refreshKPIs: 'Atualizar KPIs',
    startupMetrics: 'Métricas de Startup',
    growth: 'Crescimento',
    healthStatus: 'Status de Saúde da Startup',
    healthBased: 'Baseado em LTV:CAC, Churn e Runway',
    healthy: 'Saudável',
    warning: 'Atenção',
    critical: 'Crítico',
    calculating: 'Calculando...',
    revenueMetrics: 'Métricas de Receita',
    mrr: 'MRR',
    mrrDesc: 'Receita Recorrente Mensal',
    mrrTooltip: 'Monthly Recurring Revenue: receita previsível e recorrente gerada mensalmente. Fundamental para SaaS e modelos de assinatura.',
    arr: 'ARR',
    arrDesc: 'Receita Recorrente Anual',
    arrTooltip: 'Annual Recurring Revenue: MRR projetado para 12 meses. Métrica crucial para investidores e planejamento.',
    avgRevenue: 'Receita Média',
    avgRevenueDesc: 'Por cliente/mês',
    avgRevenueTooltip: 'Valor médio de receita gerado por cliente mensalmente. Indica o ticket médio do seu negócio.',
    currentCash: 'Caixa Atual',
    currentCashDesc: 'Saldo disponível',
    currentCashTooltip: 'Total de caixa disponível atualmente. Fundamental para manter operações e crescimento.',
    acquisitionRetention: 'Aquisição e Retenção',
    cac: 'CAC',
    cacDesc: 'Custo de Aquisição de Cliente',
    cacTooltip: 'Customer Acquisition Cost: quanto você gasta em marketing e vendas para adquirir cada novo cliente. Deve ser menor que LTV.',
    ltv: 'LTV',
    ltvDesc: 'Valor de Vida do Cliente',
    ltvTooltip: 'Lifetime Value: receita total que um cliente gera durante todo seu relacionamento com sua empresa. Ideal: LTV > 3x CAC.',
    ltvCac: 'LTV:CAC',
    ltvCacDesc: 'Razão de Eficiência',
    ltvCacTooltip: 'Relação entre LTV e CAC. Ideal: >3x. Se <1x, você está perdendo dinheiro em cada cliente. Se >5x, deveria investir mais em aquisição.',
    payback: 'Payback',
    paybackDesc: 'Período de Retorno',
    paybackTooltip: 'Tempo em meses para recuperar o CAC através da receita mensal. Ideal: <12 meses para SaaS.',
    growthHealth: 'Crescimento e Saúde',
    churnRate: 'Churn Rate',
    churnRateDesc: 'Taxa de Cancelamento',
    churnRateTooltip: 'Percentual de clientes que cancelam mensalmente. Ideal: <5% para SaaS B2B, <7% para B2C. Churn alto indica problemas no produto/serviço.',
    totalCustomers: 'Total de Clientes',
    totalCustomersDesc: 'Base total',
    totalCustomersTooltip: 'Número total de clientes cadastrados. Crescimento consistente indica tração do produto.',
    activeCustomers: 'Clientes Ativos',
    activeCustomersDesc: 'Com transações recentes',
    activeCustomersTooltip: 'Clientes que realizaram transações nos últimos 60 dias. Indica engajamento real com o produto.',
    newThisMonth: 'Novos este Mês',
    newThisMonthDesc: 'Clientes adquiridos',
    newThisMonthTooltip: 'Novos clientes conquistados no mês atual. Mede efetividade dos esforços de aquisição.',
    sustainability: 'Sustentabilidade',
    burnRate: 'Burn Rate',
    burnRateDesc: 'Queima de caixa mensal',
    burnRateTooltip: 'Quanto você gasta além do que gera em receita por mês. Negativo indica lucro, positivo indica queima de capital.',
    runway: 'Runway',
    runwayDesc: 'Meses até acabar o caixa',
    runwayTooltip: 'Quanto tempo você pode operar com o caixa atual no ritmo de queima atual. Ideal: >18 meses. <6 meses é crítico.',
    months: 'meses',
    vsPrevMonth: 'vs mês anterior',
    chartTitle: 'Evolução MRR e Clientes',
    chartDesc: 'Tendência de crescimento nos últimos 6 meses',
    mrrGrowth: 'Crescimento MRR',
    growthRate: 'Taxa de Crescimento',
    retention: 'Retenção',
    customersKept: 'Clientes mantidos',
    newCustomersPrev: 'Novos clientes / Base anterior',
    chartTitleGrowth: 'Evolução MRR e Base de Clientes',
    chartDescGrowth: 'Acompanhe o crescimento da sua startup',
    updatingMetrics: 'Atualizando métricas...',
    updatingDesc: 'Aguarde enquanto recalculamos seus KPIs',
    metricsUpdated: 'Métricas atualizadas!',
    metricsUpdatedDesc: 'Todos os KPIs foram recalculados com sucesso',
    noMetrics: 'Não foi possível carregar as métricas de startup.',
    noMetricsDesc: 'Clique em "Atualizar KPIs" para tentar novamente.',
  },
  en: {
    title: 'Financial Dashboard',
    subtitle: 'Complete view of financial health and Startup KPIs',
    refreshKPIs: 'Refresh KPIs',
    startupMetrics: 'Startup Metrics',
    growth: 'Growth',
    healthStatus: 'Startup Health Status',
    healthBased: 'Based on LTV:CAC, Churn and Runway',
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
    calculating: 'Calculating...',
    revenueMetrics: 'Revenue Metrics',
    mrr: 'MRR',
    mrrDesc: 'Monthly Recurring Revenue',
    mrrTooltip: 'Monthly Recurring Revenue: predictable recurring revenue generated monthly. Essential for SaaS and subscription models.',
    arr: 'ARR',
    arrDesc: 'Annual Recurring Revenue',
    arrTooltip: 'Annual Recurring Revenue: MRR projected for 12 months. Critical metric for investors and planning.',
    avgRevenue: 'Average Revenue',
    avgRevenueDesc: 'Per customer/month',
    avgRevenueTooltip: 'Average revenue generated per customer monthly. Indicates your average ticket.',
    currentCash: 'Current Cash',
    currentCashDesc: 'Available balance',
    currentCashTooltip: 'Total cash currently available. Essential to maintain operations and growth.',
    acquisitionRetention: 'Acquisition and Retention',
    cac: 'CAC',
    cacDesc: 'Customer Acquisition Cost',
    cacTooltip: 'Customer Acquisition Cost: how much you spend on marketing and sales to acquire each new customer. Should be lower than LTV.',
    ltv: 'LTV',
    ltvDesc: 'Customer Lifetime Value',
    ltvTooltip: 'Lifetime Value: total revenue a customer generates throughout their relationship with your company. Ideal: LTV > 3x CAC.',
    ltvCac: 'LTV:CAC',
    ltvCacDesc: 'Efficiency Ratio',
    ltvCacTooltip: 'Relationship between LTV and CAC. Ideal: >3x. If <1x, you are losing money on each customer. If >5x, you should invest more in acquisition.',
    payback: 'Payback',
    paybackDesc: 'Payback Period',
    paybackTooltip: 'Time in months to recover CAC through monthly revenue. Ideal: <12 months for SaaS.',
    growthHealth: 'Growth and Health',
    churnRate: 'Churn Rate',
    churnRateDesc: 'Cancellation Rate',
    churnRateTooltip: 'Percentage of customers who cancel monthly. Ideal: <5% for B2B SaaS, <7% for B2C. High churn indicates product/service issues.',
    totalCustomers: 'Total Customers',
    totalCustomersDesc: 'Total base',
    totalCustomersTooltip: 'Total number of registered customers. Consistent growth indicates product traction.',
    activeCustomers: 'Active Customers',
    activeCustomersDesc: 'With recent transactions',
    activeCustomersTooltip: 'Customers who made transactions in the last 60 days. Indicates real product engagement.',
    newThisMonth: 'New This Month',
    newThisMonthDesc: 'Acquired customers',
    newThisMonthTooltip: 'New customers acquired in the current month. Measures effectiveness of acquisition efforts.',
    sustainability: 'Sustainability',
    burnRate: 'Burn Rate',
    burnRateDesc: 'Monthly cash burn',
    burnRateTooltip: 'How much you spend beyond what you generate in revenue per month. Negative indicates profit, positive indicates capital burn.',
    runway: 'Runway',
    runwayDesc: 'Months until cash runs out',
    runwayTooltip: 'How long you can operate with current cash at the current burn rate. Ideal: >18 months. <6 months is critical.',
    months: 'months',
    vsPrevMonth: 'vs previous month',
    chartTitle: 'MRR and Customers Evolution',
    chartDesc: 'Growth trend over the last 6 months',
    mrrGrowth: 'MRR Growth',
    growthRate: 'Growth Rate',
    retention: 'Retention',
    customersKept: 'Customers retained',
    newCustomersPrev: 'New customers / Previous base',
    chartTitleGrowth: 'MRR and Customer Base Evolution',
    chartDescGrowth: 'Track your startup growth',
    updatingMetrics: 'Updating metrics...',
    updatingDesc: 'Please wait while we recalculate your KPIs',
    metricsUpdated: 'Metrics updated!',
    metricsUpdatedDesc: 'All KPIs have been successfully recalculated',
    noMetrics: 'Could not load startup metrics.',
    noMetricsDesc: 'Click "Refresh KPIs" to try again.',
  },
  es: {
    title: 'Panel Financiero',
    subtitle: 'Vista completa de la salud financiera y KPIs de Startup',
    refreshKPIs: 'Actualizar KPIs',
    startupMetrics: 'Métricas de Startup',
    growth: 'Crecimiento',
    healthStatus: 'Estado de Salud de la Startup',
    healthBased: 'Basado en LTV:CAC, Churn y Runway',
    healthy: 'Saludable',
    warning: 'Advertencia',
    critical: 'Crítico',
    calculating: 'Calculando...',
    revenueMetrics: 'Métricas de Ingresos',
    mrr: 'MRR',
    mrrDesc: 'Ingresos Recurrentes Mensuales',
    mrrTooltip: 'Monthly Recurring Revenue: ingresos predecibles y recurrentes generados mensualmente. Fundamental para SaaS y modelos de suscripción.',
    arr: 'ARR',
    arrDesc: 'Ingresos Recurrentes Anuales',
    arrTooltip: 'Annual Recurring Revenue: MRR proyectado para 12 meses. Métrica crucial para inversores y planificación.',
    avgRevenue: 'Ingreso Promedio',
    avgRevenueDesc: 'Por cliente/mes',
    avgRevenueTooltip: 'Valor promedio de ingresos generado por cliente mensualmente. Indica el ticket promedio de su negocio.',
    currentCash: 'Caja Actual',
    currentCashDesc: 'Saldo disponible',
    currentCashTooltip: 'Total de caja disponible actualmente. Fundamental para mantener operaciones y crecimiento.',
    acquisitionRetention: 'Adquisición y Retención',
    cac: 'CAC',
    cacDesc: 'Costo de Adquisición de Cliente',
    cacTooltip: 'Customer Acquisition Cost: cuánto gastas en marketing y ventas para adquirir cada nuevo cliente. Debe ser menor que LTV.',
    ltv: 'LTV',
    ltvDesc: 'Valor de Vida del Cliente',
    ltvTooltip: 'Lifetime Value: ingresos totales que un cliente genera durante toda su relación con su empresa. Ideal: LTV > 3x CAC.',
    ltvCac: 'LTV:CAC',
    ltvCacDesc: 'Razón de Eficiencia',
    ltvCacTooltip: 'Relación entre LTV y CAC. Ideal: >3x. Si <1x, estás perdiendo dinero en cada cliente. Si >5x, deberías invertir más en adquisición.',
    payback: 'Payback',
    paybackDesc: 'Período de Retorno',
    paybackTooltip: 'Tiempo en meses para recuperar el CAC a través de los ingresos mensuales. Ideal: <12 meses para SaaS.',
    growthHealth: 'Crecimiento y Salud',
    churnRate: 'Tasa de Churn',
    churnRateDesc: 'Tasa de Cancelación',
    churnRateTooltip: 'Porcentaje de clientes que cancelan mensualmente. Ideal: <5% para SaaS B2B, <7% para B2C. Alto churn indica problemas en el producto/servicio.',
    totalCustomers: 'Total de Clientes',
    totalCustomersDesc: 'Base total',
    totalCustomersTooltip: 'Número total de clientes registrados. Crecimiento consistente indica tracción del producto.',
    activeCustomers: 'Clientes Activos',
    activeCustomersDesc: 'Con transacciones recientes',
    activeCustomersTooltip: 'Clientes que realizaron transacciones en los últimos 60 días. Indica compromiso real con el producto.',
    newThisMonth: 'Nuevos este Mes',
    newThisMonthDesc: 'Clientes adquiridos',
    newThisMonthTooltip: 'Nuevos clientes conquistados en el mes actual. Mide la efectividad de los esfuerzos de adquisición.',
    sustainability: 'Sostenibilidad',
    burnRate: 'Burn Rate',
    burnRateDesc: 'Quema de caja mensual',
    burnRateTooltip: 'Cuánto gastas más allá de lo que generas en ingresos por mes. Negativo indica beneficio, positivo indica quema de capital.',
    runway: 'Runway',
    runwayDesc: 'Meses hasta agotar la caja',
    runwayTooltip: 'Cuánto tiempo puedes operar con la caja actual al ritmo de quema actual. Ideal: >18 meses. <6 meses es crítico.',
    months: 'meses',
    vsPrevMonth: 'vs mes anterior',
    chartTitle: 'Evolución MRR y Clientes',
    chartDesc: 'Tendencia de crecimiento en los últimos 6 meses',
    mrrGrowth: 'Crecimiento MRR',
    growthRate: 'Tasa de Crecimiento',
    retention: 'Retención',
    customersKept: 'Clientes mantenidos',
    newCustomersPrev: 'Nuevos clientes / Base anterior',
    chartTitleGrowth: 'Evolución MRR y Base de Clientes',
    chartDescGrowth: 'Acompaña el crecimiento de tu startup',
    updatingMetrics: 'Actualizando métricas...',
    updatingDesc: 'Espere mientras recalculamos sus KPIs',
    metricsUpdated: '¡Métricas actualizadas!',
    metricsUpdatedDesc: 'Todos los KPIs han sido recalculados con éxito',
    noMetrics: 'No se pudieron cargar las métricas de startup.',
    noMetricsDesc: 'Haga clic en "Actualizar KPIs" para intentar nuevamente.',
  },
};

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
  const [language, setLanguage] = useState<Language>('pt');
  const { toast } = useToast();
  
  const t = translations[language];

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
      title: t.updatingMetrics,
      description: t.updatingDesc,
    });
    await fetchStartupMetrics();
    toast({
      title: t.metricsUpdated,
      description: t.metricsUpdatedDesc,
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
    if (!startupMetrics) return { color: 'text-muted-foreground', label: t.calculating };
    
    const { ltvCacRatio, churnRate, runway } = startupMetrics;
    
    // Regras de saúde
    const isHealthy = ltvCacRatio >= 3 && churnRate <= 5 && runway > 18;
    const isWarning = (ltvCacRatio >= 2 && ltvCacRatio < 3) || (churnRate > 5 && churnRate <= 10) || (runway > 6 && runway <= 18);
    
    if (isHealthy) return { color: 'text-success', label: t.healthy };
    if (isWarning) return { color: 'text-warning', label: t.warning };
    return { color: 'text-destructive', label: t.critical };
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gradient-primary">
              {t.title}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t.subtitle}
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Languages className="h-4 w-4" />
                  {language === 'pt' ? 'Português' : language === 'en' ? 'English' : 'Español'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLanguage('pt')}>
                  Português
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('en')}>
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('es')}>
                  Español
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              onClick={handleRefreshMetrics} 
              disabled={metricsLoading}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${metricsLoading ? 'animate-spin' : ''}`} />
              {t.refreshKPIs}
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="startup" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="startup">
              <BarChart3 className="h-4 w-4 mr-2" />
              {t.startupMetrics}
            </TabsTrigger>
            <TabsTrigger value="growth">
              <TrendingUp className="h-4 w-4 mr-2" />
              {t.growth}
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
                      <CardTitle>{t.healthStatus}</CardTitle>
                      <CardDescription>
                        {t.healthBased}
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
                    {t.revenueMetrics}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StartupMetricCard
                      title={t.mrr}
                      value={startupMetrics.mrr}
                      description={t.mrrDesc}
                      tooltip={t.mrrTooltip}
                      icon={DollarSign}
                      trend={startupMetrics.mrrGrowth}
                      trendLabel={t.vsPrevMonth}
                      gradient="gradient-success"
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title={t.arr}
                      value={startupMetrics.arr}
                      description={t.arrDesc}
                      tooltip={t.arrTooltip}
                      icon={Target}
                      gradient="gradient-primary"
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title={t.avgRevenue}
                      value={startupMetrics.avgRevenuePerCustomer}
                      description={t.avgRevenueDesc}
                      tooltip={t.avgRevenueTooltip}
                      icon={Users}
                      gradient="gradient-primary"
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title={t.currentCash}
                      value={startupMetrics.cashBalance}
                      description={t.currentCashDesc}
                      tooltip={t.currentCashTooltip}
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
                    {t.acquisitionRetention}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StartupMetricCard
                      title={t.cac}
                      value={startupMetrics.cac}
                      description={t.cacDesc}
                      tooltip={t.cacTooltip}
                      icon={TrendingDown}
                      gradient="gradient-danger"
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title={t.ltv}
                      value={startupMetrics.ltv}
                      description={t.ltvDesc}
                      tooltip={t.ltvTooltip}
                      icon={TrendingUp}
                      gradient="gradient-success"
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title={t.ltvCac}
                      value={startupMetrics.ltvCacRatio.toFixed(2)}
                      description={t.ltvCacDesc}
                      tooltip={t.ltvCacTooltip}
                      icon={Zap}
                      gradient={
                        startupMetrics.ltvCacRatio >= 3 ? 'gradient-success' :
                        startupMetrics.ltvCacRatio >= 1 ? 'gradient-warning' :
                        'gradient-danger'
                      }
                      suffix="x"
                    />

                    <StartupMetricCard
                      title={t.payback}
                      value={startupMetrics.paybackPeriod.toFixed(1)}
                      description={t.paybackDesc}
                      tooltip={t.paybackTooltip}
                      icon={Calendar}
                      gradient="gradient-primary"
                      suffix={` ${t.months}`}
                    />
                  </div>
                </div>

                {/* Row 3: Crescimento e Saúde */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {t.growthHealth}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StartupMetricCard
                      title={t.churnRate}
                      value={startupMetrics.churnRate.toFixed(2)}
                      description={t.churnRateDesc}
                      tooltip={t.churnRateTooltip}
                      icon={TrendingDown}
                      gradient={
                        startupMetrics.churnRate <= 5 ? 'gradient-success' :
                        startupMetrics.churnRate <= 10 ? 'gradient-warning' :
                        'gradient-danger'
                      }
                      suffix="%"
                    />

                    <StartupMetricCard
                      title={t.totalCustomers}
                      value={startupMetrics.totalCustomers}
                      description={t.totalCustomersDesc}
                      tooltip={t.totalCustomersTooltip}
                      icon={Users}
                      gradient="gradient-primary"
                    />

                    <StartupMetricCard
                      title={t.activeCustomers}
                      value={startupMetrics.activeCustomers}
                      description={t.activeCustomersDesc}
                      tooltip={t.activeCustomersTooltip}
                      icon={Zap}
                      gradient="gradient-success"
                    />

                    <StartupMetricCard
                      title={t.newThisMonth}
                      value={startupMetrics.newCustomersThisMonth}
                      description={t.newThisMonthDesc}
                      tooltip={t.newThisMonthTooltip}
                      icon={TrendingUp}
                      gradient="gradient-primary"
                    />
                  </div>
                </div>

                {/* Row 4: Burn e Runway */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    {t.sustainability}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <StartupMetricCard
                      title={t.burnRate}
                      value={Math.abs(startupMetrics.burnRate)}
                      description={t.burnRateDesc}
                      tooltip={t.burnRateTooltip}
                      icon={TrendingDown}
                      gradient={startupMetrics.burnRate < 0 ? 'gradient-success' : 'gradient-danger'}
                      prefix="R$ "
                    />

                    <StartupMetricCard
                      title={t.runway}
                      value={startupMetrics.runway > 100 ? '∞' : startupMetrics.runway.toFixed(0)}
                      description={t.runwayDesc}
                      tooltip={t.runwayTooltip}
                      icon={Calendar}
                      gradient={
                        startupMetrics.runway > 18 || startupMetrics.burnRate < 0 ? 'gradient-success' :
                        startupMetrics.runway > 6 ? 'gradient-warning' :
                        'gradient-danger'
                      }
                      suffix={startupMetrics.runway <= 100 ? ` ${t.months}` : ''}
                    />
                  </div>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                    <p>{t.noMetrics}</p>
                    <p className="text-sm mt-2">{t.noMetricsDesc}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Growth Chart */}
            {startupMetrics && (
              <MetricsChart
                title={t.chartTitle}
                description={t.chartDesc}
                data={chartData}
              />
            )}
          </TabsContent>

          {/* Tab: Crescimento */}
          <TabsContent value="growth" className="space-y-6">
            {startupMetrics && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">{t.mrrGrowth}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {startupMetrics.mrrGrowth > 0 ? '+' : ''}{startupMetrics.mrrGrowth.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.vsPrevMonth}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">{t.growthRate}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {((startupMetrics.newCustomersThisMonth / Math.max(startupMetrics.totalCustomers - startupMetrics.newCustomersThisMonth, 1)) * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.newCustomersPrev}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">{t.retention}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {(100 - startupMetrics.churnRate).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.customersKept}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <MetricsChart
                  title={t.chartTitleGrowth}
                  description={t.chartDescGrowth}
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
