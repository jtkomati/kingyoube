import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileSearch, 
  RefreshCw, 
  Settings, 
  AlertCircle,
  CheckCircle,
  Clock,
  Ban,
  Loader2,
  Search
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DDABoletoDialog } from "./DDABoletoDialog";
import { DDAConfigCard } from "./DDAConfigCard";

interface DDATabProps {
  companyId?: string;
  bankAccounts: Array<{
    id: string;
    bank_name: string;
    account_hash?: string;
    dda_activated?: boolean;
  }>;
  onRefresh: () => void;
}

interface DDABoleto {
  id: string;
  company_id: string;
  account_hash: string;
  unique_id: string;
  barcode: string;
  digitable_line: string;
  beneficiary_name: string;
  beneficiary_cpf_cnpj: string;
  beneficiary_bank_code: string;
  beneficiary_bank_name: string;
  nominal_amount: number;
  discount_amount: number;
  interest_amount: number;
  fine_amount: number;
  final_amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  our_number: string;
  document_number: string;
  description: string;
  created_at: string;
}

export const DDATab = ({ companyId, bankAccounts, onRefresh }: DDATabProps) => {
  const queryClient = useQueryClient();
  const [selectedBoleto, setSelectedBoleto] = useState<DDABoleto | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const ddaAccounts = bankAccounts.filter(a => a.dda_activated && a.account_hash);
  const hasActiveDDA = ddaAccounts.length > 0;

  const { data: ddaData, isLoading, refetch } = useQuery({
    queryKey: ["dda-boletos", companyId],
    queryFn: async () => {
      if (!companyId) return { boletos: [], statistics: {} };
      
      const { data, error } = await supabase.functions.invoke("payment-dda-query", {
        body: { companyId },
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && hasActiveDDA,
  });

  const syncMutation = useMutation({
    mutationFn: async (accountHash: string) => {
      const { data, error } = await supabase.functions.invoke("payment-dda-sync", {
        body: { accountHash, companyId, syncType: 'MANUAL' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sincronização concluída: ${data.boletosNew} novos boletos`);
      queryClient.invalidateQueries({ queryKey: ["dda-boletos"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  const handleSync = () => {
    ddaAccounts.forEach(account => {
      if (account.account_hash) {
        syncMutation.mutate(account.account_hash);
      }
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  const getDueDateStatus = (dueDate: string) => {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) return { label: "Vencido", color: "destructive" as const };
    if (days <= 3) return { label: "Urgente", color: "destructive" as const };
    if (days <= 7) return { label: "Próximo", color: "secondary" as const };
    return { label: "", color: "outline" as const };
  };

  const filteredBoletos = (ddaData?.boletos || []).filter((boleto: DDABoleto) => {
    const matchesSearch = 
      boleto.beneficiary_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      boleto.beneficiary_cpf_cnpj?.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || boleto.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = ddaData?.statistics || {};

  if (!hasActiveDDA && !showConfig) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto p-4 rounded-full bg-muted mb-4">
            <FileSearch className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>DDA - Débito Direto Autorizado</CardTitle>
          <CardDescription>
            Receba automaticamente todos os boletos emitidos contra sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Nenhuma conta bancária com DDA ativo. Ative o DDA em suas contas para começar a receber boletos automaticamente.
          </p>
          <Button onClick={() => setShowConfig(true)} className="gap-2">
            <Settings className="h-4 w-4" />
            Configurar DDA
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showConfig) {
    return (
      <DDAConfigCard 
        bankAccounts={bankAccounts} 
        onBack={() => setShowConfig(false)}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              Total
            </CardDescription>
            <CardTitle className="text-2xl">{stats.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pendentes
            </CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{stats.pending || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Pagos
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.paid || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-muted-foreground" />
              Ignorados
            </CardDescription>
            <CardTitle className="text-2xl text-muted-foreground">{stats.ignored || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valor Pendente</CardDescription>
            <CardTitle className="text-lg">{formatCurrency(stats.totalPendingAmount || 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por beneficiário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PENDING">Pendentes</SelectItem>
            <SelectItem value="PAID">Pagos</SelectItem>
            <SelectItem value="IGNORED">Ignorados</SelectItem>
          </SelectContent>
        </Select>
        <Button 
          variant="outline" 
          onClick={handleSync}
          disabled={syncMutation.isPending}
          className="gap-2"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sincronizar DDA
        </Button>
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => setShowConfig(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Boletos List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium text-sm">Beneficiário</th>
                  <th className="text-left p-4 font-medium text-sm">Banco</th>
                  <th className="text-left p-4 font-medium text-sm">Valor</th>
                  <th className="text-left p-4 font-medium text-sm">Vencimento</th>
                  <th className="text-left p-4 font-medium text-sm">Status</th>
                  <th className="text-right p-4 font-medium text-sm">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Carregando boletos DDA...
                    </td>
                  </tr>
                ) : filteredBoletos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      <FileSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhum boleto DDA encontrado
                    </td>
                  </tr>
                ) : (
                  filteredBoletos.map((boleto: DDABoleto) => {
                    const dueDateStatus = getDueDateStatus(boleto.due_date);
                    return (
                      <tr key={boleto.id} className="border-b hover:bg-muted/30">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{boleto.beneficiary_name || "—"}</p>
                            <p className="text-sm text-muted-foreground">{boleto.beneficiary_cpf_cnpj}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{boleto.beneficiary_bank_name || boleto.beneficiary_bank_code}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">{formatCurrency(boleto.final_amount)}</p>
                          {boleto.nominal_amount !== boleto.final_amount && (
                            <p className="text-xs text-muted-foreground line-through">
                              {formatCurrency(boleto.nominal_amount)}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span>{boleto.due_date ? format(new Date(boleto.due_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span>
                            {dueDateStatus.label && boleto.status === 'PENDING' && (
                              <Badge variant={dueDateStatus.color} className="text-xs">
                                {dueDateStatus.label}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={
                            boleto.status === 'PAID' ? 'default' :
                            boleto.status === 'IGNORED' ? 'secondary' :
                            'outline'
                          }>
                            {boleto.status === 'PENDING' ? 'Pendente' :
                             boleto.status === 'PAID' ? 'Pago' :
                             boleto.status === 'IGNORED' ? 'Ignorado' :
                             boleto.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedBoleto(boleto);
                              setIsDialogOpen(true);
                            }}
                          >
                            {boleto.status === 'PENDING' ? 'Processar' : 'Visualizar'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Boleto Dialog */}
      <DDABoletoDialog
        boleto={selectedBoleto}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={() => {
          refetch();
          setIsDialogOpen(false);
        }}
      />
    </div>
  );
};
