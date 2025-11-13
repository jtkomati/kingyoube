import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Edit, FileText, Download, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionListProps {
  onEdit: (transaction: any) => void;
}

export const TransactionList = ({ onEdit }: TransactionListProps) => {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select(`
          *,
          categories(name)
        `)
        .order("due_date", { ascending: false });

      if (error) throw error;
      
      // Buscar clientes e fornecedores separadamente
      const customerIds = data?.filter((t: any) => t.customer_id).map((t: any) => t.customer_id) || [];
      const supplierIds = data?.filter((t: any) => t.supplier_id).map((t: any) => t.supplier_id) || [];
      
      const { data: customers } = await (supabase as any)
        .from("customers")
        .select("*")
        .in("id", customerIds);
        
      const { data: suppliers } = await (supabase as any)
        .from("suppliers")
        .select("*")
        .in("id", supplierIds);
      
      // Combinar dados
      return data?.map((transaction: any) => ({
        ...transaction,
        category: transaction.categories,
        customer: customers?.find(c => c.id === transaction.customer_id),
        supplier: suppliers?.find(s => s.id === transaction.supplier_id),
      }));
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  const getTypeLabel = (type: string) => {
    return type === "RECEIVABLE" ? "Receita" : "Despesa";
  };

  const getTypeVariant = (type: string) => {
    return type === "RECEIVABLE" ? "default" : "destructive";
  };

  const getInvoiceStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendente",
      issued: "Emitida",
      cancelled: "Cancelada",
      rejected: "Rejeitada",
    };
    return labels[status] || status;
  };

  const getInvoiceStatusVariant = (status: string) => {
    const variants: Record<string, any> = {
      pending: "outline",
      issued: "default",
      cancelled: "destructive",
      rejected: "destructive",
    };
    return variants[status] || "outline";
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">Data</TableHead>
              <TableHead className="min-w-[80px]">Tipo</TableHead>
              <TableHead className="min-w-[150px]">Descrição</TableHead>
              <TableHead className="min-w-[150px]">Cliente/Fornecedor</TableHead>
              <TableHead className="min-w-[120px]">Categoria</TableHead>
              <TableHead className="text-right min-w-[100px]">Valor Bruto</TableHead>
              <TableHead className="text-right min-w-[100px]">Valor Líquido</TableHead>
              <TableHead className="min-w-[100px]">NF</TableHead>
              <TableHead className="text-right min-w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {transactions?.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>
                {format(new Date(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
              <TableCell>
                <Badge variant={getTypeVariant(transaction.type)}>
                  {getTypeLabel(transaction.type)}
                </Badge>
              </TableCell>
              <TableCell>{transaction.description}</TableCell>
              <TableCell>
                {transaction.customer?.company_name ||
                  `${transaction.customer?.first_name || ""} ${transaction.customer?.last_name || ""}` ||
                  transaction.supplier?.company_name ||
                  `${transaction.supplier?.first_name || ""} ${transaction.supplier?.last_name || ""}` ||
                  "-"}
              </TableCell>
              <TableCell>{transaction.category?.name}</TableCell>
              <TableCell className="text-right">
                {Number(transaction.gross_amount).toFixed(0)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {Number(transaction.net_amount).toFixed(0)}
              </TableCell>
              <TableCell>
                {transaction.invoice_number ? (
                  <Badge variant={getInvoiceStatusVariant(transaction.invoice_status)}>
                    {getInvoiceStatusLabel(transaction.invoice_status)}
                  </Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(transaction)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {transaction.invoice_pdf_url && (
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!transactions?.length && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                Nenhuma transação encontrada
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        </Table>
      </div>
    </div>
  );
};
