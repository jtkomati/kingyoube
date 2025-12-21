import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { Calculator, Loader2 } from "lucide-react";

const formSchema = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  description: z.string().min(1, "Descrição obrigatória"),
  gross_amount: z.string().min(1, "Valor obrigatório"),
  due_date: z.string().min(1, "Data obrigatória"),
  category_id: z.string().min(1, "Categoria obrigatória"),
  customer_id: z.string().optional(),
  supplier_id: z.string().optional(),
  tax_regime: z.enum(["SIMPLES", "LUCRO_PRESUMIDO", "LUCRO_REAL"]).optional(),
});

interface TransactionDialogProps {
  open: boolean;
  onClose: () => void;
  transaction?: any;
}

export const TransactionDialog = ({ open, onClose, transaction }: TransactionDialogProps) => {
  const queryClient = useQueryClient();
  const [isCalculating, setIsCalculating] = useState(false);
  const [taxPreview, setTaxPreview] = useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "RECEIVABLE",
      description: "",
      gross_amount: "",
      due_date: "",
      category_id: "",
      customer_id: "",
      supplier_id: "",
      tax_regime: "SIMPLES",
    },
  });

  useEffect(() => {
    if (transaction) {
      form.reset({
        type: transaction.type,
        description: transaction.description,
        gross_amount: transaction.gross_amount.toString(),
        due_date: transaction.due_date,
        category_id: transaction.category_id,
        customer_id: transaction.customer_id || "",
        supplier_id: transaction.supplier_id || "",
        tax_regime: transaction.tax_regime || "SIMPLES",
      });
    }
  }, [transaction, form]);

  const calculateTaxes = async (values: any) => {
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("tax-impact-preview", {
        body: {
          amount: parseFloat(values.gross_amount),
          tax_regime: values.tax_regime || "SIMPLES",
        },
      });

      if (error) throw error;
      setTaxPreview(data);
      toast.success("Impostos calculados!");
    } catch (error: any) {
      toast.error("Erro ao calcular impostos: " + error.message);
    } finally {
      setIsCalculating(false);
    }
  };

  // Optimistic Update Mutation
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile, error: profileError } = await (supabase as any)
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.company_id) throw new Error("Usuário sem empresa associada");

      const netAmount = taxPreview?.net_amount || parseFloat(values.gross_amount);

      const transactionData = {
        type: values.type,
        description: values.description,
        gross_amount: parseFloat(values.gross_amount),
        net_amount: netAmount,
        due_date: values.due_date,
        category_id: values.category_id,
        customer_id: values.customer_id || null,
        supplier_id: values.supplier_id || null,
        tax_regime: values.tax_regime,
        discount_amount: 0,
        created_by: user.id,
        company_id: profile.company_id,
      };

      if (transaction) {
        const { data, error } = await (supabase as any)
          .from("transactions")
          .update(transactionData)
          .eq("id", transaction.id)
          .select()
          .single();

        if (error) throw error;
        return { ...transactionData, id: transaction.id, ...data };
      } else {
        const { data, error } = await (supabase as any)
          .from("transactions")
          .insert(transactionData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    // Optimistic Update
    onMutate: async (newData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["transactions"] });

      // Snapshot the previous value
      const previousTransactions = queryClient.getQueryData(["transactions"]);

      // Optimistically update to the new value
      const netAmount = taxPreview?.net_amount || parseFloat(newData.gross_amount);
      const optimisticTransaction = {
        id: transaction?.id || `temp-${Date.now()}`,
        type: newData.type,
        description: newData.description,
        gross_amount: parseFloat(newData.gross_amount),
        net_amount: netAmount,
        due_date: newData.due_date,
        category_id: newData.category_id,
        customer_id: newData.customer_id || null,
        supplier_id: newData.supplier_id || null,
        tax_regime: newData.tax_regime,
        invoice_status: "pending",
        category: { name: "..." }, // Placeholder
      };

      queryClient.setQueryData(["transactions"], (old: any[] | undefined) => {
        if (!old) return [optimisticTransaction];
        
        if (transaction) {
          // Update existing
          return old.map((t) =>
            t.id === transaction.id ? { ...t, ...optimisticTransaction } : t
          );
        } else {
          // Add new at the top
          return [optimisticTransaction, ...old];
        }
      });

      // Return context with the snapshotted value
      return { previousTransactions };
    },
    // If the mutation fails, rollback
    onError: (err: any, newData, context) => {
      queryClient.setQueryData(["transactions"], context?.previousTransactions);
      toast.error("Erro: " + err.message);
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onSuccess: () => {
      toast.success(transaction ? "Transação atualizada!" : "Transação criada!");
      onClose();
      form.reset();
      setTaxPreview(null);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Editar Transação" : "Nova Transação"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="RECEIVABLE">Receita</SelectItem>
                      <SelectItem value="PAYABLE">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gross_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Bruto</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Vencimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tax_regime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Regime Tributário</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SIMPLES">Simples Nacional</SelectItem>
                      <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                      <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => calculateTaxes(form.getValues())}
              disabled={isCalculating || !form.watch("gross_amount")}
            >
              <Calculator className="h-4 w-4 mr-2" />
              {isCalculating ? "Calculando..." : "Calcular Impostos"}
            </Button>

            {taxPreview && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-semibold">Preview de Impostos</h4>
                <Separator />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>ISS ({taxPreview.iss_rate}%):</span>
                    <span>{taxPreview.iss_amount.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>COFINS ({taxPreview.cofins_rate}%):</span>
                    <span>{taxPreview.cofins_amount.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PIS ({taxPreview.pis_rate}%):</span>
                    <span>{taxPreview.pis_amount.toFixed(0)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Valor Líquido:</span>
                    <span className="text-primary">{taxPreview.net_amount.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="default">Categoria Padrão</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {transaction ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
