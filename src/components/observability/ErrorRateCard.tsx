import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorRateCardProps {
  totalErrors: number;
  errorRate: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

export function ErrorRateCard({ totalErrors, errorRate, trend, trendValue }: ErrorRateCardProps) {
  const getTrendColor = () => {
    if (trend === 'down') return 'text-green-500';
    if (trend === 'up') return 'text-red-500';
    return 'text-muted-foreground';
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  const getStatusColor = () => {
    if (errorRate > 5) return 'text-red-500';
    if (errorRate > 1) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Taxa de Erros</CardTitle>
        <AlertTriangle className={`h-4 w-4 ${getStatusColor()}`} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${getStatusColor()}`}>
            {errorRate.toFixed(2)}%
          </span>
          {TrendIcon && (
            <span className={`flex items-center text-xs ${getTrendColor()}`}>
              <TrendIcon className="h-3 w-3 mr-1" />
              {trendValue.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {totalErrors} erros nas últimas 24h
        </p>
      </CardContent>
    </Card>
  );
}
