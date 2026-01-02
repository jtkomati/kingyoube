import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, CheckCircle2, Loader2, AlertCircle, MapPin, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompanyAddress {
  address: string;
  neighborhood: string;
  number: string;
  zipCode: string;
  state: string;
  city: string;
}

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
  const [addressData, setAddressData] = useState<CompanyAddress | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
  };

  // Buscar dados de endereço da empresa
  useEffect(() => {
    const loadCompanyAddress = async () => {
      if (!companyId) {
        setIsLoadingAddress(false);
        return;
      }
      
      setIsLoadingAddress(true);
      const { data } = await supabase
        .from("company_settings")
        .select("address, city, state, neighborhood, zip_code, address_number")
        .eq("id", companyId)
        .single();
      
      if (data) {
        setAddressData({
          address: data.address || "",
          neighborhood: data.neighborhood || "",
          number: data.address_number || "",
          zipCode: data.zip_code || "",
          state: data.state || "",
          city: data.city || "",
        });
      }
      setIsLoadingAddress(false);
    };
    
    loadCompanyAddress();
  }, [companyId]);

  const isAddressComplete = addressData && 
    addressData.neighborhood && 
    addressData.number && 
    addressData.zipCode && 
    addressData.state && 
    addressData.city;

  const handleRegister = async () => {
    if (!companyId || !cnpj || !companyName) {
      toast.error("Dados da empresa incompletos. Complete o cadastro em Cadastros > Empresas.");
      return;
    }

    if (!isAddressComplete || !addressData) {
      toast.error("Endereço incompleto. Complete o cadastro da empresa antes de registrar.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("plugbank-create-payer", {
        body: {
          cpfCnpj: cnpj.replace(/\D/g, ""),
          name: companyName,
          companyId,
          address: {
            neighborhood: addressData.neighborhood,
            number: addressData.number,
            zipCode: addressData.zipCode,
            state: addressData.state,
            city: addressData.city,
          },
        },
      });

      if (error) throw error;

      if (data?.payerId) {
        toast.success("Empresa registrada no Open Finance com sucesso!");
        onRegistered?.(data.payerId);
      }
    } catch (error: any) {
      console.error("PlugBank registration error:", error);
      
      let errorMessage = "Erro desconhecido";
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (errorMessage.includes("404") || errorMessage.includes("não encontrada")) {
        toast.error("Erro de configuração: API TecnoSpeed não disponível. Verifique a URL da API e credenciais.");
      } else if (errorMessage.includes("401") || errorMessage.includes("Token inválido")) {
        toast.error("Credenciais inválidas. Verifique o token e CNPJ da Software House.");
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

  if (isLoadingAddress) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Carregando dados da empresa...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isRegistered ? "border-green-500/30 bg-green-500/5" : "border-border"}>
      <CardContent className="p-4 space-y-4">
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
                Conectado ao Open Finance
              </Badge>
            ) : (
              <Button 
                onClick={handleRegister} 
                disabled={isLoading || !isAddressComplete} 
                size="sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Registrando...
                  </>
                ) : (
                  "Registrar no Open Finance"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Alerta se endereço incompleto */}
        {!isRegistered && !isAddressComplete && (
          <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/30 text-amber-700">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Endereço incompleto. Complete o cadastro da empresa para registrar no Open Finance.</span>
              </div>
              <Link 
                to="/cadastros" 
                className="inline-flex items-center gap-1 text-sm font-medium underline hover:no-underline"
              >
                Ir para Cadastros
                <ExternalLink className="h-3 w-3" />
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Exibição do endereço (somente leitura) */}
        {isAddressComplete && addressData && (
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>
                {addressData.address && `${addressData.address}, `}
                {addressData.number} - {addressData.neighborhood}, {addressData.city}/{addressData.state} - CEP: {addressData.zipCode}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
