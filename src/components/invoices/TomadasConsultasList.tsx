import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Download, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Consulta {
  id: string;
  protocolo: string;
  codigo_cidade: string;
  nome_cidade: string | null;
  periodo_inicial: string;
  periodo_final: string;
  situacao: string;
  total_notas: number;
  notas_importadas: number;
  mensagem_erro: string | null;
  created_at: string;
  updated_at: string;
}

interface TomadasConsultasListProps {
  companyId: string;
  onRefresh?: () => void;
}

export function TomadasConsultasList({ companyId, onRefresh }: TomadasConsultasListProps) {
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [fetchingNotas, setFetchingNotas] = useState<string | null>(null);

  useEffect(() => {
    fetchConsultas();
  }, [companyId]);

  const fetchConsultas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tomadas_consultas')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setConsultas((data as Consulta[]) || []);
    } catch (error) {
      console.error('Error fetching consultas:', error);
      toast.error('Erro ao carregar consultas');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (consulta: Consulta) => {
    setCheckingStatus(consulta.id);
    try {
      const { data, error } = await supabase.functions.invoke('check-tomadas-status', {
        body: { consultaId: consulta.id },
      });

      if (error) throw error;

      toast.success(`Status: ${data.situacao}. ${data.totalNotas} nota(s) encontrada(s).`);
      fetchConsultas();
    } catch (error: unknown) {
      console.error('Error checking status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao verificar status: ${errorMessage}`);
    } finally {
      setCheckingStatus(null);
    }
  };

  const handleFetchNotas = async (consulta: Consulta) => {
    setFetchingNotas(consulta.id);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-tomadas-notas', {
        body: { consultaId: consulta.id },
      });

      if (error) throw error;

      toast.success(`${data.notasImportadas} nota(s) importada(s) com sucesso!`);
      fetchConsultas();
      onRefresh?.();
    } catch (error: unknown) {
      console.error('Error fetching notas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao importar notas: ${errorMessage}`);
    } finally {
      setFetchingNotas(null);
    }
  };

  const getStatusBadge = (situacao: string) => {
    switch (situacao) {
      case 'CONCLUIDO':
        return (
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Concluído
          </Badge>
        );
      case 'PROCESSANDO':
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Processando
          </Badge>
        );
      case 'ERRO':
        return (
          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
            <AlertCircle className="h-3 w-3 mr-1" />
            {situacao}
          </Badge>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (consultas.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma consulta de notas tomadas realizada.</p>
        <p className="text-sm mt-2">Clique em "Consultar NFS-e Tomadas" para iniciar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Consultas Recentes</h3>
        <Button variant="ghost" size="sm" onClick={fetchConsultas}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar
        </Button>
      </div>

      <div className="space-y-3">
        {consultas.map((consulta) => (
          <Card key={consulta.id} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {consulta.nome_cidade || `Cidade ${consulta.codigo_cidade}`}
                    </span>
                    {getStatusBadge(consulta.situacao)}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      Período: {formatDate(consulta.periodo_inicial)} a {formatDate(consulta.periodo_final)}
                    </p>
                    <p className="font-mono">
                      Protocolo: {consulta.protocolo}
                    </p>
                    <p>
                      Criado {formatDistanceToNow(new Date(consulta.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {consulta.total_notas > 0 && (
                    <p className="text-xs">
                      <span className="font-medium">{consulta.total_notas}</span> nota(s) encontrada(s)
                      {consulta.notas_importadas > 0 && (
                        <span className="text-green-600 ml-2">
                          ({consulta.notas_importadas} importada(s))
                        </span>
                      )}
                    </p>
                  )}
                  {consulta.mensagem_erro && (
                    <p className="text-xs text-destructive">{consulta.mensagem_erro}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCheckStatus(consulta)}
                    disabled={checkingStatus === consulta.id}
                  >
                    {checkingStatus === consulta.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-1 hidden sm:inline">Verificar</span>
                  </Button>
                  
                  {consulta.situacao === 'CONCLUIDO' && consulta.total_notas > consulta.notas_importadas && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleFetchNotas(consulta)}
                      disabled={fetchingNotas === consulta.id}
                    >
                      {fetchingNotas === consulta.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">Importar</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
