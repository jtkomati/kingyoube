import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerList } from "@/components/customers/CustomerList";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { ContractList } from "@/components/contracts/ContractList";
import { Button } from "@/components/ui/button";
import { Plus, Users, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Customers = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("FINANCEIRO");

  const handleEdit = (customer: any) => {
    setSelectedCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedCustomer(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gradient-primary">
              Clientes
            </h1>
            <p className="text-muted-foreground mt-2">
              Gestão completa de clientes e contratos
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          )}
        </div>

        <Tabs defaultValue="customers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="customers" className="gap-2">
              <Users className="h-4 w-4" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-2">
              <FileText className="h-4 w-4" />
              Contratos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers">
            <CustomerList onEdit={handleEdit} />
          </TabsContent>

          <TabsContent value="contracts">
            <ContractList entityType="customer" />
          </TabsContent>
        </Tabs>

        <CustomerDialog
          open={isDialogOpen}
          onClose={handleDialogClose}
          customer={selectedCustomer}
        />
      </div>
    </DashboardLayout>
  );
};

export default Customers;
