import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { ServiceCodeSelect } from "./ServiceCodeSelect";
import { type ServiceCode } from "@/lib/service-codes-osasco";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NewInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
}

export const NewInvoiceDialog = ({ open, onClose }: NewInvoiceDialogProps) => {
  const [isIssuing, setIsIssuing] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [grossAmount, setGrossAmount] = useState<string>("");
  const [selectedService, setSelectedService] = useState<ServiceCode | null>(null);
  const [serviceDescription, setServiceDescription] = useState("");
  const queryClient = useQueryClient();
  const { currentOrganization, user } = useAuth();

  // Fetch customers
  const { data: customers } = useQuery({
    queryKey: ["customers", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", currentOrganization.id)
        .order("company_name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id && open,
  });

  const handleServiceSelect = (service: ServiceCode) => {
    setSelectedService(service);
    if (!serviceDescription) {
      setServiceDescription(service.description);
    }
  };

  const handleIssue = async () => {
    if (!customerId || !grossAmount || !selectedService) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const amount = parseFloat(grossAmount.replace(/\D/g, "")) / 100;
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    setIsIssuing(true);
    try {
      // 1. Create the transaction
      const issRate = selectedService.aliquota;
      const issAmount = amount * (issRate / 100);
      const netAmount = amount - issAmount;

      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert([{
          company_id: currentOrganization?.id,
          type: "RECEIVABLE" as const,
          description: serviceDescription || selectedService.description,
          gross_amount: amount,
          net_amount: netAmount,
          iss_rate: issRate,
          customer_id: customerId,
          due_date: new Date().toISOString().split("T")[0],
          created_by: user?.id || "",
          category_id: "9a9fcb53-4105-4ce8-a3fa-474858a0e877", // Default: Serviços
        }])
        .select()
        .single();

      if (txError) throw txError;

      // 2. Issue the invoice
      const { data, error } = await supabase.functions.invoke("issue-nfse", {
        body: {
          transaction_id: transaction.id,
          service_code: selectedService.code,
          service_description: serviceDescription || selectedService.description,
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
      
      // Reset form
      setCustomerId("");
      setGrossAmount("");
      setSelectedService(null);
      setServiceDescription("");
      onClose();
    } catch (error: any) {
      toast.error("Erro ao emitir nota fiscal: " + error.message);
    } finally {
      setIsIssuing(false);
    }
  };

  const amount = parseFloat(grossAmount.replace(/\D/g, "")) / 100 || 0;
  const issAmount = selectedService ? amount * (selectedService.aliquota / 100) : 0;
  const netAmount = amount - issAmount;

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const amount = parseInt(numbers || "0", 10) / 100;
    return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Emitir Nova NFS-e</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="default" className="bg-warning/10 border-warning/30">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              Modo Sandbox ativo - Notas fiscais serão emitidas em ambiente de teste
            </AlertDescription>
          </Alert>

          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="customer">Cliente *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente..." />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name || 
                      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
                      customer.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor do Serviço (R$) *</Label>
            <Input
              id="amount"
              value={grossAmount ? `R$ ${formatCurrency(grossAmount)}` : ""}
              onChange={(e) => setGrossAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="R$ 0,00"
            />
          </div>

          {/* Código de Serviço */}
          <div className="space-y-2">
            <Label>Código de Serviço (LC 116/2003) *</Label>
            <ServiceCodeSelect
              value={selectedService?.code}
              onSelect={handleServiceSelect}
            />
          </div>

          {/* Discriminação */}
          <div className="space-y-2">
            <Label htmlFor="description">Discriminação do Serviço</Label>
            <Textarea
              id="description"
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              placeholder="Descrição detalhada do serviço prestado"
              rows={3}
            />
          </div>

          {/* Preview de cálculo */}
          {selectedService && amount > 0 && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Resumo da Nota</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Valor do Serviço:</span>
                  <span>R$ {amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>ISS ({selectedService.aliquota}%):</span>
                  <span>- R$ {issAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Valor Líquido:</span>
                  <span>R$ {netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isIssuing}>
              Cancelar
            </Button>
            <Button 
              onClick={handleIssue} 
              disabled={isIssuing || !customerId || !grossAmount || !selectedService}
            >
              {isIssuing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isIssuing ? "Emitindo..." : "Emitir NFS-e"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
