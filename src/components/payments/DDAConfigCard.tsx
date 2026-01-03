import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Building2, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Settings
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DDAConfigCardProps {
  bankAccounts: Array<{
    id: string;
    bank_name: string;
    account_number?: string;
    agency?: string;
    account_hash?: string;
    dda_activated?: boolean;
  }>;
  onBack: () => void;
  onRefresh: () => void;
}

export const DDAConfigCard = ({ bankAccounts, onBack, onRefresh }: DDAConfigCardProps) => {
  const queryClient = useQueryClient();
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const activateMutation = useMutation({
    mutationFn: async ({ accountHash, bankAccountId }: { accountHash: string; bankAccountId: string }) => {
      setActivatingId(bankAccountId);
      const { data, error } = await supabase.functions.invoke("payment-dda-activate", {
        body: { accountHash, bankAccountId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("DDA ativado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      onRefresh();
    },
    onError: (error: Error) => {
      toast.error(`Erro ao ativar DDA: ${error.message}`);
    },
    onSettled: () => {
      setActivatingId(null);
    },
  });

  const accountsWithHash = bankAccounts.filter(a => a.account_hash);
  const accountsWithoutHash = bankAccounts.filter(a => !a.account_hash);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuração DDA
            </CardTitle>
            <CardDescription>
              Ative o DDA nas contas bancárias cadastradas
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Box */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            O que é DDA?
          </h4>
          <p className="text-sm text-muted-foreground">
            O Débito Direto Autorizado (DDA) permite que você receba automaticamente todos os boletos 
            emitidos contra o CNPJ da sua empresa. Os boletos aparecem diretamente no sistema, 
            sem necessidade de digitar códigos de barras.
          </p>
        </div>

        {/* Accounts List */}
        <div className="space-y-4">
          <h4 className="font-medium">Contas Bancárias</h4>
          
          {accountsWithHash.length === 0 && accountsWithoutHash.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Nenhuma conta bancária cadastrada
            </div>
          )}

          {accountsWithHash.map((account) => (
            <div 
              key={account.id} 
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{account.bank_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Ag: {account.agency} | Conta: {account.account_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {account.dda_activated ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    DDA Ativo
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => activateMutation.mutate({ 
                      accountHash: account.account_hash!, 
                      bankAccountId: account.id 
                    })}
                    disabled={activatingId === account.id}
                  >
                    {activatingId === account.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Ativando...
                      </>
                    ) : (
                      "Ativar DDA"
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}

          {accountsWithoutHash.length > 0 && (
            <>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  As seguintes contas precisam ser configuradas na TecnoSpeed antes de ativar o DDA:
                </p>
                {accountsWithoutHash.map((account) => (
                  <div 
                    key={account.id} 
                    className="flex items-center justify-between p-4 border rounded-lg opacity-60"
                  >
                    <div className="flex items-center gap-4">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{account.bank_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Ag: {account.agency} | Conta: {account.account_number}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">Não configurada</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Requirements */}
        <div className="p-4 border rounded-lg space-y-3">
          <h4 className="font-medium">Requisitos para DDA</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              Conta bancária cadastrada e configurada na TecnoSpeed
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              Contrato de DDA ativo com o banco
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              Certificado digital A1 válido (para alguns bancos)
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
