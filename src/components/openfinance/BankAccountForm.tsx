import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, Clock, CreditCard, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
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

interface BankAccount {
  id: string;
  bank_name: string;
  bank_code: string;
  agency: string;
  account_number: string;
  account_type: string;
  open_finance_status: string;
  consent_link: string | null;
  plugbank_account_id: string | null;
}

interface BankAccountFormProps {
  companyData?: CompanyData | null;
  onPayerRegistered?: (payerId: string) => void;
  onAccountConnected?: (accountId: string, consentLink?: string) => void;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "connected":
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 gap-1"><CheckCircle2 className="h-3 w-3" />Conectado</Badge>;
    case "awaiting_consent":
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1"><Clock className="h-3 w-3" />Aguardando</Badge>;
    case "revoked":
      return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 gap-1"><AlertCircle className="h-3 w-3" />Revogado</Badge>;
    default:
      return <Badge variant="outline" className="bg-muted text-muted-foreground gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
  }
};

export const BankAccountForm = ({
  companyData,
  onPayerRegistered,
  onAccountConnected,
}: BankAccountFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [existingAccounts, setExistingAccounts] = useState<BankAccount[]>([]);
  const [formData, setFormData] = useState({
    bankCode: "",
    agency: "",
    agencyDigit: "",
    accountNumber: "",
    accountDigit: "",
    accountType: "corrente",
  });

  const isRegistered = companyData?.payerStatus === "registered" && companyData?.payerId;

  // Load existing accounts
  useEffect(() => {
    if (companyData?.id) {
      loadExistingAccounts();
    }
  }, [companyData?.id]);

  const loadExistingAccounts = async () => {
    if (!companyData?.id) return;
    
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("company_id", companyData.id)
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setExistingAccounts(data as BankAccount[]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyData?.payerId || !companyData?.id) {
      toast.error("Primeiro registre sua empresa no PlugBank");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Check for duplicate account
      const { data: existingAccount } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("company_id", companyData.id)
        .eq("bank_code", formData.bankCode)
        .eq("agency", formData.agency.replace(/\D/g, ""))
        .eq("account_number", formData.accountNumber.replace(/\D/g, ""))
        .maybeSingle();

      if (existingAccount) {
        toast.error("Esta conta bancária já está cadastrada");
        setIsLoading(false);
        return;
      }

      // 2. Create record in bank_accounts BEFORE calling PlugBank API
      const bankName = BANKS.find(b => b.code === formData.bankCode)?.name || "Banco";
      const { data: bankAccount, error: insertError } = await supabase
        .from("bank_accounts")
        .insert({
          company_id: companyData.id,
          bank_name: bankName,
          bank_code: formData.bankCode,
          agency: formData.agency.replace(/\D/g, ""),
          account_number: formData.accountNumber.replace(/\D/g, ""),
          account_type: formData.accountType === "corrente" ? "checking" : "savings",
          open_finance_status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating bank account:", insertError);
        throw new Error("Erro ao salvar conta bancária");
      }

      // 3. Call PlugBank API with bankAccountId
      const { data, error } = await supabase.functions.invoke("plugbank-create-account", {
        body: {
          payerId: companyData.payerId,
          bankCode: formData.bankCode,
          agency: formData.agency,
          agencyDigit: formData.agencyDigit,
          accountNumber: formData.accountNumber,
          accountDigit: formData.accountDigit,
          accountType: formData.accountType === "corrente" ? "checking" : "savings",
          bankAccountId: bankAccount.id,
        },
      });

      if (error) {
        // Rollback: delete the created record
        await supabase.from("bank_accounts").delete().eq("id", bankAccount.id);
        throw error;
      }

      toast.success("Conta criada! Clique no link para autorizar o acesso.");
      onAccountConnected?.(data.accountId, data.consentLink);
      
      // Reload accounts list
      await loadExistingAccounts();
      
      // Reset form
      setFormData({
        bankCode: "",
        agency: "",
        agencyDigit: "",
        accountNumber: "",
        accountDigit: "",
        accountType: "corrente",
      });
    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar conta bancária");
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* Existing Accounts List */}
      {existingAccounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Contas Cadastradas</CardTitle>
              <Button variant="ghost" size="sm" onClick={loadExistingAccounts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {existingAccounts.map((account) => (
              <div 
                key={account.id} 
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{account.bank_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Ag: {account.agency} | Conta: {account.account_number}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(account.open_finance_status)}
                  {account.open_finance_status === "awaiting_consent" && account.consent_link && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={account.consent_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Autorizar
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* New Account Form */}
      <Card className={!isRegistered ? "opacity-60 pointer-events-none" : ""}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Conectar Nova Conta Bancária</CardTitle>
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
                <div className="flex gap-2">
                  <Input
                    id="agency"
                    placeholder="0000"
                    value={formData.agency}
                    onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                    disabled={!isRegistered}
                    className="flex-1"
                  />
                  <Input
                    id="agencyDigit"
                    placeholder="Dígito"
                    value={formData.agencyDigit}
                    onChange={(e) => setFormData({ ...formData, agencyDigit: e.target.value })}
                    disabled={!isRegistered}
                    className="w-16"
                    maxLength={1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Número da Conta</Label>
                <div className="flex gap-2">
                  <Input
                    id="accountNumber"
                    placeholder="00000"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    disabled={!isRegistered}
                    className="flex-1"
                  />
                  <Input
                    id="accountDigit"
                    placeholder="Dígito"
                    value={formData.accountDigit}
                    onChange={(e) => setFormData({ ...formData, accountDigit: e.target.value })}
                    disabled={!isRegistered}
                    className="w-16"
                    maxLength={2}
                  />
                </div>
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
