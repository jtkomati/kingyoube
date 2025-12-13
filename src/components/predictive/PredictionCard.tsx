import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PredictionCardProps {
  title: string;
  value: number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  format?: 'currency' | 'percentage' | 'number';
}

export function PredictionCard({
  title,
  value,
  subtitle,
  trend = 'neutral',
  trendValue,
  icon,
  format = 'currency',
}: PredictionCardProps) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return val.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'number':
        return val.toLocaleString('pt-BR');
      default:
        return val.toString();
    }
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <Card className="bg-card border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold text-foreground">{formatValue(value)}</p>
            </div>
          </div>
          {trendValue && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full",
              trend === 'up' && "text-green-600 bg-green-100 dark:bg-green-900/30",
              trend === 'down' && "text-red-600 bg-red-100 dark:bg-red-900/30",
              trend === 'neutral' && "text-muted-foreground bg-muted"
            )}>
              <TrendIcon className="h-3 w-3" />
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
