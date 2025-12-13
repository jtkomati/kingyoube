import { useState } from "react";
import { SupplierList } from "@/components/suppliers/SupplierList";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { ContractList } from "@/components/contracts/ContractList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function SuppliersTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("FINANCEIRO");

  const handleEdit = (supplier: any) => {
    setSelectedSupplier(supplier);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedSupplier(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Fornecedores</h2>
          <p className="text-sm text-muted-foreground">Gestão de fornecedores e contratos</p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Fornecedor
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
          <SupplierList onEdit={handleEdit} />
        </TabsContent>

        <TabsContent value="contracts">
          <ContractList entityType="supplier" />
        </TabsContent>
      </Tabs>

      <SupplierDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        supplier={selectedSupplier}
      />
    </div>
  );
}
