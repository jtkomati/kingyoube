import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  CreditCard, 
  Send, 
  FileText, 
  Receipt, 
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PaymentDialog } from "@/components/payments/PaymentDialog";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { RemessaManager } from "@/components/payments/RemessaManager";

const BankPayments = () => {
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState("payments");
  const [searchTerm, setSearchTerm] = useState("");
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<string | null>(null);

  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ["bank-payments", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("bank_payments")
        .select("*")
        .eq("company_id", currentOrganization.id)
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

  const filteredPayments = payments?.filter(p => 
    p.beneficiary_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.unique_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paymentStats = {
    total: payments?.length || 0,
    pending: payments?.filter(p => p.status === "CREATED").length || 0,
    paid: payments?.filter(p => p.status === "PAID").length || 0,
    totalAmount: payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0,
  };

  const handleNewPayment = (type: string) => {
    setSelectedPaymentType(type);
    setIsPaymentDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pagamentos Bancários</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie boletos, transferências e tributos
              </p>
            </div>
          </div>
          <Button onClick={() => handleNewPayment("billet")} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Pagamento
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Pagamentos</CardDescription>
              <CardTitle className="text-2xl">{paymentStats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{paymentStats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pagos</CardDescription>
              <CardTitle className="text-2xl text-green-600">{paymentStats.paid}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Valor Total</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(paymentStats.totalAmount)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-2 bg-muted/50 p-2">
            <TabsTrigger value="payments" className="gap-2 data-[state=active]:bg-background">
              <CreditCard className="h-4 w-4" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="remessa" className="gap-2 data-[state=active]:bg-background">
              <Send className="h-4 w-4" />
              Remessa
            </TabsTrigger>
            <TabsTrigger value="retorno" className="gap-2 data-[state=active]:bg-background">
              <FileText className="h-4 w-4" />
              Retorno
            </TabsTrigger>
            <TabsTrigger value="receipts" className="gap-2 data-[state=active]:bg-background">
              <Receipt className="h-4 w-4" />
              Comprovantes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Button variant="outline" onClick={() => handleNewPayment("billet")} className="h-auto py-4 flex-col gap-2">
                <FileText className="h-5 w-5" />
                <span className="text-xs">Boleto</span>
              </Button>
              <Button variant="outline" onClick={() => handleNewPayment("transfer")} className="h-auto py-4 flex-col gap-2">
                <Send className="h-5 w-5" />
                <span className="text-xs">Transferência</span>
              </Button>
              <Button variant="outline" onClick={() => handleNewPayment("pix")} className="h-auto py-4 flex-col gap-2">
                <CreditCard className="h-5 w-5" />
                <span className="text-xs">PIX</span>
              </Button>
              <Button variant="outline" onClick={() => handleNewPayment("paycheck")} className="h-auto py-4 flex-col gap-2">
                <Receipt className="h-5 w-5" />
                <span className="text-xs">Salário</span>
              </Button>
              <Button variant="outline" onClick={() => handleNewPayment("tax")} className="h-auto py-4 flex-col gap-2">
                <FileText className="h-5 w-5" />
                <span className="text-xs">Tributo</span>
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar pagamentos..."
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
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-4 font-medium text-sm">Beneficiário</th>
                        <th className="text-left p-4 font-medium text-sm">Tipo</th>
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
                            Carregando pagamentos...
                          </td>
                        </tr>
                      ) : filteredPayments?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            Nenhum pagamento encontrado
                          </td>
                        </tr>
                      ) : (
                        filteredPayments?.map((payment) => (
                          <tr key={payment.id} className="border-b hover:bg-muted/30">
                            <td className="p-4">
                              <div>
                                <p className="font-medium">{payment.beneficiary_name || "—"}</p>
                                <p className="text-sm text-muted-foreground">{payment.beneficiary_cpf_cnpj}</p>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline">{payment.payment_type}</Badge>
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
                            <td className="p-4 text-right">
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="remessa">
            <RemessaManager 
              bankAccounts={bankAccounts || []}
              payments={payments?.filter(p => p.status === "CREATED") || []}
              onRefresh={refetch}
            />
          </TabsContent>

          <TabsContent value="retorno">
            <Card>
              <CardHeader>
                <CardTitle>Arquivos de Retorno</CardTitle>
                <CardDescription>
                  Faça upload de arquivos de retorno bancário para atualizar o status dos pagamentos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Arraste um arquivo de retorno ou clique para selecionar
                  </p>
                  <Button variant="outline">Selecionar Arquivo</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts">
            <Card>
              <CardHeader>
                <CardTitle>Comprovantes de Pagamento</CardTitle>
                <CardDescription>
                  Visualize e baixe comprovantes de pagamentos efetuados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Selecione um pagamento com status "PAGO" para solicitar o comprovante
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <PaymentDialog
          open={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          paymentType={selectedPaymentType}
          bankAccounts={bankAccounts || []}
          companyId={currentOrganization?.id}
          onSuccess={() => {
            refetch();
            setIsPaymentDialogOpen(false);
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default BankPayments;
