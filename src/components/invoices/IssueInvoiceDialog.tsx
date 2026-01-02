import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ServiceCodeSelect } from "./ServiceCodeSelect";
import { type ServiceCode } from "@/lib/service-codes-osasco";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface IssueInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: any;
}

export const IssueInvoiceDialog = ({ open, onClose, transaction }: IssueInvoiceDialogProps) => {
  const [isIssuing, setIsIssuing] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceCode | null>(null);
  const [serviceDescription, setServiceDescription] = useState("");
  const queryClient = useQueryClient();

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      setServiceDescription(transaction.description || "");
      setSelectedService(null);
    }
  }, [transaction]);

  const handleServiceSelect = (service: ServiceCode) => {
    setSelectedService(service);
  };

  const handleIssue = async () => {
    if (!transaction) return;

    if (!selectedService) {
      toast.error("Selecione o código de serviço");
      return;
    }

    setIsIssuing(true);
    try {
      const { data, error } = await supabase.functions.invoke("issue-nfse", {
        body: {
          transaction_id: transaction.id,
          service_code: selectedService.code,
          service_description: serviceDescription || transaction.description,
        },
      });

      if (error) throw error;

      if (data.sandbox_mode) {
        toast.success("NFS-e emitida em modo SANDBOX (teste)!");
      } else {
        toast.success("NFS-e enviada para processamento!");
      }
      
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

  const issRate = selectedService?.aliquota || transaction.iss_rate || 5;
  const issAmount = Number(transaction.gross_amount) * (issRate / 100);
  const netAmount = Number(transaction.gross_amount) - issAmount;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Emitir Nota Fiscal de Serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="default" className="bg-warning/10 border-warning/30">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              Modo Sandbox ativo - A nota será emitida em ambiente de teste
            </AlertDescription>
          </Alert>

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
                <p className="font-medium">
                  R$ {Number(transaction.gross_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código de Serviço (LC 116/2003) *</Label>
              <ServiceCodeSelect
                value={selectedService?.code}
                onSelect={handleServiceSelect}
              />
              {selectedService && (
                <p className="text-xs text-muted-foreground">
                  CNAE: {selectedService.cnae} | ISS: {selectedService.aliquota}%
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Discriminação do Serviço</Label>
              <Textarea
                id="serviceDescription"
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                placeholder="Descreva o serviço prestado em detalhes"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Descrição detalhada que aparecerá na nota fiscal
              </p>
            </div>
          </div>

          <div className="bg-primary/5 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Impostos Calculados</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>ISS ({issRate}%):</span>
                <span>R$ {issAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              {transaction.cofins_rate && (
                <div className="flex justify-between">
                  <span>COFINS ({transaction.cofins_rate}%):</span>
                  <span>
                    R$ {(Number(transaction.gross_amount) * (transaction.cofins_rate / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {transaction.pis_rate && (
                <div className="flex justify-between">
                  <span>PIS ({transaction.pis_rate}%):</span>
                  <span>
                    R$ {(Number(transaction.gross_amount) * (transaction.pis_rate / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Valor Líquido Estimado:</span>
                <span>R$ {netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isIssuing}>
              Cancelar
            </Button>
            <Button onClick={handleIssue} disabled={isIssuing || !selectedService}>
              {isIssuing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isIssuing ? "Emitindo..." : "Emitir NFS-e"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
