import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Activity, Sparkles, Bot, Brain, Search, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

interface LiveActivityFeedProps {
  activities: LiveActivity[];
  isLoading?: boolean;
}

const providerIcons: Record<string, typeof Sparkles> = {
  openai: Sparkles,
  anthropic: Bot,
  google: Brain,
  perplexity: Search,
};

const getProviderIcon = (provider: string) => {
  const key = Object.keys(providerIcons).find(k => provider.toLowerCase().includes(k));
  return key ? providerIcons[key] : Sparkles;
};

const formatModel = (model: string) => {
  if (model.includes('/')) {
    return model.split('/').pop() || model;
  }
  return model;
};

const formatIntent = (intent: string | null) => {
  if (!intent) return 'chat';
  return intent.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
};

export function LiveActivityFeed({ activities, isLoading }: LiveActivityFeedProps) {
  if (isLoading) {
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-emerald-500" />
            Atividade em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 animate-pulse text-emerald-500" />
          Atividade em Tempo Real
          <Badge variant="secondary" className="ml-auto text-xs">
            Auto-refresh 5s
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-3">
          {activities.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Nenhuma atividade recente
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => {
                const Icon = getProviderIcon(activity.provider_used);
                return (
                  <div
                    key={activity.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                      activity.success
                        ? 'bg-card/50 border-border/50 hover:bg-card'
                        : 'bg-destructive/5 border-destructive/20'
                    )}
                  >
                    <div className="shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          Tenant {activity.tenant_id.slice(0, 8)}...
                        </span>
                        <Badge variant="outline" className="text-xs font-mono">
                          {formatModel(activity.model_used)}
                        </Badge>
                        {activity.success ? (
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-destructive" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Intent: {formatIntent(activity.intent)} •{' '}
                        {activity.latency_ms ? `${activity.latency_ms}ms` : 'N/A'} •{' '}
                        {(activity.tokens_input + activity.tokens_output).toLocaleString()} tokens
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
