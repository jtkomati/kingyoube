import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SupplierList } from "@/components/suppliers/SupplierList";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { useAuth } from "@/hooks/useAuth";

const Suppliers = () => {
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
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gradient-primary">
              Fornecedores
            </h1>
            <p className="text-muted-foreground mt-2">
              Gestão completa de fornecedores
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Fornecedor
            </Button>
          )}
        </div>

        <SupplierList onEdit={handleEdit} />

        <SupplierDialog
          open={isDialogOpen}
          onClose={handleDialogClose}
          supplier={selectedSupplier}
        />
      </div>
    </DashboardLayout>
  );
};

export default Suppliers;
