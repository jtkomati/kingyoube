import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PredictionCard } from '@/components/predictive/PredictionCard';
import { ProjectionChart } from '@/components/predictive/ProjectionChart';
import { ConfidenceIndicator } from '@/components/predictive/ConfidenceIndicator';
import { InsightCard } from '@/components/predictive/InsightCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  BrainCircuit, 
  TrendingUp, 
  DollarSign, 
  Wallet,
  RefreshCw,
  Calendar,
  PieChart
} from 'lucide-react';

interface Projection {
  month: string;
  pessimistic: number;
  realistic: number;
  optimistic: number;
}

interface HistoricalData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  cashflow: number;
}

interface AnalyticsData {
  historical: HistoricalData[];
  projections: {
    revenue: Projection[];
    pl: Projection[];
    cashflow: Projection[];
  };
  kpis: {
    sixMonthRevenue: number;
    sixMonthProfit: number;
    projectedCashBalance: number;
    profitMargin: number;
    confidenceScore: number;
  };
  insights: string[];
  alerts: string[];
  generatedAt: string;
}

export default function PredictiveAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/predictive-analytics`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao carregar análises');
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Erro ao carregar análises preditivas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  // Prepare chart data combining historical and projections
  const prepareRevenueChartData = () => {
    if (!data) return [];
    
    const historicalPoints = data.historical.map(h => ({
      month: h.month,
      historical: h.revenue,
    }));

    const projectionPoints = data.projections.revenue.map(p => ({
      month: p.month,
      pessimistic: p.pessimistic,
      realistic: p.realistic,
      optimistic: p.optimistic,
    }));

    return [...historicalPoints, ...projectionPoints];
  };

  const preparePLChartData = () => {
    if (!data) return [];

    const historicalPoints = data.historical.map(h => ({
      month: h.month,
      revenue: h.revenue,
      expenses: h.expenses,
      profit: h.profit,
    }));

    const projectionPoints = data.projections.pl.map((p, index) => ({
      month: p.month,
      revenue: data.projections.revenue[index]?.realistic || 0,
      expenses: (data.projections.revenue[index]?.realistic || 0) - p.realistic,
      profit: p.realistic,
    }));

    return [...historicalPoints, ...projectionPoints];
  };

  const prepareCashflowChartData = () => {
    if (!data) return [];

    const historicalPoints = data.historical.map(h => ({
      month: h.month,
      historical: h.cashflow,
    }));

    const projectionPoints = data.projections.cashflow.map(p => ({
      month: p.month,
      pessimistic: p.pessimistic,
      realistic: p.realistic,
      optimistic: p.optimistic,
    }));

    return [...historicalPoints, ...projectionPoints];
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-80" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BrainCircuit className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Análise Preditiva</h1>
              <p className="text-sm text-muted-foreground">
                Projeções inteligentes para os próximos 6 meses
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data?.generatedAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Atualizado: {new Date(data.generatedAt).toLocaleString('pt-BR')}
              </span>
            )}
            <Button 
              onClick={handleRefresh} 
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Confidence Indicator */}
        {data && (
          <ConfidenceIndicator score={data.kpis.confidenceScore} />
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PredictionCard
            title="Faturamento Projetado (6M)"
            value={data?.kpis.sixMonthRevenue || 0}
            subtitle="Cenário realista"
            trend={data?.kpis.sixMonthRevenue && data.kpis.sixMonthRevenue > 0 ? 'up' : 'neutral'}
            trendValue={data?.kpis.sixMonthRevenue && data.kpis.sixMonthRevenue > 0 ? '+6 meses' : undefined}
            icon={<DollarSign className="h-5 w-5" />}
          />
          <PredictionCard
            title="Lucro Líquido Projetado"
            value={data?.kpis.sixMonthProfit || 0}
            subtitle="Próximos 6 meses"
            trend={data?.kpis.sixMonthProfit && data.kpis.sixMonthProfit > 0 ? 'up' : data?.kpis.sixMonthProfit && data.kpis.sixMonthProfit < 0 ? 'down' : 'neutral'}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <PredictionCard
            title="Saldo de Caixa Projetado"
            value={data?.kpis.projectedCashBalance || 0}
            subtitle="Ao final do período"
            trend={data?.kpis.projectedCashBalance && data.kpis.projectedCashBalance > 0 ? 'up' : 'down'}
            icon={<Wallet className="h-5 w-5" />}
          />
          <PredictionCard
            title="Margem de Lucro"
            value={data?.kpis.profitMargin || 0}
            subtitle="Média projetada"
            format="percentage"
            trend={data?.kpis.profitMargin && data.kpis.profitMargin > 15 ? 'up' : data?.kpis.profitMargin && data.kpis.profitMargin > 0 ? 'neutral' : 'down'}
            icon={<PieChart className="h-5 w-5" />}
          />
        </div>

        {/* Revenue Projection Chart */}
        <ProjectionChart
          title="Projeção de Faturamento"
          description="Histórico e cenários projetados (pessimista, realista, otimista)"
          data={prepareRevenueChartData()}
          type="area"
          showHistorical
        />

        {/* P&L and Cashflow Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProjectionChart
            title="Projeção de P&L"
            description="Receitas, despesas e lucro projetados"
            data={preparePLChartData()}
            type="composed"
          />
          <ProjectionChart
            title="Projeção de Cashflow"
            description="Fluxo de caixa acumulado"
            data={prepareCashflowChartData()}
            type="area"
            showHistorical
          />
        </div>

        {/* Insights and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InsightCard 
            insights={data?.insights || []} 
            alerts={data?.alerts || []}
          />
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-primary" />
                Sobre as Projeções
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• <strong>Pessimista:</strong> Cenário com redução de 15% nas métricas</li>
                <li>• <strong>Realista:</strong> Projeção baseada em tendências históricas</li>
                <li>• <strong>Otimista:</strong> Cenário com crescimento de 20%</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4">
                As projeções são geradas usando inteligência artificial com base nos dados 
                históricos de transações. Quanto mais dados disponíveis, maior a precisão.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
