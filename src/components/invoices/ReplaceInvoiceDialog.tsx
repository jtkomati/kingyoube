import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Info } from "lucide-react";

interface ReplaceInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: any;
}

export const ReplaceInvoiceDialog = ({ open, onClose, transaction }: ReplaceInvoiceDialogProps) => {
  const [isReplacing, setIsReplacing] = useState(false);
  const [reason, setReason] = useState("");
  const [serviceDescription, setServiceDescription] = useState(transaction?.service_description || transaction?.description || "");
  const [serviceCode, setServiceCode] = useState(transaction?.service_code || "");
  const [amount, setAmount] = useState(transaction?.gross_amount?.toString() || "");
  const queryClient = useQueryClient();

  const handleReplace = async () => {
    if (!reason || reason.length < 15) {
      toast.error("O motivo deve ter no mínimo 15 caracteres");
      return;
    }

    setIsReplacing(true);
    try {
      const { data, error } = await supabase.functions.invoke("replace-nfse", {
        body: {
          transaction_id: transaction.id,
          service_code: serviceCode,
          service_description: serviceDescription,
          gross_amount: amount ? parseFloat(amount) : undefined,
          reason,
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.city_support === false) {
          toast.error(data.error, {
            description: data.suggestion,
            duration: 8000,
          });
        } else {
          toast.error(data.error);
        }
        return;
      }

      toast.success("Substituição de NFS-e iniciada!", {
        description: `Nova nota em processamento. ID: ${data.new_integration_id}`,
      });

      queryClient.invalidateQueries({ queryKey: ["outgoing-invoices"] });
      onClose();
    } catch (error: any) {
      console.error("Error replacing invoice:", error);
      toast.error("Erro ao substituir NFS-e: " + error.message);
    } finally {
      setIsReplacing(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setServiceDescription(transaction?.service_description || transaction?.description || "");
    setServiceCode(transaction?.service_code || "");
    setAmount(transaction?.gross_amount?.toString() || "");
    onClose();
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Substituir NFS-e
          </DialogTitle>
          <DialogDescription>
            Substitua a nota fiscal nº {transaction.invoice_number} por uma nova
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="default" className="border-warning/50 bg-warning/10">
            <Info className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm">
              A substituição depende do suporte da prefeitura da cidade. Caso não seja suportada, 
              você deverá cancelar a nota e emitir uma nova.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo da Substituição *</Label>
              <Textarea
                id="reason"
                placeholder="Descreva o motivo da substituição (mínimo 15 caracteres)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">
                {reason.length}/15 caracteres mínimos
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Descrição do Serviço</Label>
              <Textarea
                id="serviceDescription"
                placeholder="Descrição do serviço na nova nota"
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceCode">Código do Serviço</Label>
                <Input
                  id="serviceCode"
                  placeholder="Ex: 1.02"
                  value={serviceCode}
                  onChange={(e) => setServiceCode(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Alert variant="destructive" className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              A nota original será marcada como substituída e não poderá mais ser utilizada.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isReplacing}>
            Cancelar
          </Button>
          <Button 
            onClick={handleReplace} 
            disabled={isReplacing || reason.length < 15}
          >
            {isReplacing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Substituindo...
              </>
            ) : (
              "Confirmar Substituição"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
