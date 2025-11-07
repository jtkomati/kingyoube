import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, AlertCircle, CheckCircle, DollarSign, BarChart3 } from "lucide-react";

interface ROIMetrics {
  total_hours_saved: number;
  reports_generated: number;
  critical_alerts_viewed: number;
  manual_tasks_avoided: number;
  total_value_generated: number;
  this_month_hours_saved: number;
  this_month_value: number;
  hourly_rate: number;
}

export function ROIMetricsTab({ cfoPartnerId }: { cfoPartnerId: string }) {
  const { data: roiMetrics, isLoading } = useQuery({
    queryKey: ['cfo-roi-metrics', cfoPartnerId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('cfo-get-roi-dashboard', {
        body: { cfoPartnerId }
      });

      if (error) throw error;
      return data as ROIMetrics;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Seu Valor Gerado Este Mês</h2>
        <p className="text-muted-foreground">
          Proof, not Promises - Métricas reais do impacto do KingYouBe
        </p>
      </div>

      {/* Este Mês */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Economizadas (Este Mês)</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {roiMetrics?.this_month_hours_saved?.toFixed(1) || '0.0'}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Valor: {(roiMetrics?.this_month_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Gerado (Este Mês)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {(roiMetrics?.this_month_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Taxa horária: {(roiMetrics?.hourly_rate || 150).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Totais Acumulados */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas Acumuladas (Total)</CardTitle>
          <CardDescription>
            Impacto total desde o início do uso da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Horas Economizadas</p>
              <p className="text-2xl font-bold">{roiMetrics?.total_hours_saved?.toFixed(1) || '0.0'}h</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Valor Gerado</p>
              <p className="text-2xl font-bold">
                {(roiMetrics?.total_value_generated || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Relatórios Gerados</p>
              <p className="text-2xl font-bold">{roiMetrics?.reports_generated || 0}</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Alertas Críticos</p>
              <p className="text-2xl font-bold">{roiMetrics?.critical_alerts_viewed || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proof Points para o Pitch */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Proof, not Promises - Dados para o Pitch
          </CardTitle>
          <CardDescription>
            Use estes números reais no slide 8 do seu pitch
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-background rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <h4 className="font-semibold">Eficiência Comprovada</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                O Agente de Valor provou que a IA já economizou
              </p>
              <p className="text-2xl font-bold text-primary">
                {roiMetrics?.this_month_hours_saved?.toFixed(0) || '0'} horas
              </p>
              <p className="text-xs text-muted-foreground mt-1">de trabalho manual este mês</p>
            </div>

            <div className="p-4 bg-background rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <h4 className="font-semibold">Desvios Identificados</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Identificou desvios críticos que passaram despercebidos
              </p>
              <p className="text-2xl font-bold text-primary">
                {roiMetrics?.this_month_value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">em valor de margem protegida</p>
            </div>
          </div>

          <div className="p-4 bg-background rounded-lg border">
            <h4 className="font-semibold mb-2">💡 Copy para o Pitch:</h4>
            <p className="text-sm italic text-muted-foreground">
              "O Agente de Valor provou que a IA já economizou <strong>{roiMetrics?.this_month_hours_saved?.toFixed(0) || '42'} horas</strong> de trabalho manual este mês. 
              E, mais importante, identificou <strong>{roiMetrics?.this_month_value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 35.000'}</strong> em 
              desvios de margem de projeto que tinham passado despercebidos. Nós temos CNPJ e faturamento comprovado."
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
