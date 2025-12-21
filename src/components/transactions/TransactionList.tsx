import { useState } from "react";
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
import { Edit, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface TransactionListProps {
  onEdit: (transaction: any) => void;
}

const PAGE_SIZE = 20;

export const TransactionList = ({ onEdit }: TransactionListProps) => {
  const [page, setPage] = useState(0);
  const { currentOrganization } = useAuth();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["transactions", page, currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) {
        return { transactions: [], totalCount: 0, totalPages: 0 };
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await (supabase as any)
        .from("transactions")
        .select(`
          id,
          type,
          description,
          gross_amount,
          net_amount,
          due_date,
          payment_date,
          invoice_number,
          invoice_status,
          invoice_pdf_url,
          customer_id,
          supplier_id,
          category_id,
          categories!inner(name),
          customers:customer_id(id, first_name, last_name, company_name),
          suppliers:supplier_id(id, first_name, last_name, company_name)
        `, { count: "exact" })
        .eq("company_id", currentOrganization.id)
        .order("due_date", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const transactions = data?.map((t: any) => ({
        ...t,
        category: t.categories,
        customer: t.customers,
        supplier: t.suppliers,
      })) || [];

      return {
        transactions,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
      };
    },
    enabled: !!currentOrganization?.id,
    placeholderData: (previousData) => previousData,
  });

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!currentOrganization?.id) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Selecione uma organização para visualizar as transações
      </div>
    );
  }

  const { transactions, totalCount, totalPages } = data || { transactions: [], totalCount: 0, totalPages: 0 };

  return (
    <div className="space-y-4">
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
              {transactions?.map((transaction: any) => (
                <TableRow key={transaction.id} className={isFetching ? "opacity-50" : ""}>
                  <TableCell>
                    {format(new Date(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTypeVariant(transaction.type)}>
                      {getTypeLabel(transaction.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {transaction.description}
                  </TableCell>
                  <TableCell>
                    {transaction.customer?.company_name ||
                      (transaction.customer?.first_name
                        ? `${transaction.customer.first_name} ${transaction.customer.last_name || ""}`
                        : null) ||
                      transaction.supplier?.company_name ||
                      (transaction.supplier?.first_name
                        ? `${transaction.supplier.first_name} ${transaction.supplier.last_name || ""}`
                        : null) ||
                      "-"}
                  </TableCell>
                  <TableCell>{transaction.category?.name || "-"}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(transaction.gross_amount))}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(transaction.net_amount))}
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
                        <Button variant="ghost" size="sm" asChild>
                          <a href={transaction.invoice_pdf_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount} transações
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isFetching}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || isFetching}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
