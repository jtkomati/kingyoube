import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CostDataPoint {
  date: string;
  cost: number;
  requests: number;
}

interface CostChartProps {
  data: CostDataPoint[];
  isLoading?: boolean;
}

export function CostChart({ data, isLoading }: CostChartProps) {
  // Calcular variação percentual
  const totalCost = data.reduce((sum, d) => sum + d.cost, 0);
  const firstHalfCost = data.slice(0, 15).reduce((sum, d) => sum + d.cost, 0);
  const secondHalfCost = data.slice(15).reduce((sum, d) => sum + d.cost, 0);
  const variation = firstHalfCost > 0 ? ((secondHalfCost - firstHalfCost) / firstHalfCost) * 100 : 0;
  const isPositive = variation >= 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Custo Total de IA
          </CardTitle>
          <CardDescription>Últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Custo Total de IA
            </CardTitle>
            <CardDescription>Últimos 30 dias</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">
              ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-destructive' : 'text-emerald-500'}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{Math.abs(variation).toFixed(1)}% vs período anterior</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Custo']}
            />
            <Area
              type="monotone"
              dataKey="cost"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#costGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
