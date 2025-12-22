import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ProviderStatusIndicatorProps {
  status: 'online' | 'degraded' | 'offline' | 'unconfigured';
  latency?: number | null;
}

export function ProviderStatusIndicator({ status, latency }: ProviderStatusIndicatorProps) {
  const statusConfig = {
    online: {
      color: 'bg-emerald-500',
      label: 'Online',
      animate: true,
    },
    degraded: {
      color: 'bg-amber-500',
      label: 'Degradado',
      animate: true,
    },
    offline: {
      color: 'bg-destructive',
      label: 'Offline',
      animate: false,
    },
    unconfigured: {
      color: 'bg-muted-foreground/50',
      label: 'Não Configurado',
      animate: false,
    },
  };

  const config = statusConfig[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-3 w-3 rounded-full',
              config.color,
              config.animate && 'animate-pulse'
            )}
          />
          {latency !== null && latency !== undefined && status === 'online' && (
            <span className="text-xs text-muted-foreground">{latency}ms</span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.label}</p>
        {latency !== null && latency !== undefined && <p className="text-xs">Latência: {latency}ms</p>}
      </TooltipContent>
    </Tooltip>
  );
}
