import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, XCircle, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { IssueInvoiceDialog } from "./IssueInvoiceDialog";
import { useAuth } from "@/hooks/useAuth";

export const OutgoingInvoices = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const { hasPermission } = useAuth();
  const canIssue = hasPermission("FISCAL");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["outgoing-invoices"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select(`
          *,
          categories(name),
          customers(first_name, last_name, company_name)
        `)
        .eq("type", "RECEIVABLE")
        .not("invoice_number", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar clientes separadamente
      const customerIds = data?.filter((t: any) => t.customer_id).map((t: any) => t.customer_id) || [];
      const { data: customers } = await (supabase as any)
        .from("customers")
        .select("*")
        .in("id", customerIds);

      return data?.map((transaction: any) => ({
        ...transaction,
        category: transaction.categories,
        customer: customers?.find((c: any) => c.id === transaction.customer_id),
      }));
    },
  });

  const { data: pendingTransactions } = useQuery({
    queryKey: ["pending-invoices"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("*")
        .eq("type", "RECEIVABLE")
        .is("invoice_number", null)
        .order("due_date", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const getStatusVariant = (status: string) => {
    const variants: Record<string, any> = {
      pending: "outline",
      issued: "default",
      cancelled: "destructive",
      rejected: "destructive",
    };
    return variants[status] || "outline";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendente",
      issued: "Emitida",
      cancelled: "Cancelada",
      rejected: "Rejeitada",
    };
    return labels[status] || status;
  };

  const handleIssueInvoice = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Emitidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invoices?.filter(i => i.invoice_status === "issued").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {pendingTransactions?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">
              {invoices?.filter(i => i.invoice_status === "cancelled").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {invoices?.reduce((sum, inv) => sum + Number(inv.gross_amount), 0).toFixed(0) || "0"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transações pendentes de emissão */}
      {pendingTransactions && pendingTransactions.length > 0 && canIssue && (
        <Card>
          <CardHeader>
            <CardTitle>Transações Pendentes de Emissão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingTransactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-muted-foreground">
                      Vencimento: {format(new Date(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{Number(transaction.gross_amount).toFixed(0)}</span>
                    <Button size="sm" onClick={() => handleIssueInvoice(transaction)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Emitir NF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de NFS-e emitidas */}
      <Card>
        <CardHeader>
          <CardTitle>Notas Fiscais Emitidas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número NF</TableHead>
                <TableHead>Data Emissão</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices?.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>
                    {format(new Date(invoice.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {invoice.customer?.company_name ||
                      `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`}
                  </TableCell>
                  <TableCell>{invoice.description}</TableCell>
                  <TableCell className="text-right">
                    {Number(invoice.gross_amount).toFixed(0)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(invoice.invoice_status)}>
                      {getStatusLabel(invoice.invoice_status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      {invoice.invoice_pdf_url && (
                        <Button variant="ghost" size="sm" title="Download PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {invoice.invoice_status === "issued" && (
                        <Button variant="ghost" size="sm" title="Cancelar NF">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!invoices?.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma nota fiscal emitida ainda
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <IssueInvoiceDialog
        open={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
      />
    </div>
  );
};
