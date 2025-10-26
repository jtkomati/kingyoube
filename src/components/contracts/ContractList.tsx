import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ContractDialog } from "./ContractDialog";
import { ContractAnalysisDialog } from "./ContractAnalysisDialog";
import { useAuth } from "@/hooks/useAuth";

interface ContractListProps {
  entityType: "customer" | "supplier";
  entityId?: string;
}

export const ContractList = ({ entityType, entityId }: ContractListProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("FINANCEIRO");

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts", entityType, entityId],
    queryFn: async () => {
      let query = supabase
        .from("contracts")
        .select(`
          *,
          customers(first_name, last_name, company_name),
          suppliers(first_name, last_name, company_name)
        `)
        .eq("entity_type", entityType);

      if (entityId) {
        query = entityType === "customer"
          ? query.eq("customer_id", entityId)
          : query.eq("supplier_id", entityId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getStatusVariant = (status: string) => {
    const variants: Record<string, any> = {
      draft: "outline",
      active: "default",
      suspended: "secondary",
      cancelled: "destructive",
      expired: "destructive",
    };
    return variants[status] || "outline";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Rascunho",
      active: "Ativo",
      suspended: "Suspenso",
      cancelled: "Cancelado",
      expired: "Expirado",
    };
    return labels[status] || status;
  };

  const getRiskIcon = (risk: string | null) => {
    if (!risk) return null;
    if (risk === "critical" || risk === "high") {
      return <AlertCircle className="h-4 w-4 text-danger" />;
    }
    return <CheckCircle className="h-4 w-4 text-success" />;
  };

  const handleViewAnalysis = (contract: any) => {
    setSelectedContract(contract);
    setAnalysisDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Contrato
          </Button>
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>{entityType === "customer" ? "Cliente" : "Fornecedor"}</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Análise IA</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts?.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell className="font-medium">{contract.contract_number}</TableCell>
                <TableCell>{contract.title}</TableCell>
                <TableCell>
                  {entityType === "customer"
                    ? contract.customers?.company_name ||
                      `${contract.customers?.first_name || ""} ${contract.customers?.last_name || ""}`
                    : contract.suppliers?.company_name ||
                      `${contract.suppliers?.first_name || ""} ${contract.suppliers?.last_name || ""}`}
                </TableCell>
                <TableCell>
                  {format(new Date(contract.start_date), "dd/MM/yyyy", { locale: ptBR })}
                  {contract.end_date && (
                    <> - {format(new Date(contract.end_date), "dd/MM/yyyy", { locale: ptBR })}</>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {contract.value ? `${Number(contract.value).toFixed(0)}` : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(contract.status)}>
                    {getStatusLabel(contract.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {contract.ai_analyzed_at ? (
                    <div className="flex items-center gap-2">
                      {getRiskIcon(contract.risk_level)}
                      <span className="text-sm">{contract.compliance_score}%</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Não analisado</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    {contract.ai_analyzed_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewAnalysis(contract)}
                        title="Ver Análise"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Ver Contrato"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!contracts?.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum contrato encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ContractDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        entityType={entityType}
        entityId={entityId}
      />

      <ContractAnalysisDialog
        open={analysisDialogOpen}
        onClose={() => {
          setAnalysisDialogOpen(false);
          setSelectedContract(null);
        }}
        contract={selectedContract}
      />
    </div>
  );
};
