import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BANKS = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú" },
  { code: "356", name: "Banco Real" },
  { code: "389", name: "Mercantil do Brasil" },
  { code: "399", name: "HSBC" },
  { code: "422", name: "Safra" },
  { code: "453", name: "Rural" },
  { code: "633", name: "Rendimento" },
  { code: "652", name: "Itaú Unibanco" },
  { code: "745", name: "Citibank" },
  { code: "756", name: "Sicoob" },
];

interface BankAccountFormProps {
  payerId: string;
  onSuccess?: (accountId: string, consentLink: string) => void;
}

export function BankAccountForm({ payerId, onSuccess }: BankAccountFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [consentLink, setConsentLink] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    bankCode: "",
    agency: "",
    accountNumber: "",
    accountType: "checking",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!payerId) {
      toast.error("Erro", { description: "Cadastre sua empresa primeiro" });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("plugbank-create-account", {
        body: {
          payerId,
          bankCode: formData.bankCode,
          agency: formData.agency,
          accountNumber: formData.accountNumber,
          accountType: formData.accountType,
        },
      });

      if (error) throw new Error(error.message);

      if (!data.success) {
        throw new Error(data.error || "Erro ao cadastrar conta");
      }

      setConsentLink(data.consentLink);
      
      toast.success("Conta cadastrada!", {
        description: "Clique no botão abaixo para autorizar no seu banco.",
      });

      onSuccess?.(data.accountId, data.consentLink);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao cadastrar conta", {
        description: error instanceof Error ? error.message : "Tente novamente",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBank = BANKS.find((b) => b.code === formData.bankCode);

  if (consentLink) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Autorização Pendente</CardTitle>
              <CardDescription>
                {selectedBank?.name} • Ag: {formData.agency} • CC: {formData.accountNumber}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clique no botão abaixo para abrir o portal do seu banco e autorizar o acesso ao extrato via Open Finance.
          </p>
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => window.open(consentLink, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            CONECTAR CONTA BANCÁRIA
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
              Aguardando autorização
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!payerId) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Conectar Conta Bancária</CardTitle>
              <CardDescription>
                Primeiro cadastre sua empresa para poder conectar contas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Conectar Conta Bancária</CardTitle>
            <CardDescription>
              Adicione sua conta para sincronizar extratos via Open Finance
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bank">Banco *</Label>
            <Select
              value={formData.bankCode}
              onValueChange={(value) => setFormData({ ...formData, bankCode: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((bank) => (
                  <SelectItem key={bank.code} value={bank.code}>
                    {bank.code} - {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="agency">Agência *</Label>
              <Input
                id="agency"
                placeholder="0000"
                value={formData.agency}
                onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Conta *</Label>
              <Input
                id="accountNumber"
                placeholder="00000-0"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountType">Tipo</Label>
              <Select
                value={formData.accountType}
                onValueChange={(value) => setFormData({ ...formData, accountType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Conta Corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isLoading || !formData.bankCode || !formData.agency || !formData.accountNumber} 
            className="w-full mt-4 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                CONECTAR VIA OPEN FINANCE
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
