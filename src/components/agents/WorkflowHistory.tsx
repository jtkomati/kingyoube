import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  History, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ExecutionLog {
  id: string;
  agent_id: string;
  action_type: string;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  success: { icon: CheckCircle, color: 'text-green-500', label: 'Sucesso' },
  failed: { icon: XCircle, color: 'text-destructive', label: 'Falhou' },
  pending: { icon: Clock, color: 'text-yellow-500', label: 'Pendente' },
  running: { icon: Loader2, color: 'text-blue-500', label: 'Executando' },
};

const agentNames: Record<string, string> = {
  billing: 'Faturamento',
  receivables: 'Contas a Receber',
  collection: 'Cobrança',
  payables: 'Contas a Pagar',
  treasury: 'Tesouraria',
};

export function WorkflowHistory() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['agent-execution-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_execution_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as ExecutionLog[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-muted-foreground" />
          Histórico de Execuções
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!logs?.length ? (
          <div className="text-center py-6 text-muted-foreground">
            Nenhuma execução registrada
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const status = statusConfig[log.status] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <StatusIcon className={cn("w-5 h-5 flex-shrink-0", status.color, log.status === 'running' && 'animate-spin')} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">
                        {agentNames[log.agent_id] || log.agent_id}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {log.action_type}
                      </Badge>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-destructive truncate mt-1">
                        {log.error_message}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </div>
                    {log.duration_ms && (
                      <div className="text-xs text-muted-foreground">
                        {log.duration_ms}ms
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
