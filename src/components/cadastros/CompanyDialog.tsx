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
import { Loader2 } from "lucide-react";

const companySchema = z.object({
  company_name: z.string().min(2, "Razão Social deve ter pelo menos 2 caracteres"),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().min(14, "CNPJ inválido"),
  municipal_inscription: z.string().optional(),
  state_inscription: z.string().optional(),
  address: z.string().optional(),
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

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      company_name: "",
      nome_fantasia: "",
      cnpj: "",
      municipal_inscription: "",
      state_inscription: "",
      address: "",
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
        city_code: "",
        tax_regime: "SIMPLES",
        status: "ACTIVE",
        notification_email: "",
      });
    }
  }, [company, form]);

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

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Endereço completo" />
                      </FormControl>
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
