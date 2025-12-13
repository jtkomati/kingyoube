import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Settings, Building2, BarChart3, List, Link2 } from "lucide-react";
import { BankConnectionHub } from "@/components/openfinance/BankConnectionHub";
import { FinancialDashboard } from "@/components/openfinance/FinancialDashboard";
import { TransactionsList } from "@/components/openfinance/TransactionsList";

const BankIntegrations = () => {
  const [connectedBanks, setConnectedBanks] = useState<string[]>([]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Link2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
            <p className="text-sm text-muted-foreground">
              Conecte suas contas bancárias e APIs externas
            </p>
          </div>
        </div>

        <Tabs defaultValue="open-finance" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-2 bg-muted/50 p-2">
            <TabsTrigger value="open-finance" className="gap-2 data-[state=active]:bg-background">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Open Finance</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background" disabled={connectedBanks.length === 0}>
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2 data-[state=active]:bg-background" disabled={connectedBanks.length === 0}>
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Extrato Inteligente</span>
            </TabsTrigger>
            <TabsTrigger value="apis" className="gap-2 data-[state=active]:bg-background">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">APIs Bancárias</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open-finance">
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

          <TabsContent value="apis">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">APIs Bancárias</h2>
                  <p className="text-sm text-muted-foreground">Integrações diretas com APIs corporativas</p>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Conectar Banco
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>Bradesco</CardTitle>
                        <CardDescription>Open Finance Brasil</CardDescription>
                      </div>
                      <Badge variant="outline">Não Conectado</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Sincronize extratos bancários automaticamente via Open Finance
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>Bank of America</CardTitle>
                        <CardDescription>Business Banking API</CardDescription>
                      </div>
                      <Badge variant="outline">Não Conectado</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Integração com API corporativa do Bank of America
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Sincronizações</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Nenhuma sincronização realizada ainda
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default BankIntegrations;
