import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface ProviderData {
  provider: string;
  requests: number;
  cost: number;
  tokens: number;
}

interface RequestsByProviderChartProps {
  data: ProviderData[];
  isLoading?: boolean;
}

const providerColors: Record<string, string> = {
  openai: 'hsl(142 76% 36%)',
  'openai/gpt-5': 'hsl(142 76% 36%)',
  'openai/gpt-5-mini': 'hsl(142 60% 45%)',
  'openai/gpt-5-nano': 'hsl(142 50% 55%)',
  anthropic: 'hsl(24 100% 50%)',
  google: 'hsl(217 91% 60%)',
  'google/gemini-2.5-pro': 'hsl(217 91% 60%)',
  'google/gemini-2.5-flash': 'hsl(217 80% 50%)',
  'google/gemini-2.5-flash-lite': 'hsl(217 70% 45%)',
  perplexity: 'hsl(280 70% 55%)',
  lovable: 'hsl(165 65% 54%)',
  unknown: 'hsl(var(--muted-foreground))',
};

const getProviderColor = (provider: string) => {
  const key = Object.keys(providerColors).find(k => provider.toLowerCase().includes(k.toLowerCase()));
  return key ? providerColors[key] : providerColors.unknown;
};

const formatProviderName = (provider: string) => {
  if (provider.includes('/')) {
    const parts = provider.split('/');
    return parts[parts.length - 1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};

export function RequestsByProviderChart({ data, isLoading }: RequestsByProviderChartProps) {
  const totalRequests = data.reduce((sum, d) => sum + d.requests, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Requisições por Provedor
          </CardTitle>
          <CardDescription>Distribuição de uso</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    name: formatProviderName(d.provider),
    color: getProviderColor(d.provider),
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Requisições por Provedor
            </CardTitle>
            <CardDescription>Distribuição de uso nos últimos 30 dias</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{totalRequests.toLocaleString('pt-BR')}</p>
            <p className="text-sm text-muted-foreground">Total de requisições</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 10, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={75}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string, props: any) => {
                  const item = props.payload;
                  return [
                    <div key="tooltip" className="space-y-1">
                      <p>{value.toLocaleString('pt-BR')} requisições</p>
                      <p className="text-xs text-muted-foreground">
                        ${item.cost?.toFixed(2) || '0.00'} • {(item.tokens || 0).toLocaleString()} tokens
                      </p>
                    </div>,
                    '',
                  ];
                }}
              />
              <Bar dataKey="requests" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
