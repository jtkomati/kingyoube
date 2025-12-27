import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  FileText,
  CreditCard,
  HandCoins,
  Phone,
  Landmark,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ApprovalItem {
  id: string;
  agent_id: string;
  action_type: string;
  priority: number;
  request_data: Record<string, any>;
  requested_by: string;
  requested_at: string;
  status: string;
  review_notes: string | null;
  company_id: string;
}

const agentIcons: Record<string, typeof FileText> = {
  billing: FileText,
  receivables: HandCoins,
  collection: Phone,
  payables: CreditCard,
  treasury: Landmark,
};

const agentColors: Record<string, string> = {
  billing: 'from-blue-500 to-blue-600',
  receivables: 'from-green-500 to-green-600',
  collection: 'from-orange-500 to-orange-600',
  payables: 'from-red-500 to-red-600',
  treasury: 'from-purple-500 to-purple-600',
};

const agentNames: Record<string, string> = {
  billing: 'Faturamento',
  receivables: 'Contas a Receber',
  collection: 'Cobrança',
  payables: 'Contas a Pagar',
  treasury: 'Tesouraria',
};

const actionLabels: Record<string, string> = {
  issue_invoice: 'Emitir Nota Fiscal',
  reconcile_payment: 'Conciliar Pagamento',
  send_collection: 'Enviar Cobrança',
  schedule_payment: 'Agendar Pagamento',
  transfer_funds: 'Transferir Fundos',
  categorize: 'Categorizar Transação',
};

const priorityColors: Record<number, string> = {
  1: 'bg-destructive text-destructive-foreground',
  2: 'bg-orange-500 text-white',
  3: 'bg-yellow-500 text-black',
  4: 'bg-blue-500 text-white',
  5: 'bg-muted text-muted-foreground',
};

export function ApprovalQueue() {
  const queryClient = useQueryClient();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const { data: pendingApprovals, isLoading } = useQuery({
    queryKey: ['approval-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: true })
        .order('requested_at', { ascending: true });

      if (error) throw error;
      return data as ApprovalItem[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('approval_queue')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', id);

      if (error) throw error;

      // Trigger the agent workflow continuation
      const item = pendingApprovals?.find(a => a.id === id);
      if (item) {
        await supabase.functions.invoke(`${item.agent_id}-agent-workflow`, {
          body: {
            action: 'continue_after_approval',
            approvalId: id,
            requestData: item.request_data,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      toast.success('Aprovado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao aprovar: ' + error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('approval_queue')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || 'Rejeitado pelo Gerente Financeiro',
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      toast.info('Solicitação rejeitada');
    },
    onError: (error) => {
      toast.error('Erro ao rejeitar: ' + error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!pendingApprovals?.length) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Fila de Aprovações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-muted-foreground">
              Nenhuma aprovação pendente
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Todas as solicitações foram processadas
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Fila de Aprovações
          </span>
          <Badge variant="secondary" className="text-sm">
            {pendingApprovals.length} pendente{pendingApprovals.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingApprovals.map((item) => {
          const Icon = agentIcons[item.agent_id] || FileText;
          const color = agentColors[item.agent_id] || 'from-gray-500 to-gray-600';
          const isExpanded = expandedItem === item.id;
          const amount = item.request_data?.amount || item.request_data?.value || item.request_data?.net_amount;

          return (
            <div
              key={item.id}
              className={cn(
                "border border-border rounded-xl overflow-hidden transition-all duration-200",
                isExpanded && "ring-2 ring-primary/20"
              )}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
              >
                <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0", color)}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {agentNames[item.agent_id] || item.agent_id}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {actionLabels[item.action_type] || item.action_type}
                    </Badge>
                    <Badge className={cn("text-xs", priorityColors[item.priority] || priorityColors[5])}>
                      P{item.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(item.requested_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    {amount && (
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(amount)}
                      </span>
                    )}
                  </div>
                </div>

                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-border p-4 bg-muted/30 space-y-4">
                  {/* Request Details */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Detalhes da Solicitação</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(item.request_data).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="text-foreground font-medium">
                            {typeof value === 'number' && key.includes('amount')
                              ? formatCurrency(value)
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Review Notes */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Observações (opcional)
                    </label>
                    <Textarea
                      placeholder="Adicione observações para esta aprovação..."
                      value={reviewNotes[item.id] || ''}
                      onChange={(e) => setReviewNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="min-h-[60px] bg-background"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => approveMutation.mutate({ id: item.id, notes: reviewNotes[item.id] })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Aprovar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => rejectMutation.mutate({ id: item.id, notes: reviewNotes[item.id] })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1"
                    >
                      {rejectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Rejeitar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
