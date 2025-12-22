import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, RefreshCw, Server, Users, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ErrorRateCard } from '@/components/observability/ErrorRateCard';
import { LatencyChart } from '@/components/observability/LatencyChart';
import { LogsTable } from '@/components/observability/LogsTable';
import { AlertsPanel } from '@/components/observability/AlertsPanel';
import { SkeletonCard } from '@/components/ui/skeleton-card';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  function_name?: string;
  error_stack?: string;
  context?: Record<string, unknown>;
  duration_ms?: number;
}

interface Alert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
  resolved: boolean;
  resolved_at?: string;
  metadata?: Record<string, unknown>;
}

export default function Observability() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch logs
  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['application-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('application_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as LogEntry[];
    },
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  // Fetch alerts
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['observability-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cfo_alerts')
        .select('*')
        .or('metadata->>alert_type.eq.high_error_rate,metadata->>alert_type.eq.observability_alert')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []).map(alert => ({
        ...alert,
        severity: alert.severity as 'info' | 'warning' | 'critical',
      })) as Alert[];
    },
    refetchInterval: 30000,
  });

  // Resolve alert mutation
  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('cfo_alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observability-alerts'] });
      toast({ title: 'Alerta resolvido com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro ao resolver alerta', variant: 'destructive' });
    },
  });

  // Calcular métricas
  const errorLogs = logs.filter(l => l.level === 'error');
  const last24hLogs = logs.filter(l => 
    new Date(l.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const last24hErrors = errorLogs.filter(l =>
    new Date(l.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const errorRate = last24hLogs.length > 0 
    ? (last24hErrors.length / last24hLogs.length) * 100 
    : 0;

  // Calcular latência por hora
  const latencyByHour = (() => {
    const hourlyData: Record<string, number[]> = {};
    
    logs
      .filter(l => l.duration_ms !== null && l.duration_ms !== undefined)
      .forEach(log => {
        const hour = new Date(log.timestamp);
        hour.setMinutes(0, 0, 0);
        const key = hour.toISOString();
        
        if (!hourlyData[key]) hourlyData[key] = [];
        hourlyData[key].push(log.duration_ms!);
      });

    return Object.entries(hourlyData)
      .map(([hour, latencies]) => {
        const sorted = [...latencies].sort((a, b) => a - b);
        return {
          hour,
          p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
          p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
          p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
        };
      })
      .sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime())
      .slice(-24);
  })();

  // Estatísticas gerais
  const totalLogs = logs.length;
  const uniqueUsers = new Set(logs.filter(l => l.context?.user_id).map(l => l.context?.user_id as string)).size;
  const avgLatency = logs.filter(l => l.duration_ms).reduce((acc, l) => acc + (l.duration_ms || 0), 0) / 
    (logs.filter(l => l.duration_ms).length || 1);

  const handleRefresh = () => {
    refetchLogs();
    refetchAlerts();
    toast({ title: 'Dados atualizados' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Observabilidade</h1>
            <p className="text-muted-foreground">Monitore a saúde e performance do sistema</p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {logsLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : (
                <>
                  <ErrorRateCard
                    totalErrors={last24hErrors.length}
                    errorRate={errorRate}
                    trend={errorRate > 1 ? 'up' : 'stable'}
                    trendValue={errorRate}
                  />
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalLogs.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">últimos 7 dias</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{uniqueUsers}</div>
                      <p className="text-xs text-muted-foreground">com atividade registrada</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Latência Média</CardTitle>
                      <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{avgLatency.toFixed(0)}ms</div>
                      <p className="text-xs text-muted-foreground">tempo de resposta</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <LatencyChart data={latencyByHour} />
              
              <AlertsPanel
                alerts={alerts}
                onResolve={(id) => resolveAlertMutation.mutate(id)}
                isLoading={alertsLoading}
              />
            </div>

            {/* Recent Errors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Erros Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LogsTable 
                  logs={errorLogs.slice(0, 10)} 
                  isLoading={logsLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <LogsTable logs={logs} isLoading={logsLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AlertsPanel
                alerts={alerts}
                onResolve={(id) => resolveAlertMutation.mutate(id)}
                isLoading={alertsLoading}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Configuração de Alertas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg border">
                    <p className="font-medium">Taxa de Erros</p>
                    <p className="text-sm text-muted-foreground">
                      Alerta quando &gt; 10 erros em 5 minutos ou &gt; 50 erros em 1 hora
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="font-medium">Latência Alta</p>
                    <p className="text-sm text-muted-foreground">
                      Alerta quando P95 &gt; 5000ms
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="font-medium">Erros por Função</p>
                    <p className="text-sm text-muted-foreground">
                      Alerta quando uma função tem &gt; 5 erros por hora
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
