import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function ApuracaoAssistida() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [periodoMes, setPeriodoMes] = useState("");
  const [periodoAno, setPeriodoAno] = useState("");
  const [tipo, setTipo] = useState("");

  // Buscar solicitações
  const { data: solicitacoes = [] } = useQuery({
    queryKey: ["solicitacoes-apuracao"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return [];

      const { data, error } = await supabase
        .from("solicitacoes_apuracao")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Criar nova solicitação
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) throw new Error("Company ID not found");

      const periodo = `${periodoMes}/${periodoAno}`;
      
      const { error } = await supabase
        .from("solicitacoes_apuracao")
        .insert({
          company_id: profile.company_id,
          periodo_apuracao: periodo,
          tipo: tipo,
          status: "PROCESSANDO",
        });

      if (error) throw error;

      // Simular processamento assíncrono
      setTimeout(async () => {
        const statusFinal = Math.random() > 0.2 ? "CONCLUIDO" : "ERRO";
        
        const { data: lastRecord } = await supabase
          .from("solicitacoes_apuracao")
          .select("id")
          .eq("company_id", profile.company_id)
          .eq("periodo_apuracao", periodo)
          .eq("tipo", tipo)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lastRecord) {
          await supabase
            .from("solicitacoes_apuracao")
            .update({
              status: statusFinal,
              resultado_url: statusFinal === "CONCLUIDO" 
                ? `https://storage.exemplo.com/apuracao-${lastRecord.id}.pdf`
                : null
            })
            .eq("id", lastRecord.id);

          queryClient.invalidateQueries({ queryKey: ["solicitacoes-apuracao"] });
        }
      }, 5000);
    },
    onSuccess: () => {
      toast({
        title: "Solicitação criada",
        description: "A consulta foi iniciada e está sendo processada.",
      });
      setOpen(false);
      setPeriodoMes("");
      setPeriodoAno("");
      setTipo("");
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-apuracao"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar solicitação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      PROCESSANDO: { variant: "secondary" as const, color: "text-yellow-600" },
      CONCLUIDO: { variant: "default" as const, color: "text-green-600" },
      ERRO: { variant: "destructive" as const, color: "text-red-600" },
    };

    const config = variants[status as keyof typeof variants] || variants.PROCESSANDO;

    return (
      <Badge variant={config.variant} className={config.color}>
        {status === "PROCESSANDO" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Apuração de Débitos e Créditos
            </CardTitle>
            <CardDescription>
              Consultas assíncronas de apuração tributária
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Consulta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Consulta de Apuração</DialogTitle>
                <DialogDescription>
                  Solicite uma consulta de débitos ou créditos para um período específico
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mes">Mês</Label>
                    <Select value={periodoMes} onValueChange={setPeriodoMes}>
                      <SelectTrigger id="mes">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1).padStart(2, "0")}>
                            {new Date(2024, i).toLocaleDateString("pt-BR", { month: "long" })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ano">Ano</Label>
                    <Input
                      id="ano"
                      type="number"
                      placeholder="2025"
                      value={periodoAno}
                      onChange={(e) => setPeriodoAno(e.target.value)}
                      min="2025"
                      max="2030"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de Consulta</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger id="tipo">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEBITO">Débitos a Pagar</SelectItem>
                      <SelectItem value="CREDITO">Créditos Acumulados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !periodoMes || !periodoAno || !tipo}
                >
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Solicitar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {solicitacoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma solicitação encontrada. Clique em "Nova Consulta" para começar.
                </TableCell>
              </TableRow>
            ) : (
              solicitacoes.map((solicitacao) => (
                <TableRow key={solicitacao.id}>
                  <TableCell>
                    {new Date(solicitacao.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>{solicitacao.periodo_apuracao}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {solicitacao.tipo === "DEBITO" ? "Débito" : "Crédito"}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(solicitacao.status)}</TableCell>
                  <TableCell className="text-right">
                    {solicitacao.status === "CONCLUIDO" && solicitacao.resultado_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={solicitacao.resultado_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
