import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { FileText, Download, XCircle, Plus, RefreshCw, FileCode, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { IssueInvoiceDialog } from "./IssueInvoiceDialog";
import { CancelInvoiceDialog } from "./CancelInvoiceDialog";
import { NewInvoiceDialog } from "./NewInvoiceDialog";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const OutgoingInvoices = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const { hasPermission, currentOrganization } = useAuth();
  const canIssue = hasPermission("FISCAL");
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["outgoing-invoices", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select(`
          *,
          categories(name),
          customers(first_name, last_name, company_name)
        `)
        .eq("type", "RECEIVABLE")
        .eq("company_id", currentOrganization.id)
        .not("invoice_number", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

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
    enabled: !!currentOrganization?.id,
  });

  const { data: pendingTransactions } = useQuery({
    queryKey: ["pending-invoices", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("*")
        .eq("type", "RECEIVABLE")
        .eq("company_id", currentOrganization.id)
        .is("invoice_number", null)
        .order("due_date", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const handleIssueInvoice = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsDialogOpen(true);
  };

  const handleCancelInvoice = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsCancelDialogOpen(true);
  };

  const handleRefreshStatus = async (transaction: any) => {
    setRefreshingIds(prev => new Set(prev).add(transaction.id));
    try {
      const { data, error } = await supabase.functions.invoke("check-nfse-status", {
        body: { transaction_id: transaction.id },
      });

      if (error) throw error;

      if (data.status === "issued") {
        toast.success(`NFS-e ${data.invoice_number} autorizada!`);
      } else if (data.status === "rejected") {
        toast.error(`NFS-e rejeitada: ${data.plugnotas_data?.mensagem || 'Verifique os dados'}`);
      } else {
        toast.info(`Status: ${data.status}`);
      }
      
      queryClient.invalidateQueries({ queryKey: ["outgoing-invoices"] });
    } catch (error: any) {
      toast.error("Erro ao consultar status: " + error.message);
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(transaction.id);
        return next;
      });
    }
  };

  const handleDownload = async (transaction: any, format: 'pdf' | 'xml') => {
    const downloadKey = `${transaction.id}-${format}`;
    setDownloadingIds(prev => new Set(prev).add(downloadKey));
    try {
      const { data, error } = await supabase.functions.invoke("download-nfse", {
        body: { transaction_id: transaction.id, format },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, '_blank');
        toast.success(`Download do ${format.toUpperCase()} iniciado`);
      } else {
        toast.error("URL de download não disponível");
      }
    } catch (error: any) {
      toast.error(`Erro ao baixar ${format.toUpperCase()}: ` + error.message);
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(downloadKey);
        return next;
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with action button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">NFS-e Emitidas</h2>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            <FlaskConical className="h-3 w-3 mr-1" />
            SANDBOX
          </Badge>
        </div>
        {canIssue && (
          <Button onClick={() => setIsNewDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Emitir Nova NFS-e
          </Button>
        )}
      </div>

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
              R$ {invoices?.filter(i => i.invoice_status === "issued").reduce((sum, inv) => sum + Number(inv.gross_amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || "0,00"}
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
                    <span className="font-semibold">
                      R$ {Number(transaction.gross_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
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
                  <TableCell className="max-w-[200px] truncate">{invoice.description}</TableCell>
                  <TableCell className="text-right">
                    R$ {Number(invoice.gross_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={invoice.invoice_status} showIcon />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {/* Botão de atualizar status para notas em processamento */}
                      {invoice.invoice_status === "processing" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Atualizar Status"
                          onClick={() => handleRefreshStatus(invoice)}
                          disabled={refreshingIds.has(invoice.id)}
                        >
                          <RefreshCw className={`h-4 w-4 ${refreshingIds.has(invoice.id) ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                      
                      {/* Download PDF */}
                      {invoice.invoice_status === "issued" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Download PDF"
                          onClick={() => handleDownload(invoice, 'pdf')}
                          disabled={downloadingIds.has(`${invoice.id}-pdf`)}
                        >
                          <Download className={`h-4 w-4 ${downloadingIds.has(`${invoice.id}-pdf`) ? 'animate-pulse' : ''}`} />
                        </Button>
                      )}
                      
                      {/* Download XML */}
                      {invoice.invoice_status === "issued" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Download XML"
                          onClick={() => handleDownload(invoice, 'xml')}
                          disabled={downloadingIds.has(`${invoice.id}-xml`)}
                        >
                          <FileCode className={`h-4 w-4 ${downloadingIds.has(`${invoice.id}-xml`) ? 'animate-pulse' : ''}`} />
                        </Button>
                      )}
                      
                      {/* Cancelar NF */}
                      {invoice.invoice_status === "issued" && canIssue && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Cancelar NF"
                          onClick={() => handleCancelInvoice(invoice)}
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
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

      <CancelInvoiceDialog
        open={isCancelDialogOpen}
        onClose={() => {
          setIsCancelDialogOpen(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
      />

      <NewInvoiceDialog
        open={isNewDialogOpen}
        onClose={() => setIsNewDialogOpen(false)}
      />
    </div>
  );
};
