import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface CancelInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: any;
}

export const CancelInvoiceDialog = ({ open, onClose, transaction }: CancelInvoiceDialogProps) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const handleCancel = async () => {
    if (!transaction || reason.length < 15) {
      toast.error("O motivo deve ter pelo menos 15 caracteres");
      return;
    }

    setIsCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-nfse", {
        body: {
          transaction_id: transaction.id,
          reason,
        },
      });

      if (error) throw error;

      toast.success(data.message || "Nota fiscal cancelada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["outgoing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["pending-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setReason("");
      onClose();
    } catch (error: any) {
      toast.error("Erro ao cancelar nota fiscal: " + error.message);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar Nota Fiscal
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. A nota fiscal será cancelada junto à prefeitura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p><strong>Número NF:</strong> {transaction.invoice_number}</p>
            <p><strong>Valor:</strong> R$ {Number(transaction.gross_amount).toFixed(2)}</p>
          </div>

          <div>
            <Label htmlFor="reason">Motivo do Cancelamento *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Informe o motivo do cancelamento (mínimo 15 caracteres)"
              rows={3}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {reason.length}/15 caracteres mínimos
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isCancelling}>
              Voltar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel} 
              disabled={isCancelling || reason.length < 15}
            >
              {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCancelling ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
