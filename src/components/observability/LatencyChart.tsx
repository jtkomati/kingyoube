import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface LatencyDataPoint {
  hour: string;
  p50: number;
  p95: number;
  p99: number;
}

interface LatencyChartProps {
  data: LatencyDataPoint[];
}

export function LatencyChart({ data }: LatencyChartProps) {
  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      hour: new Date(point.hour).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }));
  }, [data]);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Latência por Hora (ms)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="hour" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="p50" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                name="P50"
              />
              <Line 
                type="monotone" 
                dataKey="p95" 
                stroke="hsl(142 76% 36%)" 
                strokeWidth={2}
                dot={false}
                name="P95"
              />
              <Line 
                type="monotone" 
                dataKey="p99" 
                stroke="hsl(0 84% 60%)" 
                strokeWidth={2}
                dot={false}
                name="P99"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
