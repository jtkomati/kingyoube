import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Settings } from "lucide-react";

const BankIntegrations = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gradient-primary">
              Integrações Bancárias
            </h1>
            <p className="text-muted-foreground mt-2">
              Conecte suas contas bancárias para sincronização automática
            </p>
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
    </DashboardLayout>
  );
};

export default BankIntegrations;
