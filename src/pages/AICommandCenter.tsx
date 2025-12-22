import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Brain, Zap, DollarSign, Clock } from 'lucide-react';
import { ProviderCard } from '@/components/ai-command-center/ProviderCard';
import { CostChart } from '@/components/ai-command-center/CostChart';
import { RequestsByProviderChart } from '@/components/ai-command-center/RequestsByProviderChart';
import { TenantUsageTable } from '@/components/ai-command-center/TenantUsageTable';
import { LiveActivityFeed } from '@/components/ai-command-center/LiveActivityFeed';
import { useAIUsageData } from '@/hooks/useAIUsageData';
import { Card, CardContent } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Configuração dos provedores
const providers = [
  {
    id: 'openai' as const,
    name: 'OpenAI',
    description: 'GPT-5, GPT-5-mini, GPT-5-nano',
    hasApiKey: true, // Configurado via Lovable AI
    enabled: true,
  },
  {
    id: 'anthropic' as const,
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus',
    hasApiKey: false,
    enabled: false,
  },
  {
    id: 'google' as const,
    name: 'Google Gemini',
    description: 'Gemini 2.5 Pro, Flash, Flash-Lite',
    hasApiKey: true, // Configurado via Lovable AI
    enabled: true,
  },
  {
    id: 'perplexity' as const,
    name: 'Perplexity',
    description: 'Sonar Pro, Sonar',
    hasApiKey: false,
    enabled: false,
  },
];

export default function AICommandCenter() {
  const queryClient = useQueryClient();
  const { costData, providerData, tenantUsage, liveActivities, stats, isLoading } = useAIUsageData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [providerStates, setProviderStates] = useState<Record<string, boolean>>({
    openai: true,
    anthropic: false,
    google: true,
    perplexity: false,
  });

  // Simular latências dos provedores (em produção, fazer health check real)
  const [providerLatencies] = useState<Record<string, number | null>>({
    openai: 120,
    anthropic: null,
    google: 85,
    perplexity: null,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['ai-cost-30days'] });
      await queryClient.invalidateQueries({ queryKey: ['ai-requests-by-provider'] });
      await queryClient.invalidateQueries({ queryKey: ['ai-usage-by-tenant'] });
      await queryClient.invalidateQueries({ queryKey: ['ai-live-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['ai-global-stats'] });
      toast.success('Dados atualizados com sucesso');
    } catch (error) {
      toast.error('Erro ao atualizar dados');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleProviderToggle = (providerId: string, enabled: boolean) => {
    setProviderStates((prev) => ({ ...prev, [providerId]: enabled }));
    toast.success(`${providers.find(p => p.id === providerId)?.name} ${enabled ? 'ativado' : 'desativado'}`);
    // Em produção: salvar estado no banco
  };

  const getProviderStatus = (providerId: string, hasApiKey: boolean, enabled: boolean) => {
    if (!hasApiKey) return 'unconfigured';
    if (!enabled) return 'offline';
    if (providerLatencies[providerId] && providerLatencies[providerId]! > 500) return 'degraded';
    return 'online';
  };

  // Calcular stats por provedor baseado nos dados reais
  const getProviderStats = (providerId: string) => {
    const providerName = providerId.toLowerCase();
    const providerInfo = providerData.find(p => p.provider.toLowerCase().includes(providerName));
    return {
      requests: providerInfo?.requests || 0,
      cost: providerInfo?.cost || 0,
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Brain className="h-8 w-8 text-primary" />
              AI Command Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Controle total sobre provedores, custos e performance de IA
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards Rápidos */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Custo Total (30d)</p>
                  <p className="text-2xl font-bold">${stats.totalCost.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Zap className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Requisições (30d)</p>
                  <p className="text-2xl font-bold">{stats.totalRequests.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                    {stats.successRate.toFixed(1)}%
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Clock className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Latência Média</p>
                  <p className="text-2xl font-bold">{stats.avgLatency}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Provider Cards - 4 colunas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {providers.map((provider) => {
            const providerStats = getProviderStats(provider.id);
            return (
              <ProviderCard
                key={provider.id}
                provider={provider.id}
                name={provider.name}
                description={provider.description}
                status={getProviderStatus(provider.id, provider.hasApiKey, providerStates[provider.id])}
                latency={providerLatencies[provider.id]}
                enabled={providerStates[provider.id]}
                onToggle={(enabled) => handleProviderToggle(provider.id, enabled)}
                requestsMonth={providerStats.requests}
                costMonth={providerStats.cost}
                hasApiKey={provider.hasApiKey}
              />
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <CostChart data={costData} isLoading={isLoading} />
          <RequestsByProviderChart data={providerData} isLoading={isLoading} />
        </div>

        {/* Table + Live Feed Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TenantUsageTable data={tenantUsage} isLoading={isLoading} />
          </div>
          <div>
            <LiveActivityFeed activities={liveActivities} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
