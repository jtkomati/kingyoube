import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncProtocol {
  id: string;
  bank_account_id: string;
  protocol_number: string | null;
  status: string;
  records_imported: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface SyncProtocolsListProps {
  bankAccountId?: string;
  onSyncComplete?: () => void;
}

export function SyncProtocolsList({ bankAccountId, onSyncComplete }: SyncProtocolsListProps) {
  const [protocols, setProtocols] = useState<SyncProtocol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadProtocols();
  }, [bankAccountId]);

  const loadProtocols = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('sync_protocols')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      if (bankAccountId) {
        query = query.eq('bank_account_id', bankAccountId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading protocols:', error);
        return;
      }

      setProtocols(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    if (!bankAccountId) return;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-bank-statement', {
        body: { bank_account_id: bankAccountId },
      });

      if (error) {
        throw new Error(error.message);
      }

      await loadProtocols();
      onSyncComplete?.();
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-600">Concluído</Badge>;
      case 'PROCESSING':
        return <Badge variant="secondary">Processando</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Histórico de Sincronizações</CardTitle>
          {bankAccountId && (
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              size="sm"
              className="gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar Agora
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : protocols.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma sincronização realizada ainda
          </p>
        ) : (
          <div className="space-y-3">
            {protocols.map((protocol) => (
              <div
                key={protocol.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(protocol.status)}
                  <div>
                    <p className="text-sm font-medium">
                      {protocol.protocol_number || protocol.id.substring(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(protocol.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {protocol.status === 'COMPLETED' && (
                    <span className="text-sm text-muted-foreground">
                      {protocol.records_imported} registros
                    </span>
                  )}
                  {getStatusBadge(protocol.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
