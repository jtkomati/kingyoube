import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, CreditCard, BarChart3, GitCompare } from "lucide-react";
import { ReconciliationTab } from "@/components/openfinance/ReconciliationTab";
import { BankAccountForm } from "@/components/openfinance/BankAccountForm";
import { StatementDashboard } from "@/components/openfinance/StatementDashboard";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const BankIntegrations = () => {
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const [payerId, setPayerId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<{
    id?: string;
    cnpj?: string;
    companyName?: string;
    payerStatus?: string;
    payerId?: string;
  } | null>(null);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadPlugBankStatus(currentOrganization.id);
    } else {
      setCompanyData(null);
      setPayerId(null);
    }
  }, [currentOrganization?.id]);

  const loadPlugBankStatus = async (companyId: string) => {
    const { data: company } = await supabase
      .from("company_settings")
      .select("id, cnpj, company_name, plugbank_payer_id, plugbank_status")
      .eq("id", companyId)
      .single();

    if (company) {
      setCompanyData({
        id: company.id,
        cnpj: company.cnpj,
        companyName: company.company_name,
        payerStatus: company.plugbank_status,
        payerId: company.plugbank_payer_id,
      });
      if (company.plugbank_payer_id) {
        setPayerId(company.plugbank_payer_id);
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Open Finance</h1>
            <p className="text-sm text-muted-foreground">
              Conecte suas contas bancárias via Open Finance
            </p>
          </div>
        </div>

        <Tabs defaultValue="contas" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-2 bg-muted/50 p-2">
            <TabsTrigger value="contas" className="gap-2 data-[state=active]:bg-background">
              <CreditCard className="h-4 w-4" />
              Contas Bancárias
            </TabsTrigger>
            <TabsTrigger value="extrato" className="gap-2 data-[state=active]:bg-background" disabled={!accountId}>
              <BarChart3 className="h-4 w-4" />
              Extrato
            </TabsTrigger>
            <TabsTrigger value="conciliacao" className="gap-2 data-[state=active]:bg-background">
              <GitCompare className="h-4 w-4" />
              Conciliação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contas">
            <BankAccountForm
              companyData={companyData}
              onPayerRegistered={(id) => {
                setPayerId(id);
                if (currentOrganization?.id) {
                  loadPlugBankStatus(currentOrganization.id);
                }
              }}
              onAccountConnected={(accId) => setAccountId(accId)}
            />
          </TabsContent>

          <TabsContent value="extrato">
            <StatementDashboard
              accountId={accountId || undefined}
              companyId={companyData?.id}
            />
          </TabsContent>

          <TabsContent value="conciliacao">
            <ReconciliationTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default BankIntegrations;
