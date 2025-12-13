import { useState } from "react";
import { CustomerList } from "@/components/customers/CustomerList";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { ContractList } from "@/components/contracts/ContractList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function CustomersTab() {
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground">Gestão de clientes e contratos</p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        )}
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <Users className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2">
            <FileText className="h-4 w-4" />
            Contratos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
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
  );
}
