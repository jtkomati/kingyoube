import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, Bell, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Alert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
  resolved: boolean;
  resolved_at?: string;
  metadata?: Record<string, unknown>;
}

interface AlertsPanelProps {
  alerts: Alert[];
  onResolve: (alertId: string) => void;
  isLoading?: boolean;
}

const severityConfig = {
  info: {
    icon: Bell,
    color: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  },
  warning: {
    icon: AlertCircle,
    color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  },
  critical: {
    icon: XCircle,
    color: 'bg-red-500/20 text-red-500 border-red-500/30',
  },
};

export function AlertsPanel({ alerts, onResolve, isLoading }: AlertsPanelProps) {
  const activeAlerts = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Alertas
          {activeAlerts.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {activeAlerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando alertas...
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>Nenhum alerta ativo</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeAlerts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">ATIVOS</p>
                  <div className="space-y-2">
                    {activeAlerts.map((alert) => {
                      const config = severityConfig[alert.severity];
                      const Icon = config.icon;

                      return (
                        <div
                          key={alert.id}
                          className={`p-3 rounded-lg border ${config.color}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium whitespace-pre-wrap">
                                  {alert.message}
                                </p>
                                <p className="text-xs mt-1 opacity-70 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(alert.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="shrink-0 h-7 text-xs"
                              onClick={() => onResolve(alert.id)}
                            >
                              Resolver
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {resolvedAlerts.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">RESOLVIDOS</p>
                  <div className="space-y-2">
                    {resolvedAlerts.slice(0, 5).map((alert) => (
                      <div
                        key={alert.id}
                        className="p-3 rounded-lg border border-muted bg-muted/30 opacity-60"
                      >
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                          <div>
                            <p className="text-sm line-through">{alert.message}</p>
                            <p className="text-xs mt-1 text-muted-foreground">
                              Resolvido em {format(new Date(alert.resolved_at!), "dd/MM HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
