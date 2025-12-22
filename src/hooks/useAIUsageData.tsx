import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, startOfDay } from 'date-fns';

interface CostDataPoint {
  date: string;
  cost: number;
  requests: number;
}

interface ProviderData {
  provider: string;
  requests: number;
  cost: number;
  tokens: number;
}

interface TenantUsage {
  tenant_id: string;
  company_name: string;
  cnpj: string;
  total_tokens: number;
  cost_cents: number;
  last_request: string;
  favorite_model: string;
  request_count: number;
}

interface LiveActivity {
  id: string;
  tenant_id: string;
  provider_used: string;
  model_used: string;
  intent: string | null;
  latency_ms: number | null;
  created_at: string;
  tokens_input: number;
  tokens_output: number;
  success: boolean;
}

export function useAIUsageData() {
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

  // Query para custo dos últimos 30 dias agregado por dia
  const { data: costData, isLoading: costLoading } = useQuery({
    queryKey: ['ai-cost-30days'],
    queryFn: async (): Promise<CostDataPoint[]> => {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('created_at, cost_estimated_cents')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at');

      if (error) throw error;

      // Agregar por dia
      const dailyData: Record<string, { cost: number; requests: number }> = {};
      
      // Inicializar todos os dias com 0
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        dailyData[date] = { cost: 0, requests: 0 };
      }

      // Agregar dados reais
      data?.forEach((row) => {
        const date = format(new Date(row.created_at), 'yyyy-MM-dd');
        if (dailyData[date]) {
          dailyData[date].cost += row.cost_estimated_cents / 100;
          dailyData[date].requests += 1;
        }
      });

      return Object.entries(dailyData).map(([date, values]) => ({
        date: format(new Date(date), 'dd/MM'),
        cost: Number(values.cost.toFixed(2)),
        requests: values.requests,
      }));
    },
    staleTime: 60 * 1000, // 1 minuto
  });

  // Query para requisições por provedor
  const { data: providerData, isLoading: providerLoading } = useQuery({
    queryKey: ['ai-requests-by-provider'],
    queryFn: async (): Promise<ProviderData[]> => {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('provider_used, cost_estimated_cents, tokens_input, tokens_output')
        .gte('created_at', thirtyDaysAgo);

      if (error) throw error;

      // Agregar por provedor
      const providerMap: Record<string, ProviderData> = {};

      data?.forEach((row) => {
        const provider = row.provider_used || 'unknown';
        if (!providerMap[provider]) {
          providerMap[provider] = { provider, requests: 0, cost: 0, tokens: 0 };
        }
        providerMap[provider].requests += 1;
        providerMap[provider].cost += row.cost_estimated_cents / 100;
        providerMap[provider].tokens += (row.tokens_input || 0) + (row.tokens_output || 0);
      });

      return Object.values(providerMap).sort((a, b) => b.requests - a.requests);
    },
    staleTime: 60 * 1000,
  });

  // Query para uso por tenant com join na tabela organizations
  const { data: tenantUsage, isLoading: tenantLoading } = useQuery({
    queryKey: ['ai-usage-by-tenant'],
    queryFn: async (): Promise<TenantUsage[]> => {
      // Primeiro buscar os logs agrupados por tenant
      const { data: logs, error: logsError } = await supabase
        .from('ai_usage_logs')
        .select('tenant_id, cost_estimated_cents, tokens_input, tokens_output, model_used, created_at')
        .gte('created_at', startOfDay(subDays(new Date(), 30)).toISOString());

      if (logsError) throw logsError;

      // Agregar por tenant
      const tenantMap: Record<string, {
        total_tokens: number;
        cost_cents: number;
        last_request: string;
        models: Record<string, number>;
        request_count: number;
      }> = {};

      logs?.forEach((log) => {
        const tenantId = log.tenant_id;
        if (!tenantMap[tenantId]) {
          tenantMap[tenantId] = {
            total_tokens: 0,
            cost_cents: 0,
            last_request: log.created_at,
            models: {},
            request_count: 0,
          };
        }
        tenantMap[tenantId].total_tokens += (log.tokens_input || 0) + (log.tokens_output || 0);
        tenantMap[tenantId].cost_cents += log.cost_estimated_cents;
        tenantMap[tenantId].request_count += 1;
        
        if (new Date(log.created_at) > new Date(tenantMap[tenantId].last_request)) {
          tenantMap[tenantId].last_request = log.created_at;
        }
        
        const model = log.model_used || 'unknown';
        tenantMap[tenantId].models[model] = (tenantMap[tenantId].models[model] || 0) + 1;
      });

      // Buscar nomes das organizações
      const tenantIds = Object.keys(tenantMap);
      const { data: orgs, error: orgsError } = await supabase
        .from('company_settings')
        .select('id, company_name, cnpj')
        .in('id', tenantIds);

      if (orgsError) throw orgsError;

      const orgMap = new Map(orgs?.map(org => [org.id, org]) || []);

      return tenantIds.map((tenantId) => {
        const tenant = tenantMap[tenantId];
        const org = orgMap.get(tenantId);
        const favoriteModel = Object.entries(tenant.models)
          .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

        return {
          tenant_id: tenantId,
          company_name: org?.company_name || `Tenant ${tenantId.slice(0, 8)}...`,
          cnpj: org?.cnpj || 'N/A',
          total_tokens: tenant.total_tokens,
          cost_cents: tenant.cost_cents,
          last_request: tenant.last_request,
          favorite_model: favoriteModel,
          request_count: tenant.request_count,
        };
      }).sort((a, b) => b.cost_cents - a.cost_cents);
    },
    staleTime: 60 * 1000,
  });

  // Query para live feed - últimas 10 chamadas
  const { data: liveActivities, isLoading: liveLoading, refetch: refetchLive } = useQuery({
    queryKey: ['ai-live-activities'],
    queryFn: async (): Promise<LiveActivity[]> => {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('id, tenant_id, provider_used, model_used, intent, latency_ms, created_at, tokens_input, tokens_output, success')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000, // Atualiza a cada 5s
  });

  // Query para estatísticas gerais
  const { data: stats } = useQuery({
    queryKey: ['ai-global-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('cost_estimated_cents, success, latency_ms')
        .gte('created_at', thirtyDaysAgo);

      if (error) throw error;

      const totalCost = data?.reduce((sum, r) => sum + r.cost_estimated_cents, 0) || 0;
      const totalRequests = data?.length || 0;
      const successfulRequests = data?.filter(r => r.success).length || 0;
      const avgLatency = data?.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / (totalRequests || 1);

      return {
        totalCost: totalCost / 100,
        totalRequests,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
        avgLatency: Math.round(avgLatency),
      };
    },
    staleTime: 60 * 1000,
  });

  return {
    costData: costData || [],
    providerData: providerData || [],
    tenantUsage: tenantUsage || [],
    liveActivities: liveActivities || [],
    stats: stats || { totalCost: 0, totalRequests: 0, successRate: 0, avgLatency: 0 },
    isLoading: costLoading || providerLoading || tenantLoading || liveLoading,
    refetchLive,
  };
}
