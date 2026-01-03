import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface BankAccount {
  id: string;
  bank_name: string;
  account_hash: string | null;
  agency: string | null;
  account_number: string | null;
}

interface TaxPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxType: string | null;
  bankAccounts: BankAccount[];
  companyId?: string;
  onSuccess: () => void;
}

export const TaxPaymentDialog = ({
  open,
  onOpenChange,
  taxType,
  bankAccounts,
  companyId,
  onSuccess,
}: TaxPaymentDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [accountHash, setAccountHash] = useState("");
  
  // Common fields
  const [revenueCode, setRevenueCode] = useState("");
  const [contributorDocument, setContributorDocument] = useState("");
  const [contributorName, setContributorName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [referencePeriod, setReferencePeriod] = useState("");
  
  // DARF specific
  const [reportingPeriod, setReportingPeriod] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [interestAmount, setInterestAmount] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  
  // GARE specific
  const [stateRegistration, setStateRegistration] = useState("");
  
  // IPVA/DPVAT specific
  const [vehiclePlates, setVehiclePlates] = useState("");
  const [vehicleRenavam, setVehicleRenavam] = useState("");
  const [calculationYear, setCalculationYear] = useState("");
  const [state, setState] = useState("");
  
  // FGTS specific
  const [barcode, setBarcode] = useState("");

  const resetForm = () => {
    setRevenueCode("");
    setContributorDocument("");
    setContributorName("");
    setAmount("");
    setDueDate("");
    setPaymentDate("");
    setReferencePeriod("");
    setReportingPeriod("");
    setReferenceNumber("");
    setInterestAmount("");
    setFineAmount("");
    setStateRegistration("");
    setVehiclePlates("");
    setVehicleRenavam("");
    setCalculationYear("");
    setState("");
    setBarcode("");
  };

  const handleSubmit = async () => {
    if (!accountHash || !contributorDocument || !amount) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);
    
    try {
      let functionName = "";
      let payload: Record<string, unknown> = {
        companyId,
        accountHash,
        contributorDocument,
        contributorName,
        amount: parseFloat(amount),
        dueDate,
        paymentDate,
        revenueCode,
      };

      switch (taxType) {
        case "DARF":
          functionName = "payment-create-darf";
          payload = {
            ...payload,
            nominalAmount: parseFloat(amount),
            reportingPeriod,
            referencePeriod,
            referenceNumber,
            interestAmount: interestAmount ? parseFloat(interestAmount) : undefined,
            fineAmount: fineAmount ? parseFloat(fineAmount) : undefined,
          };
          break;
        case "GPS":
          functionName = "payment-create-gps";
          payload = {
            ...payload,
            referencePeriod,
          };
          break;
        case "GARE":
          functionName = "payment-create-gare";
          payload = {
            ...payload,
            stateRegistration,
            referencePeriod,
            interestAmount: interestAmount ? parseFloat(interestAmount) : undefined,
            fineAmount: fineAmount ? parseFloat(fineAmount) : undefined,
          };
          break;
        case "FGTS":
          functionName = "payment-create-fgts";
          payload = {
            ...payload,
            barcode,
          };
          break;
        case "IPVA":
          functionName = "payment-create-ipva";
          payload = {
            ...payload,
            vehiclePlates,
            vehicleRenavam,
            calculationYear,
            state,
          };
          break;
        case "DPVAT":
          functionName = "payment-create-dpvat";
          payload = {
            ...payload,
            vehiclePlates,
            vehicleRenavam,
            calculationYear,
            state,
          };
          break;
        default:
          toast.error("Tipo de tributo não suportado");
          return;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
      });

      if (error) throw error;
      
      toast.success(`Pagamento de ${taxType} criado com sucesso!`);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error creating tax payment:", error);
      toast.error(`Erro ao criar pagamento de ${taxType}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getTaxTitle = () => {
    switch (taxType) {
      case "DARF": return "DARF - Documento de Arrecadação de Receitas Federais";
      case "GPS": return "GPS - Guia da Previdência Social";
      case "GARE": return "GARE - Guia de Arrecadação da Receita Estadual";
      case "FGTS": return "FGTS - Fundo de Garantia";
      case "IPVA": return "IPVA - Imposto sobre Veículos";
      case "DPVAT": return "DPVAT - Seguro Obrigatório";
      default: return "Novo Tributo";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTaxTitle()}</DialogTitle>
          <DialogDescription>
            Preencha os dados para criar o pagamento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label>Conta de Origem *</Label>
            <Select value={accountHash} onValueChange={setAccountHash}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
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

          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código da Receita *</Label>
              <Input
                value={revenueCode}
                onChange={(e) => setRevenueCode(e.target.value)}
                placeholder="Ex: 0561"
              />
            </div>
            <div className="space-y-2">
              <Label>CPF/CNPJ Contribuinte *</Label>
              <Input
                value={contributorDocument}
                onChange={(e) => setContributorDocument(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome do Contribuinte</Label>
            <Input
              value={contributorName}
              onChange={(e) => setContributorName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Pagamento</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          {/* DARF Specific Fields */}
          {taxType === "DARF" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Período de Apuração</Label>
                  <Input
                    value={reportingPeriod}
                    onChange={(e) => setReportingPeriod(e.target.value)}
                    placeholder="MMAAAA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Período de Referência</Label>
                  <Input
                    value={referencePeriod}
                    onChange={(e) => setReferencePeriod(e.target.value)}
                    placeholder="MMAAAA"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Número de Referência</Label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Juros</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Multa</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={fineAmount}
                    onChange={(e) => setFineAmount(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* GPS Specific Fields */}
          {taxType === "GPS" && (
            <div className="space-y-2">
              <Label>Período de Referência (Competência)</Label>
              <Input
                value={referencePeriod}
                onChange={(e) => setReferencePeriod(e.target.value)}
                placeholder="MMAAAA"
              />
            </div>
          )}

          {/* GARE Specific Fields */}
          {taxType === "GARE" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={stateRegistration}
                    onChange={(e) => setStateRegistration(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Período de Referência</Label>
                  <Input
                    value={referencePeriod}
                    onChange={(e) => setReferencePeriod(e.target.value)}
                    placeholder="MMAAAA"
                  />
                </div>
              </div>
            </>
          )}

          {/* FGTS Specific Fields */}
          {taxType === "FGTS" && (
            <div className="space-y-2">
              <Label>Código de Barras *</Label>
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Digite o código de barras da guia FGTS"
              />
            </div>
          )}

          {/* IPVA/DPVAT Specific Fields */}
          {(taxType === "IPVA" || taxType === "DPVAT") && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Placa do Veículo *</Label>
                  <Input
                    value={vehiclePlates}
                    onChange={(e) => setVehiclePlates(e.target.value)}
                    placeholder="ABC1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label>RENAVAM *</Label>
                  <Input
                    value={vehicleRenavam}
                    onChange={(e) => setVehicleRenavam(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ano de Exercício</Label>
                  <Input
                    value={calculationYear}
                    onChange={(e) => setCalculationYear(e.target.value)}
                    placeholder="2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="SP"
                  />
                </div>
              </div>
            </>
          )}

          <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Pagamento de {taxType}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
