import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CompanyDialog } from "./CompanyDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Building2,
  Users,
  Receipt,
  Loader2,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Company {
  id: string;
  company_name: string;
  nome_fantasia: string | null;
  cnpj: string;
  municipal_inscription: string | null;
  state_inscription: string | null;
  address: string | null;
  city_code: string | null;
  tax_regime: string | null;
  status: string | null;
  notification_email: string | null;
  created_at: string;
}

interface CompanyWithMetrics extends Company {
  user_count: number;
  transaction_count: number;
}

export function CompaniesTab() {
  const [companies, setCompanies] = useState<CompanyWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("company_settings")
        .select("*")
        .order("company_name");

      if (companiesError) throw companiesError;

      // Fetch metrics for each company
      const companiesWithMetrics: CompanyWithMetrics[] = await Promise.all(
        (companiesData || []).map(async (company) => {
          // Count users
          const { count: userCount } = await supabase
            .from("user_organizations")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", company.id);

          // Count transactions
          const { count: transactionCount } = await supabase
            .from("transactions")
            .select("*", { count: "exact", head: true })
            .eq("company_id", company.id);

          return {
            ...company,
            user_count: userCount || 0,
            transaction_count: transactionCount || 0,
          };
        })
      );

      setCompanies(companiesWithMetrics);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;

    try {
      const { error } = await supabase
        .from("company_settings")
        .delete()
        .eq("id", companyToDelete.id);

      if (error) throw error;

      toast.success("Empresa excluída com sucesso!");
      fetchCompanies();
    } catch (error: any) {
      console.error("Error deleting company:", error);
      toast.error(error.message || "Erro ao excluir empresa");
    } finally {
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Ativo</Badge>;
      case "INACTIVE":
        return <Badge variant="secondary">Inativo</Badge>;
      case "SUSPENDED":
        return <Badge variant="destructive">Suspenso</Badge>;
      default:
        return <Badge variant="outline">{status || "N/A"}</Badge>;
    }
  };

  const getTaxRegimeLabel = (regime: string | null) => {
    switch (regime) {
      case "SIMPLES":
        return "Simples Nacional";
      case "LUCRO_PRESUMIDO":
        return "Lucro Presumido";
      case "LUCRO_REAL":
        return "Lucro Real";
      case "MEI":
        return "MEI";
      default:
        return regime || "N/A";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Empresas do Sistema
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchCompanies} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedCompany(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma empresa cadastrada</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSelectedCompany(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeira Empresa
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Regime</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4" />
                        Usuários
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Receipt className="h-4 w-4" />
                        Transações
                      </div>
                    </TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{company.company_name}</span>
                          {company.nome_fantasia && (
                            <span className="text-sm text-muted-foreground">
                              {company.nome_fantasia}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{company.cnpj}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTaxRegimeLabel(company.tax_regime)}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(company.status)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{company.user_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{company.transaction_count}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(company.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(company)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setCompanyToDelete(company);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        company={selectedCompany}
        onSuccess={fetchCompanies}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Empresa"
        description={`Tem certeza que deseja excluir a empresa "${companyToDelete?.company_name}"? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
