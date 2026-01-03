import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Building2, 
  Calendar,
  Barcode,
  Loader2,
  Ban,
  CheckCircle
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DDABoleto {
  id: string;
  barcode: string;
  digitable_line: string;
  beneficiary_name: string;
  beneficiary_cpf_cnpj: string;
  beneficiary_bank_code: string;
  beneficiary_bank_name: string;
  nominal_amount: number;
  discount_amount: number;
  interest_amount: number;
  fine_amount: number;
  final_amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  our_number: string;
  document_number: string;
  description: string;
}

interface DDABoletoDialogProps {
  boleto: DDABoleto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const DDABoletoDialog = ({ boleto, open, onOpenChange, onSuccess }: DDABoletoDialogProps) => {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState("");

  const processMutation = useMutation({
    mutationFn: async ({ action }: { action: 'pay' | 'ignore' }) => {
      const { data, error } = await supabase.functions.invoke("payment-dda-process", {
        body: { 
          boletoId: boleto?.id, 
          action,
          paymentDate: action === 'pay' ? paymentDate : undefined,
          description: action === 'pay' ? description : undefined,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.action === 'paid') {
        toast.success("Pagamento criado com sucesso!");
      } else {
        toast.success("Boleto marcado como ignorado");
      }
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  if (!boleto) return null;

  const isPending = boleto.status === 'PENDING';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Boleto DDA
          </DialogTitle>
          <DialogDescription>
            Detalhes do boleto recebido via Débito Direto Autorizado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Beneficiary Info */}
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
            <Building2 className="h-10 w-10 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-lg">{boleto.beneficiary_name}</p>
              <p className="text-muted-foreground">{boleto.beneficiary_cpf_cnpj}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {boleto.beneficiary_bank_name || `Banco ${boleto.beneficiary_bank_code}`}
              </p>
            </div>
            <Badge variant={
              boleto.status === 'PAID' ? 'default' :
              boleto.status === 'IGNORED' ? 'secondary' :
              'outline'
            }>
              {boleto.status === 'PENDING' ? 'Pendente' :
               boleto.status === 'PAID' ? 'Pago' :
               boleto.status === 'IGNORED' ? 'Ignorado' :
               boleto.status}
            </Badge>
          </div>

          {/* Barcode */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Barcode className="h-4 w-4" />
              Linha Digitável
            </Label>
            <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
              {boleto.digitable_line || boleto.barcode}
            </div>
          </div>

          <Separator />

          {/* Values */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-muted-foreground">Valor Nominal</Label>
              <p className="font-medium">{formatCurrency(boleto.nominal_amount)}</p>
            </div>
            {boleto.discount_amount > 0 && (
              <div>
                <Label className="text-muted-foreground">Desconto</Label>
                <p className="font-medium text-green-600">-{formatCurrency(boleto.discount_amount)}</p>
              </div>
            )}
            {boleto.interest_amount > 0 && (
              <div>
                <Label className="text-muted-foreground">Juros</Label>
                <p className="font-medium text-red-600">+{formatCurrency(boleto.interest_amount)}</p>
              </div>
            )}
            {boleto.fine_amount > 0 && (
              <div>
                <Label className="text-muted-foreground">Multa</Label>
                <p className="font-medium text-red-600">+{formatCurrency(boleto.fine_amount)}</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-primary/5 rounded-lg flex items-center justify-between">
            <span className="text-muted-foreground">Valor Final</span>
            <span className="text-2xl font-bold">{formatCurrency(boleto.final_amount)}</span>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-muted-foreground">Emissão</Label>
                <p className="font-medium">
                  {boleto.issue_date ? format(new Date(boleto.issue_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-muted-foreground">Vencimento</Label>
                <p className="font-medium">
                  {boleto.due_date ? format(new Date(boleto.due_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          {(boleto.our_number || boleto.document_number) && (
            <div className="grid grid-cols-2 gap-4">
              {boleto.our_number && (
                <div>
                  <Label className="text-muted-foreground">Nosso Número</Label>
                  <p className="font-medium">{boleto.our_number}</p>
                </div>
              )}
              {boleto.document_number && (
                <div>
                  <Label className="text-muted-foreground">Nº Documento</Label>
                  <p className="font-medium">{boleto.document_number}</p>
                </div>
              )}
            </div>
          )}

          {/* Payment Form (only for pending) */}
          {isPending && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium">Dados do Pagamento</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentDate">Data de Pagamento</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Adicione uma descrição para este pagamento..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isPending ? (
            <>
              <Button
                variant="outline"
                onClick={() => processMutation.mutate({ action: 'ignore' })}
                disabled={processMutation.isPending}
                className="gap-2"
              >
                {processMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                Ignorar
              </Button>
              <Button
                onClick={() => processMutation.mutate({ action: 'pay' })}
                disabled={processMutation.isPending}
                className="gap-2"
              >
                {processMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Processar Pagamento
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
