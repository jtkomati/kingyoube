import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, BarChart3, List } from "lucide-react";
import { BankConnectionHub } from "@/components/openfinance/BankConnectionHub";
import { FinancialDashboard } from "@/components/openfinance/FinancialDashboard";
import { TransactionsList } from "@/components/openfinance/TransactionsList";

export default function OpenFinance() {
  const [connectedBanks, setConnectedBanks] = useState<string[]>([]);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Open Finance</h1>
          <p className="text-muted-foreground">
            Conecte suas contas bancárias para conciliação automática e visão financeira consolidada
          </p>
        </div>

        <Tabs defaultValue="connections" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="connections" className="gap-2">
              <Building2 className="h-4 w-4" />
              Conexão de Contas
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2" disabled={connectedBanks.length === 0}>
              <BarChart3 className="h-4 w-4" />
              Dashboard Financeiro
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2" disabled={connectedBanks.length === 0}>
              <List className="h-4 w-4" />
              Extrato Inteligente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections">
            <BankConnectionHub 
              connectedBanks={connectedBanks}
              onBankConnected={(bankId) => setConnectedBanks([...connectedBanks, bankId])}
            />
          </TabsContent>

          <TabsContent value="dashboard">
            <FinancialDashboard />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionsList />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
