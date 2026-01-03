import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentType: string | null;
  bankAccounts: BankAccount[];
  companyId?: string;
  onSuccess: () => void;
}

export const PaymentDialog = ({
  open,
  onOpenChange,
  paymentType,
  bankAccounts,
  companyId,
  onSuccess,
}: PaymentDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(paymentType || "billet");
  
  // Form states
  const [accountHash, setAccountHash] = useState("");
  const [barcode, setBarcode] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryCpfCnpj, setBeneficiaryCpfCnpj] = useState("");
  const [beneficiaryBankCode, setBeneficiaryBankCode] = useState("");
  const [beneficiaryAgency, setBeneficiaryAgency] = useState("");
  const [beneficiaryAccount, setBeneficiaryAccount] = useState("");
  const [transferType, setTransferType] = useState("TED");
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("03"); // CPF/CNPJ

  const resetForm = () => {
    setBarcode("");
    setAmount("");
    setDueDate("");
    setPaymentDate("");
    setBeneficiaryName("");
    setBeneficiaryCpfCnpj("");
    setBeneficiaryBankCode("");
    setBeneficiaryAgency("");
    setBeneficiaryAccount("");
    setPixKey("");
  };

  const handleSubmitBillet = async () => {
    if (!accountHash || !barcode || !amount) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-create-billet", {
        body: {
          companyId,
          accountHash,
          barcode,
          amount: parseFloat(amount),
          dueDate,
          paymentDate,
          beneficiaryName,
          beneficiaryCpfCnpj,
        },
      });

      if (error) throw error;
      
      toast.success("Pagamento de boleto criado com sucesso!");
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error creating billet payment:", error);
      toast.error("Erro ao criar pagamento de boleto");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitTransfer = async () => {
    if (!accountHash || !amount || !beneficiaryCpfCnpj) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-create-transfer", {
        body: {
          companyId,
          accountHash,
          transferType,
          amount: parseFloat(amount),
          dueDate,
          paymentDate,
          beneficiaryName,
          beneficiaryCpfCnpj,
          beneficiaryBankCode,
          beneficiaryAgency,
          beneficiaryAccount,
          pixKey: transferType.includes("PIX") ? pixKey : undefined,
          pixType: transferType.includes("PIX") ? pixType : undefined,
        },
      });

      if (error) throw error;
      
      toast.success("Transferência criada com sucesso!");
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error creating transfer:", error);
      toast.error("Erro ao criar transferência");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitPaycheck = async () => {
    if (!accountHash || !amount || !beneficiaryCpfCnpj) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-create-paycheck", {
        body: {
          companyId,
          accountHash,
          amount: parseFloat(amount),
          dueDate,
          paymentDate,
          beneficiaryName,
          beneficiaryCpfCnpj,
          beneficiaryBankCode,
          beneficiaryAgency,
          beneficiaryAccount,
        },
      });

      if (error) throw error;
      
      toast.success("Pagamento de salário criado com sucesso!");
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Error creating paycheck:", error);
      toast.error("Erro ao criar pagamento de salário");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pagamento</DialogTitle>
          <DialogDescription>
            Selecione o tipo de pagamento e preencha os dados
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

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="billet">Boleto</TabsTrigger>
              <TabsTrigger value="transfer">Transferência</TabsTrigger>
              <TabsTrigger value="pix">PIX</TabsTrigger>
              <TabsTrigger value="paycheck">Salário</TabsTrigger>
            </TabsList>

            <TabsContent value="billet" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Código de Barras *</Label>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Digite ou cole o código de barras"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Beneficiário</Label>
                  <Input
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ do Beneficiário</Label>
                  <Input
                    value={beneficiaryCpfCnpj}
                    onChange={(e) => setBeneficiaryCpfCnpj(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleSubmitBillet} disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Pagamento de Boleto
              </Button>
            </TabsContent>

            <TabsContent value="transfer" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Tipo de Transferência *</Label>
                <Select value={transferType} onValueChange={setTransferType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TED">TED</SelectItem>
                    <SelectItem value="DOC">DOC</SelectItem>
                    <SelectItem value="TED_OUTRA_TITULARIDADE">TED Outra Titularidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Beneficiário *</Label>
                  <Input
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ *</Label>
                  <Input
                    value={beneficiaryCpfCnpj}
                    onChange={(e) => setBeneficiaryCpfCnpj(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input
                    value={beneficiaryBankCode}
                    onChange={(e) => setBeneficiaryBankCode(e.target.value)}
                    placeholder="Ex: 341"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Agência</Label>
                  <Input
                    value={beneficiaryAgency}
                    onChange={(e) => setBeneficiaryAgency(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Input
                    value={beneficiaryAccount}
                    onChange={(e) => setBeneficiaryAccount(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleSubmitTransfer} disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Transferência
              </Button>
            </TabsContent>

            <TabsContent value="pix" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Tipo de Chave PIX *</Label>
                <Select value={pixType} onValueChange={setPixType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">Telefone</SelectItem>
                    <SelectItem value="02">Email</SelectItem>
                    <SelectItem value="03">CPF/CNPJ</SelectItem>
                    <SelectItem value="04">Chave Aleatória</SelectItem>
                    <SelectItem value="05">Dados Bancários</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave PIX *</Label>
                <Input
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Digite a chave PIX"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Beneficiário</Label>
                  <Input
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ</Label>
                  <Input
                    value={beneficiaryCpfCnpj}
                    onChange={(e) => setBeneficiaryCpfCnpj(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={() => {
                  setTransferType("PIX_TRANSFERENCIA");
                  handleSubmitTransfer();
                }} 
                disabled={isLoading} 
                className="w-full"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar PIX
              </Button>
            </TabsContent>

            <TabsContent value="paycheck" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Funcionário *</Label>
                  <Input
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input
                    value={beneficiaryCpfCnpj}
                    onChange={(e) => setBeneficiaryCpfCnpj(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input
                    value={beneficiaryBankCode}
                    onChange={(e) => setBeneficiaryBankCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Agência</Label>
                  <Input
                    value={beneficiaryAgency}
                    onChange={(e) => setBeneficiaryAgency(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Input
                    value={beneficiaryAccount}
                    onChange={(e) => setBeneficiaryAccount(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleSubmitPaycheck} disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Pagamento de Salário
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
