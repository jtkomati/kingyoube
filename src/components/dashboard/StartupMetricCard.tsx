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
    if (trend > 0) return <TrendingUp className="h-4 w-4" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4" />;
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
      <Card 
        variant="glass" 
        hoverable 
        className="relative overflow-hidden group"
      >
        {/* Gradient overlay */}
        <div className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500",
          gradient
        )} />
        
        {/* Icon background glow */}
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-primary/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-popover/95 backdrop-blur-sm">
                <p className="text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        
        <CardContent className="relative">
          <div className="text-3xl font-bold tracking-tight">{formatValue()}</div>
          <div className="flex items-center gap-2 mt-2">
            <CardDescription className="text-xs">
              {description}
            </CardDescription>
            {trend !== undefined && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                trend > 0 && "bg-success/10 text-success",
                trend < 0 && "bg-destructive/10 text-destructive",
                trend === 0 && "bg-muted text-muted-foreground"
              )}>
                {getTrendIcon()}
                {Math.abs(trend).toFixed(1)}%
                {trendLabel && <span className="text-muted-foreground font-normal">({trendLabel})</span>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
