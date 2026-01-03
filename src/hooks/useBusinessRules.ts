import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BusinessRule, BusinessRuleFormData } from '@/types/business-rules';
import { toast } from 'sonner';

export function useBusinessRules(context?: string) {
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ['business-rules', context],
    queryFn: async () => {
      let query = supabase
        .from('business_rules')
        .select('*')
        .order('context', { ascending: true })
        .order('rule_name', { ascending: true });

      if (context && context !== 'all') {
        query = query.eq('context', context);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as BusinessRule[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BusinessRuleFormData) => {
      const { data: result, error } = await supabase
        .from('business_rules')
        .insert({
          rule_name: data.rule_name,
          description: data.description,
          context: data.context,
          logic: data.logic,
          is_active: data.is_active,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
      toast.success('Regra criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar regra: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BusinessRuleFormData> }) => {
      const { data: result, error } = await supabase
        .from('business_rules')
        .update({
          rule_name: data.rule_name,
          description: data.description,
          context: data.context,
          logic: data.logic,
          is_active: data.is_active,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
      toast.success('Regra atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar regra: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('business_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
      toast.success('Regra excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir regra: ${error.message}`);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('business_rules')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });

  return {
    rules: rulesQuery.data ?? [],
    isLoading: rulesQuery.isLoading,
    error: rulesQuery.error,
    createRule: createMutation.mutateAsync,
    updateRule: updateMutation.mutateAsync,
    deleteRule: deleteMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
