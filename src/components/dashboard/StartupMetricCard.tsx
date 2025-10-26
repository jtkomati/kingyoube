import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LucideIcon, HelpCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StartupMetricCardProps {
  title: string;
  value: string | number;
  description: string;
  tooltip: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  gradient?: string;
  prefix?: string;
  suffix?: string;
}

export function StartupMetricCard({
  title,
  value,
  description,
  tooltip,
  icon: Icon,
  trend,
  trendLabel,
  gradient = 'gradient-primary',
  prefix = '',
  suffix = '',
}: StartupMetricCardProps) {
  const formatValue = () => {
    if (typeof value === 'number') {
      return `${prefix}${value.toLocaleString('pt-BR', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
      })}${suffix}`;
    }
    return `${prefix}${value}${suffix}`;
  };

  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return null;
  };

  const getTrendColor = () => {
    if (trend === undefined) return '';
    if (trend > 0) return 'text-success';
    if (trend < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  return (
    <TooltipProvider>
      <Card className="relative overflow-hidden group hover:shadow-glow transition-all">
        <div className={cn(
          "absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity",
          gradient
        )} />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">
              {title}
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatValue()}</div>
          <div className="flex items-center gap-2 mt-1">
            <CardDescription className="text-xs">
              {description}
            </CardDescription>
            {trend !== undefined && (
              <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor())}>
                {getTrendIcon()}
                {Math.abs(trend).toFixed(1)}%
                {trendLabel && <span className="text-muted-foreground">({trendLabel})</span>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
