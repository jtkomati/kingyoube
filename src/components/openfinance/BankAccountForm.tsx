import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Loader2, Clock, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlugBankStatusCard } from "./PlugBankStatusCard";

const BANKS = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú" },
  { code: "756", name: "Sicoob" },
  { code: "748", name: "Sicredi" },
  { code: "077", name: "Inter" },
  { code: "260", name: "Nubank" },
  { code: "336", name: "C6 Bank" },
];

interface CompanyData {
  id?: string;
  cnpj?: string;
  companyName?: string;
  payerStatus?: string;
  payerId?: string;
}

interface BankAccountFormProps {
  companyData?: CompanyData | null;
  onPayerRegistered?: (payerId: string) => void;
  onAccountConnected?: (accountId: string, consentLink?: string) => void;
}

export const BankAccountForm = ({
  companyData,
  onPayerRegistered,
  onAccountConnected,
}: BankAccountFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [consentLink, setConsentLink] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    bankCode: "",
    agency: "",
    accountNumber: "",
    accountType: "corrente",
  });

  const isRegistered = companyData?.payerStatus === "registered" && companyData?.payerId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyData?.payerId) {
      toast.error("Primeiro registre sua empresa no PlugBank");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("plugbank-create-account", {
        body: {
          payerId: companyData.payerId,
          bankCode: formData.bankCode,
          agency: formData.agency,
          accountNumber: formData.accountNumber,
          accountType: formData.accountType,
        },
      });

      if (error) throw error;

      if (data?.consentLink) {
        setConsentLink(data.consentLink);
        toast.success("Conta criada! Clique no link para autorizar o acesso.");
        onAccountConnected?.(data.accountId, data.consentLink);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar conta bancária");
    } finally {
      setIsLoading(false);
    }
  };

  if (consentLink) {
    return (
      <div className="space-y-4">
        <PlugBankStatusCard
          companyId={companyData?.id}
          companyName={companyData?.companyName}
          cnpj={companyData?.cnpj}
          payerStatus={companyData?.payerStatus}
          payerId={companyData?.payerId}
          onRegistered={onPayerRegistered}
        />
        
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Aguardando Autorização</h3>
                <p className="text-muted-foreground mt-1">
                  Clique no botão abaixo para autorizar o acesso à sua conta bancária via Open Finance
                </p>
              </div>
              <Button asChild className="gap-2">
                <a href={consentLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Autorizar Acesso no Banco
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PlugBankStatusCard
        companyId={companyData?.id}
        companyName={companyData?.companyName}
        cnpj={companyData?.cnpj}
        payerStatus={companyData?.payerStatus}
        payerId={companyData?.payerId}
        onRegistered={onPayerRegistered}
      />

      <Card className={!isRegistered ? "opacity-60 pointer-events-none" : ""}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Conectar Conta Bancária</CardTitle>
          </div>
          <CardDescription>
            {isRegistered 
              ? "Informe os dados da conta que deseja conectar via Open Finance"
              : "Primeiro registre sua empresa no PlugBank para conectar contas bancárias"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank">Banco</Label>
                <Select
                  value={formData.bankCode}
                  onValueChange={(value) => setFormData({ ...formData, bankCode: value })}
                  disabled={!isRegistered}
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

              <div className="space-y-2">
                <Label htmlFor="accountType">Tipo de Conta</Label>
                <Select
                  value={formData.accountType}
                  onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                  disabled={!isRegistered}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Conta Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agency">Agência</Label>
                <Input
                  id="agency"
                  placeholder="0000"
                  value={formData.agency}
                  onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                  disabled={!isRegistered}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Número da Conta</Label>
                <Input
                  id="accountNumber"
                  placeholder="00000-0"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  disabled={!isRegistered}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !formData.bankCode || !formData.agency || !formData.accountNumber || !isRegistered}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Conectando...
                </>
              ) : (
                "Conectar via Open Finance"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
