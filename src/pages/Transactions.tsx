import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileDown, Filter, Upload, CheckCircle, AlertCircle, FileText, GitCompare } from "lucide-react";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const Transactions = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("FINANCEIRO");

  const handleEdit = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedTransaction(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transações</h1>
            <p className="text-sm text-muted-foreground">
              Gestão de receitas, despesas e conciliação bancária
            </p>
          </div>
        </div>

        <Tabs defaultValue="transactions" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-2 bg-muted/50 p-2">
            <TabsTrigger value="transactions" className="gap-2 data-[state=active]:bg-background">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Lançamentos</span>
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2 data-[state=active]:bg-background">
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">Conciliação</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Filtros</span>
                </Button>
                <Button variant="outline" size="sm">
                  <FileDown className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
                {canCreate && (
                  <Button onClick={() => setIsDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Nova Transação</span>
                  </Button>
                )}
              </div>

              <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">Total Receitas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold text-success">R$ 0,00</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">Total Despesas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold text-danger">R$ 0,00</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium">Saldo Líquido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">R$ 0,00</div>
                  </CardContent>
                </Card>
              </div>

              <TransactionList onEdit={handleEdit} />
            </div>
          </TabsContent>

          <TabsContent value="reconciliation">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Conciliação Bancária</h2>
                  <p className="text-sm text-muted-foreground">
                    Compare extratos bancários com transações registradas
                  </p>
                </div>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Extrato
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      <div className="text-2xl font-bold">0</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Conciliados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div className="text-2xl font-bold">0</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Taxa de Conciliação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0%</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Lançamentos para Conciliar</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum lançamento bancário importado ainda
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <TransactionDialog
          open={isDialogOpen}
          onClose={handleDialogClose}
          transaction={selectedTransaction}
        />
      </div>
    </DashboardLayout>
  );
};

export default Transactions;
