import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Upload, Loader2 } from "lucide-react";

const formSchema = z.object({
  entity_id: z.string().min(1, "Selecione um cliente ou fornecedor"),
  contract_number: z.string().min(1, "Número obrigatório"),
  title: z.string().min(1, "Título obrigatório"),
  description: z.string().optional(),
  start_date: z.string().min(1, "Data obrigatória"),
  end_date: z.string().optional(),
  value: z.string().optional(),
  status: z.enum(["draft", "active", "suspended", "cancelled", "expired"]),
});

interface ContractDialogProps {
  open: boolean;
  onClose: () => void;
  entityType: "customer" | "supplier";
  entityId?: string;
}

export const ContractDialog = ({ open, onClose, entityType, entityId }: ContractDialogProps) => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const { data: entities } = useQuery({
    queryKey: [entityType === "customer" ? "customers" : "suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(entityType === "customer" ? "customers" : "suppliers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entity_id: entityId || "",
      contract_number: "",
      title: "",
      description: "",
      start_date: "",
      end_date: "",
      value: "",
      status: "draft",
    },
  });

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const filePath = `${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("contracts")
        .getPublicUrl(filePath);

      setUploadedFile(file);
      toast.success("Arquivo enviado com sucesso!");
      return { url: publicUrl, name: file.name, size: file.size };
    } catch (error: any) {
      toast.error("Erro ao enviar arquivo: " + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar company_id do usuário
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.company_id) throw new Error("Usuário sem empresa associada");

      let fileData = null;
      if (uploadedFile) {
        fileData = await handleFileUpload(uploadedFile);
      }

      const contractData: any = {
        entity_type: entityType,
        [entityType === "customer" ? "customer_id" : "supplier_id"]: values.entity_id,
        contract_number: values.contract_number,
        title: values.title,
        description: values.description || null,
        start_date: values.start_date,
        end_date: values.end_date || null,
        value: values.value ? parseFloat(values.value) : null,
        status: values.status,
        created_by: user.id,
        company_id: profile.company_id,
        ...(fileData && {
          file_url: fileData.url,
          file_name: fileData.name,
          file_size: fileData.size,
        }),
      };

      const { data: newContract, error } = await supabase
        .from("contracts")
        .insert([contractData])
        .select()
        .single();

      if (error) throw error;

      toast.success("Contrato criado!");

      // Se for fornecedor, perguntar se quer analisar com IA
      if (entityType === "supplier" && uploadedFile && newContract) {
        const shouldAnalyze = confirm("Deseja analisar o contrato com IA agora?");
        if (shouldAnalyze) {
          await analyzeContract(newContract.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      onClose();
      form.reset();
      setUploadedFile(null);
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const analyzeContract = async (contractId: string) => {
    setAnalyzing(true);
    try {
      // Ler o arquivo PDF (simplificado - em produção usar parser de PDF)
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;

        const { error } = await supabase.functions.invoke("analyze-contract", {
          body: {
            contract_id: contractId,
            contract_text: text.substring(0, 50000), // Limitar tamanho
          },
        });

        if (error) throw error;

        toast.success("Análise de contrato concluída!");
        queryClient.invalidateQueries({ queryKey: ["contracts"] });
      };

      if (uploadedFile) {
        reader.readAsText(uploadedFile);
      }
    } catch (error: any) {
      toast.error("Erro ao analisar: " + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Contrato</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="entity_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{entityType === "customer" ? "Cliente" : "Fornecedor"}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!entityId}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {entities?.map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.company_name || `${entity.first_name} ${entity.last_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contract_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do Contrato</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="CTR-2024-001" />
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
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="suspended">Suspenso</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Início</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Fim</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-2 border-dashed rounded-lg p-4">
              <label className="flex flex-col items-center cursor-pointer">
                <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                <span className="text-sm text-muted-foreground mb-2">
                  {uploadedFile ? uploadedFile.name : "Clique para enviar o contrato (PDF)"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setUploadedFile(file);
                  }}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading || analyzing}>
                {(uploading || analyzing) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {uploading ? "Enviando..." : analyzing ? "Analisando..." : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
