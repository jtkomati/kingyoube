import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit } from "lucide-react";

interface CustomerListProps {
  onEdit: (customer: any) => void;
}

export const CustomerList = ({ onEdit }: CustomerListProps) => {
  const { currentOrganization } = useAuth();

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await (supabase as any)
        .from("customers")
        .select("*")
        .eq("company_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  if (!currentOrganization?.id) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Selecione uma organização para visualizar os clientes
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Nome/Razão Social</TableHead>
            <TableHead>CPF/CNPJ</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers?.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>
                <Badge variant={customer.person_type === "PF" ? "outline" : "default"}>
                  {customer.person_type}
                </Badge>
              </TableCell>
              <TableCell>
                {customer.person_type === "PF"
                  ? `${customer.first_name} ${customer.last_name}`
                  : customer.company_name}
              </TableCell>
              <TableCell>
                {customer.person_type === "PF" ? customer.cpf : customer.cnpj}
              </TableCell>
              <TableCell>{customer.email || "-"}</TableCell>
              <TableCell>{customer.phone || "-"}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(customer)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!customers?.length && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Nenhum cliente encontrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
