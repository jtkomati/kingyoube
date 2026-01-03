import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Plus,
  Search,
  Filter,
  RefreshCw
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TaxPaymentDialog } from "@/components/payments/TaxPaymentDialog";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";

const TaxPayments = () => {
  const { currentOrganization } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTaxType, setSelectedTaxType] = useState<string | null>(null);

  const { data: taxPayments, isLoading, refetch } = useQuery({
    queryKey: ["tax-payments", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("bank_payments")
        .select("*, tax_payments(*)")
        .eq("company_id", currentOrganization.id)
        .in("payment_type", ["DARF", "GPS", "GARE", "FGTS", "IPVA", "DPVAT"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", currentOrganization.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });

  const filteredPayments = taxPayments?.filter(p => 
    p.beneficiary_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.payment_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNewTax = (type: string) => {
    setSelectedTaxType(type);
    setIsDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const taxTypes = [
    { id: "DARF", name: "DARF", description: "Receitas Federais" },
    { id: "GPS", name: "GPS", description: "Previdência Social" },
    { id: "GARE", name: "GARE", description: "Receita Estadual" },
    { id: "FGTS", name: "FGTS", description: "Fundo de Garantia" },
    { id: "IPVA", name: "IPVA", description: "Veículos" },
    { id: "DPVAT", name: "DPVAT", description: "Seguro Obrigatório" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pagamento de Tributos</h1>
              <p className="text-sm text-muted-foreground">
                DARF, GPS, GARE, FGTS, IPVA e DPVAT
              </p>
            </div>
          </div>
        </div>

        {/* Tax Type Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {taxTypes.map((tax) => (
            <Card 
              key={tax.id} 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleNewTax(tax.id)}
            >
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-lg">{tax.name}</CardTitle>
                <CardDescription className="text-xs">{tax.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-center">
                <Button size="sm" variant="ghost" className="gap-1">
                  <Plus className="h-3 w-3" />
                  Novo
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tributos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Payments List */}
        <Card>
          <CardHeader>
            <CardTitle>Tributos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-sm">Tipo</th>
                    <th className="text-left p-4 font-medium text-sm">Contribuinte</th>
                    <th className="text-left p-4 font-medium text-sm">Valor</th>
                    <th className="text-left p-4 font-medium text-sm">Vencimento</th>
                    <th className="text-left p-4 font-medium text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Carregando tributos...
                      </td>
                    </tr>
                  ) : filteredPayments?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Nenhum tributo cadastrado
                      </td>
                    </tr>
                  ) : (
                    filteredPayments?.map((payment) => (
                      <tr key={payment.id} className="border-b hover:bg-muted/30">
                        <td className="p-4">
                          <Badge variant="outline">{payment.payment_type}</Badge>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">{payment.beneficiary_cpf_cnpj || "—"}</p>
                        </td>
                        <td className="p-4 font-medium">
                          {formatCurrency(Number(payment.amount) || 0)}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {payment.due_date 
                            ? format(new Date(payment.due_date), "dd/MM/yyyy", { locale: ptBR })
                            : "—"}
                        </td>
                        <td className="p-4">
                          <PaymentStatusBadge status={payment.status || "CREATED"} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <TaxPaymentDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          taxType={selectedTaxType}
          bankAccounts={bankAccounts || []}
          companyId={currentOrganization?.id}
          onSuccess={() => {
            refetch();
            setIsDialogOpen(false);
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default TaxPayments;
