import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface IssueInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: any;
}

export const IssueInvoiceDialog = ({ open, onClose, transaction }: IssueInvoiceDialogProps) => {
  const [isIssuing, setIsIssuing] = useState(false);
  const [serviceCode, setServiceCode] = useState("01.01");
  const [serviceDescription, setServiceDescription] = useState("");
  const queryClient = useQueryClient();

  const handleIssue = async () => {
    if (!transaction) return;

    setIsIssuing(true);
    try {
      // Chamar edge function para emitir NFS-e
      const { data, error } = await supabase.functions.invoke("issue-nfse", {
        body: {
          transaction_id: transaction.id,
          service_code: serviceCode,
          service_description: serviceDescription || transaction.description,
        },
      });

      if (error) throw error;

      toast.success("Nota fiscal emitida com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["outgoing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["pending-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      onClose();
    } catch (error: any) {
      toast.error("Erro ao emitir nota fiscal: " + error.message);
    } finally {
      setIsIssuing(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Emitir Nota Fiscal de Serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">Dados da Transação</h3>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Descrição</Label>
                <p className="font-medium">{transaction.description}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Valor Bruto</Label>
                <p className="font-medium">R$ {Number(transaction.gross_amount).toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Valor Líquido</Label>
                <p className="font-medium">R$ {Number(transaction.net_amount).toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Regime Tributário</Label>
                <p className="font-medium">{transaction.tax_regime || "SIMPLES"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceCode">Código de Serviço (LC 116/2003)</Label>
              <Input
                id="serviceCode"
                value={serviceCode}
                onChange={(e) => setServiceCode(e.target.value)}
                placeholder="Ex: 01.01"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Consulte a lista de serviços da LC 116/2003
              </p>
            </div>

            <div>
              <Label htmlFor="serviceDescription">Discriminação do Serviço</Label>
              <Textarea
                id="serviceDescription"
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                placeholder="Descreva o serviço prestado em detalhes"
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Descrição detalhada que aparecerá na nota fiscal
              </p>
            </div>
          </div>

          <div className="bg-primary/5 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Impostos Calculados</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>ISS ({transaction.iss_rate || 5}%):</span>
                <span>R$ {(Number(transaction.gross_amount) * ((transaction.iss_rate || 5) / 100)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>COFINS ({transaction.cofins_rate || 3}%):</span>
                <span>R$ {(Number(transaction.gross_amount) * ((transaction.cofins_rate || 3) / 100)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>PIS ({transaction.pis_rate || 0.65}%):</span>
                <span>R$ {(Number(transaction.gross_amount) * ((transaction.pis_rate || 0.65) / 100)).toFixed(2)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Total de Impostos:</span>
                <span>R$ {(Number(transaction.gross_amount) - Number(transaction.net_amount)).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isIssuing}>
              Cancelar
            </Button>
            <Button onClick={handleIssue} disabled={isIssuing}>
              {isIssuing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isIssuing ? "Emitindo..." : "Emitir NFS-e"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
