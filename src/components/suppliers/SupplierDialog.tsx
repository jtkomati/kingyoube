import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  person_type: z.enum(["PF", "PJ"]),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  cpf: z.string().optional(),
  company_name: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
});

interface SupplierDialogProps {
  open: boolean;
  onClose: () => void;
  supplier?: any;
}

export const SupplierDialog = ({ open, onClose, supplier }: SupplierDialogProps) => {
  const queryClient = useQueryClient();
  const { user, currentOrganization } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      person_type: "PJ",
      first_name: "",
      last_name: "",
      cpf: "",
      company_name: "",
      cnpj: "",
      email: "",
      phone: "",
      address: "",
    },
  });

  useEffect(() => {
    if (supplier) {
      form.reset(supplier);
    }
  }, [supplier, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (!user) throw new Error("Usuário não autenticado");
      if (!currentOrganization?.id) throw new Error("Selecione uma organização");

      const supplierData: any = {
        person_type: values.person_type,
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        cpf: values.cpf || null,
        company_name: values.company_name || null,
        cnpj: values.cnpj || null,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        created_by: user.id,
        company_id: currentOrganization.id,
      };

      if (supplier) {
        const { error } = await (supabase as any)
          .from("suppliers")
          .update(supplierData)
          .eq("id", supplier.id);

        if (error) throw error;
        toast.success("Fornecedor atualizado!");
      } else {
        const { error } = await (supabase as any)
          .from("suppliers")
          .insert([supplierData]);

        if (error) throw error;
        toast.success("Fornecedor criado!");
      }

      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      onClose();
      form.reset();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const personType = form.watch("person_type");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {supplier ? "Editar Fornecedor" : "Novo Fornecedor"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="person_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Pessoa</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PF">Pessoa Física</SelectItem>
                      <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {personType === "PF" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sobrenome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão Social</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!currentOrganization?.id}>
                {supplier ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
