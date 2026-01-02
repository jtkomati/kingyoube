import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Shield, MapPin } from "lucide-react";
import { CertificateUpload } from "./CertificateUpload";

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const companySchema = z.object({
  company_name: z.string().min(2, "Razão Social deve ter pelo menos 2 caracteres"),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().min(14, "CNPJ inválido"),
  municipal_inscription: z.string().optional(),
  state_inscription: z.string().optional(),
  address: z.string().optional(),
  address_number: z.string().optional(),
  neighborhood: z.string().optional(),
  zip_code: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  city_code: z.string().optional(),
  tax_regime: z.string().optional(),
  status: z.string().optional(),
  notification_email: z.string().email("Email inválido").optional().or(z.literal("")),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface Company {
  id: string;
  company_name: string;
  nome_fantasia: string | null;
  cnpj: string;
  municipal_inscription: string | null;
  state_inscription: string | null;
  address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  city_code: string | null;
  tax_regime: string | null;
  status: string | null;
  notification_email: string | null;
  created_at: string;
}

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  onSuccess: () => void;
}

export function CompanyDialog({ open, onOpenChange, company, onSuccess }: CompanyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      company_name: "",
      nome_fantasia: "",
      cnpj: "",
      municipal_inscription: "",
      state_inscription: "",
      address: "",
      address_number: "",
      neighborhood: "",
      zip_code: "",
      city: "",
      state: "",
      city_code: "",
      tax_regime: "SIMPLES",
      status: "ACTIVE",
      notification_email: "",
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        company_name: company.company_name || "",
        nome_fantasia: company.nome_fantasia || "",
        cnpj: company.cnpj || "",
        municipal_inscription: company.municipal_inscription || "",
        state_inscription: company.state_inscription || "",
        address: company.address || "",
        address_number: company.address_number || "",
        neighborhood: company.neighborhood || "",
        zip_code: company.zip_code || "",
        city: company.city || "",
        state: company.state || "",
        city_code: company.city_code || "",
        tax_regime: company.tax_regime || "SIMPLES",
        status: company.status || "ACTIVE",
        notification_email: company.notification_email || "",
      });
    } else {
      form.reset({
        company_name: "",
        nome_fantasia: "",
        cnpj: "",
        municipal_inscription: "",
        state_inscription: "",
        address: "",
        address_number: "",
        neighborhood: "",
        zip_code: "",
        city: "",
        state: "",
        city_code: "",
        tax_regime: "SIMPLES",
        status: "ACTIVE",
        notification_email: "",
      });
    }
  }, [company, form]);

  const fetchAddressFromCEP = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    
    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        form.setValue("address", data.logradouro || "");
        form.setValue("neighborhood", data.bairro || "");
        form.setValue("city", data.localidade || "");
        form.setValue("state", data.uf || "");
        form.setValue("city_code", data.ibge || "");
        toast.success("Endereço preenchido automaticamente!");
      } else {
        toast.error("CEP não encontrado");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast.error("Erro ao buscar CEP");
    } finally {
      setLoadingCep(false);
    }
  };

  const onSubmit = async (data: CompanyFormData) => {
    setLoading(true);
    try {
      const payload = {
        company_name: data.company_name,
        nome_fantasia: data.nome_fantasia || null,
        cnpj: data.cnpj,
        municipal_inscription: data.municipal_inscription || null,
        state_inscription: data.state_inscription || null,
        address: data.address || null,
        address_number: data.address_number || null,
        neighborhood: data.neighborhood || null,
        zip_code: data.zip_code || null,
        city: data.city || null,
        state: data.state || null,
        city_code: data.city_code || null,
        tax_regime: data.tax_regime || "SIMPLES",
        status: data.status || "ACTIVE",
        notification_email: data.notification_email || null,
      };

      if (company) {
        const { error } = await supabase
          .from("company_settings")
          .update(payload)
          .eq("id", company.id);

        if (error) throw error;
        toast.success("Empresa atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("company_settings")
          .insert(payload);

        if (error) throw error;
        toast.success("Empresa criada com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving company:", error);
      toast.error(error.message || "Erro ao salvar empresa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {company ? "Editar Empresa" : "Nova Empresa"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados Básicos */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Dados Básicos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão Social *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Razão Social da empresa" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nome_fantasia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Fantasia</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome Fantasia" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="00.000.000/0000-00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Ativo</SelectItem>
                          <SelectItem value="INACTIVE">Inativo</SelectItem>
                          <SelectItem value="SUSPENDED">Suspenso</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notification_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email de Notificação</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="email@empresa.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">Endereço</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Necessário para integração com Open Finance</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            {...field} 
                            placeholder="00000-000"
                            onBlur={(e) => {
                              field.onBlur();
                              fetchAddressFromCEP(e.target.value);
                            }}
                          />
                          {loadingCep && (
                            <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Logradouro</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Rua, Avenida, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="123" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="neighborhood"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Centro" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="São Paulo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="UF" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ESTADOS_BRASIL.map((uf) => (
                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Dados Fiscais */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Dados Fiscais (NFS-e)</h3>
                <p className="text-xs text-muted-foreground mt-1">Obrigatórios para emissão de Nota Fiscal de Serviço</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tax_regime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regime Tributário</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o regime" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SIMPLES">Simples Nacional</SelectItem>
                          <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                          <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
                          <SelectItem value="MEI">MEI</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="municipal_inscription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição Municipal</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Número do cadastro na prefeitura" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código IBGE da Cidade</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: 3534401 (Osasco)" maxLength={7} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state_inscription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição Estadual</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Opcional" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Certificado Digital A1 */}
            {company && (
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">Certificado Digital A1</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Necessário para emissão de notas fiscais eletrônicas</p>
                </div>
                <CertificateUpload
                  companyId={company.id}
                  companyCnpj={company.cnpj}
                  onUploadSuccess={() => {
                    toast.success("Certificado cadastrado!");
                  }}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {company ? "Salvar" : "Criar Empresa"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
