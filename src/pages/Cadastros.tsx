import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomersTab } from "@/components/cadastros/CustomersTab";
import { SuppliersTab } from "@/components/cadastros/SuppliersTab";
import { ChartOfAccountsTab } from "@/components/cadastros/ChartOfAccountsTab";
import { ManagementChartTab } from "@/components/cadastros/ManagementChartTab";
import { ReferentialChartTab } from "@/components/cadastros/ReferentialChartTab";
import { CostCentersTab } from "@/components/cadastros/CostCentersTab";
import { ProfitCentersTab } from "@/components/cadastros/ProfitCentersTab";
import { ProjectsTab } from "@/components/cadastros/ProjectsTab";
import { UserRolesTab } from "@/components/cadastros/UserRolesTab";
import { CompaniesTab } from "@/components/cadastros/CompaniesTab";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  Truck, 
  BookOpen, 
  PieChart, 
  FileSpreadsheet,
  Target,
  TrendingUp,
  FolderKanban,
  Database,
  ShieldCheck,
  Building2
} from "lucide-react";

export default function Cadastros() {
  const { userRole } = useAuth();
  const isSuperAdmin = userRole === "SUPERADMIN";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cadastros</h1>
            <p className="text-sm text-muted-foreground">
              Gestão centralizada de cadastros do sistema
            </p>
          </div>
        </div>

        <Tabs defaultValue={isSuperAdmin ? "companies" : "customers"} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-2 bg-muted/50 p-2">
            {isSuperAdmin && (
              <TabsTrigger value="companies" className="gap-2 data-[state=active]:bg-background">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Empresas</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="customers" className="gap-2 data-[state=active]:bg-background">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-2 data-[state=active]:bg-background">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Fornecedores</span>
            </TabsTrigger>
            <TabsTrigger value="user-roles" className="gap-2 data-[state=active]:bg-background">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Perfis</span>
            </TabsTrigger>
            <TabsTrigger value="chart-accounts" className="gap-2 data-[state=active]:bg-background">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Plano de Contas</span>
            </TabsTrigger>
            <TabsTrigger value="chart-management" className="gap-2 data-[state=active]:bg-background">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">P.C. Gerencial</span>
            </TabsTrigger>
            <TabsTrigger value="chart-referential" className="gap-2 data-[state=active]:bg-background">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">P.C. Referencial</span>
            </TabsTrigger>
            <TabsTrigger value="cost-centers" className="gap-2 data-[state=active]:bg-background">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Centros de Custos</span>
            </TabsTrigger>
            <TabsTrigger value="profit-centers" className="gap-2 data-[state=active]:bg-background">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Centros de Lucros</span>
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2 data-[state=active]:bg-background">
              <FolderKanban className="h-4 w-4" />
              <span className="hidden sm:inline">Projetos</span>
            </TabsTrigger>
          </TabsList>

          {isSuperAdmin && (
            <TabsContent value="companies">
              <CompaniesTab />
            </TabsContent>
          )}

          <TabsContent value="customers">
            <CustomersTab />
          </TabsContent>

          <TabsContent value="suppliers">
            <SuppliersTab />
          </TabsContent>

          <TabsContent value="user-roles">
            <UserRolesTab />
          </TabsContent>

          <TabsContent value="chart-accounts">
            <ChartOfAccountsTab />
          </TabsContent>

          <TabsContent value="chart-management">
            <ManagementChartTab />
          </TabsContent>

          <TabsContent value="chart-referential">
            <ReferentialChartTab />
          </TabsContent>

          <TabsContent value="cost-centers">
            <CostCentersTab />
          </TabsContent>

          <TabsContent value="profit-centers">
            <ProfitCentersTab />
          </TabsContent>

          <TabsContent value="projects">
            <ProjectsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
