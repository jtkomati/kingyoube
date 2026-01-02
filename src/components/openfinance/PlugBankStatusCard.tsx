import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CheckCircle2, Loader2, AlertCircle, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

interface CompanyAddress {
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
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressData, setAddressData] = useState<CompanyAddress>({
    neighborhood: "",
    number: "",
    zipCode: "",
    state: "",
    city: "",
  });

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
      if (!companyId) return;
      
      const { data } = await supabase
        .from("company_settings")
        .select("address, city, state, neighborhood, zip_code, address_number")
        .eq("id", companyId)
        .single();
      
      if (data) {
        setAddressData({
          neighborhood: data.neighborhood || "",
          number: data.address_number || "",
          zipCode: data.zip_code || "",
          state: data.state || "",
          city: data.city || "",
        });
      }
    };
    
    loadCompanyAddress();
  }, [companyId]);

  const isAddressComplete = 
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

    if (!isAddressComplete) {
      setShowAddressForm(true);
      toast.error("Preencha o endereço completo da empresa para registrar no Open Finance.");
      return;
    }

    setIsLoading(true);
    try {
      // Salvar endereço na company_settings antes de registrar
      await supabase
        .from("company_settings")
        .update({
          neighborhood: addressData.neighborhood,
          address_number: addressData.number,
          zip_code: addressData.zipCode,
          state: addressData.state,
          city: addressData.city,
        })
        .eq("id", companyId);

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
        setShowAddressForm(false);
      }
    } catch (error: any) {
      console.error("PlugBank registration error:", error);
      
      let errorMessage = "Erro desconhecido";
      
      // Tentar extrair mensagem de erro do contexto
      if (error.message) {
        errorMessage = error.message;
      }
      
      if (errorMessage.includes("404") || errorMessage.includes("não encontrada")) {
        toast.error("Erro de configuração: API TecnoSpeed não disponível. Verifique a URL da API e credenciais.");
      } else if (errorMessage.includes("401") || errorMessage.includes("Token inválido")) {
        toast.error("Credenciais inválidas. Verifique o token e CNPJ da Software House.");
      } else if (errorMessage.includes("Endereço")) {
        toast.error(errorMessage);
        setShowAddressForm(true);
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
              <Button onClick={handleRegister} disabled={isLoading} size="sm">
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

        {/* Formulário de endereço */}
        {(showAddressForm || (!isRegistered && !isAddressComplete)) && !isRegistered && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Endereço da Empresa (obrigatório para Open Finance)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="zipCode" className="text-xs">CEP</Label>
                <Input
                  id="zipCode"
                  placeholder="00000-000"
                  value={addressData.zipCode}
                  onChange={(e) => setAddressData({ ...addressData, zipCode: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs">Cidade</Label>
                <Input
                  id="city"
                  placeholder="São Paulo"
                  value={addressData.city}
                  onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state" className="text-xs">Estado</Label>
                <Select
                  value={addressData.state}
                  onValueChange={(value) => setAddressData({ ...addressData, state: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BRASIL.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="neighborhood" className="text-xs">Bairro</Label>
                <Input
                  id="neighborhood"
                  placeholder="Centro"
                  value={addressData.neighborhood}
                  onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="number" className="text-xs">Número</Label>
                <Input
                  id="number"
                  placeholder="123"
                  value={addressData.number}
                  onChange={(e) => setAddressData({ ...addressData, number: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
