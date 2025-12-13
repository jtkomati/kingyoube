import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
  Bar,
  BarChart,
} from 'recharts';

interface ProjectionDataPoint {
  month: string;
  pessimistic?: number;
  realistic?: number;
  optimistic?: number;
  historical?: number;
  revenue?: number;
  expenses?: number;
  profit?: number;
}

interface ProjectionChartProps {
  title: string;
  description?: string;
  data: ProjectionDataPoint[];
  type: 'area' | 'line' | 'bar' | 'composed';
  showHistorical?: boolean;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}K`;
  }
  return `R$ ${value.toFixed(0)}`;
};

const formatMonth = (month: string) => {
  const [year, m] = month.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m) - 1]}/${year.slice(2)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="font-medium text-foreground mb-2">{formatMonth(label)}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ProjectionChart({ title, description, data, type, showHistorical }: ProjectionChartProps) {
  const chartHeight = 300;

  const renderChart = () => {
    switch (type) {
      case 'area':
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorOptimistic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorRealistic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis 
              dataKey="month" 
              tickFormatter={formatMonth}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {showHistorical && (
              <Area
                type="monotone"
                dataKey="historical"
                name="Histórico"
                stroke="hsl(var(--muted-foreground))"
                fill="hsl(var(--muted))"
                strokeWidth={2}
              />
            )}
            <Area
              type="monotone"
              dataKey="pessimistic"
              name="Pessimista"
              stroke="hsl(0, 84%, 60%)"
              fill="hsl(0, 84%, 60%)"
              fillOpacity={0.1}
              strokeDasharray="5 5"
            />
            <Area
              type="monotone"
              dataKey="realistic"
              name="Realista"
              stroke="hsl(142, 76%, 36%)"
              fill="url(#colorRealistic)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="optimistic"
              name="Otimista"
              stroke="hsl(var(--primary))"
              fill="url(#colorOptimistic)"
              strokeDasharray="5 5"
            />
          </AreaChart>
        );

      case 'composed':
        return (
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis 
              dataKey="month" 
              tickFormatter={formatMonth}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="revenue" name="Receita" fill="hsl(142, 76%, 36%)" opacity={0.8} />
            <Bar dataKey="expenses" name="Despesas" fill="hsl(0, 84%, 60%)" opacity={0.8} />
            <Line 
              type="monotone" 
              dataKey="profit" 
              name="Lucro" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
            />
          </ComposedChart>
        );

      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis 
              dataKey="month" 
              tickFormatter={formatMonth}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="pessimistic" name="Pessimista" fill="hsl(0, 84%, 60%)" opacity={0.6} />
            <Bar dataKey="realistic" name="Realista" fill="hsl(142, 76%, 36%)" />
            <Bar dataKey="optimistic" name="Otimista" fill="hsl(var(--primary))" opacity={0.6} />
          </BarChart>
        );

      default:
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis 
              dataKey="month" 
              tickFormatter={formatMonth}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="realistic"
              name="Projeção"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
            />
          </AreaChart>
        );
    }
  };

  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
