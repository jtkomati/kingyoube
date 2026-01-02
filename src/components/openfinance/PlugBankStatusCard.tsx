import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PlugBankStatusCardProps {
  companyId?: string;
  companyName?: string;
  cnpj?: string;
  payerStatus?: string;
  payerId?: string;
  onRegistered?: (payerId: string) => void;
}

export const PlugBankStatusCard = ({
  companyId,
  companyName,
  cnpj,
  payerStatus,
  payerId,
  onRegistered,
}: PlugBankStatusCardProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
  };

  const handleRegister = async () => {
    if (!companyId || !cnpj || !companyName) {
      toast.error("Dados da empresa incompletos. Complete o cadastro em Cadastros > Empresas.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("plugbank-create-payer", {
        body: {
          cpfCnpj: cnpj.replace(/\D/g, ""),
          name: companyName,
          companyId,
        },
      });

      if (error) throw error;

      if (data?.payerId) {
        toast.success("Empresa registrada no PlugBank com sucesso!");
        onRegistered?.(data.payerId);
      }
    } catch (error: any) {
      console.error("PlugBank registration error:", error);
      
      const errorMessage = error.message || "Erro desconhecido";
      if (errorMessage.includes("404") || errorMessage.includes("não encontrada")) {
        toast.error("Erro de configuração: API PlugBank não disponível. Verifique a URL da API e credenciais com a TecnoSpeed.");
      } else if (errorMessage.includes("401") || errorMessage.includes("Token inválido")) {
        toast.error("Credenciais inválidas. Verifique o token e CNPJ da Software House com a TecnoSpeed.");
      } else {
        toast.error(`Erro ao registrar: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isRegistered = payerStatus === "registered" && payerId;

  if (!companyId || !cnpj) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Empresa não cadastrada</p>
              <p className="text-sm text-muted-foreground">
                Cadastre sua empresa em Cadastros → Empresas antes de conectar contas bancárias.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isRegistered ? "border-green-500/30 bg-green-500/5" : "border-border"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{companyName}</p>
              <p className="text-sm text-muted-foreground">CNPJ: {formatCNPJ(cnpj)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isRegistered ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Conectado ao PlugBank
              </Badge>
            ) : (
              <Button onClick={handleRegister} disabled={isLoading} size="sm">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Registrando...
                  </>
                ) : (
                  "Registrar no PlugBank"
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
