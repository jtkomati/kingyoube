import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Download } from "lucide-react";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BankAccount {
  id: string;
  bank_name: string;
  account_hash: string | null;
  agency: string | null;
  account_number: string | null;
}

interface Payment {
  id: string;
  unique_id: string | null;
  beneficiary_name: string | null;
  amount: number | null;
  due_date: string | null;
  status: string | null;
  payment_type: string | null;
}

interface RemessaManagerProps {
  bankAccounts: BankAccount[];
  payments: Payment[];
  onRefresh: () => void;
}

export const RemessaManager = ({ bankAccounts, payments, onRefresh }: RemessaManagerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [generatedRemessa, setGeneratedRemessa] = useState<string | null>(null);

  const filteredPayments = payments.filter(p => {
    if (!selectedAccount) return true;
    return true; // In real implementation, filter by account
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPayments(filteredPayments.map(p => p.unique_id!).filter(Boolean));
    } else {
      setSelectedPayments([]);
    }
  };

  const handleSelectPayment = (uniqueId: string, checked: boolean) => {
    if (checked) {
      setSelectedPayments([...selectedPayments, uniqueId]);
    } else {
      setSelectedPayments(selectedPayments.filter(id => id !== uniqueId));
    }
  };

  const handleGenerateRemessa = async () => {
    if (!selectedAccount) {
      toast.error("Selecione uma conta bancária");
      return;
    }

    if (selectedPayments.length === 0) {
      toast.error("Selecione pelo menos um pagamento");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-generate-remessa", {
        body: {
          accountHash: selectedAccount,
          uniqueIds: selectedPayments,
        },
      });

      if (error) throw error;

      setGeneratedRemessa(data.fileContent);
      toast.success(`Remessa gerada com sucesso! Protocolo: ${data.protocol}`);
      onRefresh();
    } catch (error) {
      console.error("Error generating remessa:", error);
      toast.error("Erro ao gerar arquivo de remessa");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadRemessa = () => {
    if (!generatedRemessa) return;

    const blob = new Blob([generatedRemessa], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remessa_${format(new Date(), "yyyyMMdd_HHmmss")}.rem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gerar Arquivo de Remessa</CardTitle>
          <CardDescription>
            Selecione a conta e os pagamentos para gerar o arquivo CNAB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta bancária" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.account_hash || account.id}>
                      {account.bank_name} - Ag: {account.agency} / CC: {account.account_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleGenerateRemessa} 
              disabled={isLoading || selectedPayments.length === 0}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Gerar Remessa ({selectedPayments.length})
            </Button>
          </div>

          {generatedRemessa && (
            <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="flex-1 text-sm text-green-700 dark:text-green-300">
                Arquivo de remessa gerado com sucesso!
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadRemessa} className="gap-2">
                <Download className="h-4 w-4" />
                Baixar Arquivo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Pagamentos Pendentes</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedPayments.length === filteredPayments.length && filteredPayments.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">Selecionar todos</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="w-12 p-4"></th>
                  <th className="text-left p-4 font-medium text-sm">Beneficiário</th>
                  <th className="text-left p-4 font-medium text-sm">Tipo</th>
                  <th className="text-left p-4 font-medium text-sm">Valor</th>
                  <th className="text-left p-4 font-medium text-sm">Vencimento</th>
                  <th className="text-left p-4 font-medium text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Nenhum pagamento pendente para gerar remessa
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-muted/30">
                      <td className="p-4">
                        <Checkbox
                          checked={selectedPayments.includes(payment.unique_id!)}
                          onCheckedChange={(checked) => 
                            handleSelectPayment(payment.unique_id!, checked as boolean)
                          }
                          disabled={!payment.unique_id}
                        />
                      </td>
                      <td className="p-4">
                        <p className="font-medium">{payment.beneficiary_name || "—"}</p>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {payment.payment_type}
                      </td>
                      <td className="p-4 font-medium">
                        {formatCurrency(Number(payment.amount) || 0)}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {payment.due_date 
                          ? format(new Date(payment.due_date), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="p-4">
                        <PaymentStatusBadge status={payment.status || "CREATED"} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
