import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Settings } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Ruleset {
  id: string;
  rule_type: string;
  threshold_value: number;
  alert_severity: 'INFO' | 'WARNING' | 'CRITICAL';
  custom_message_template: string | null;
  active: boolean;
}

const RULE_TYPES = [
  { value: 'PROJECT_MARGIN_WARNING', label: 'Aviso de Margem de Projeto' },
  { value: 'PROJECT_MARGIN_CRITICAL', label: 'Margem de Projeto Crítica' },
  { value: 'HOURS_OVERRUN_WARNING', label: 'Aviso de Horas Excedidas' },
  { value: 'HOURS_OVERRUN_CRITICAL', label: 'Horas Excedidas Críticas' },
  { value: 'CASH_FLOW_CRITICAL', label: 'Fluxo de Caixa Crítico' },
  { value: 'AR_OVERDUE_WARNING', label: 'Aviso de Contas a Receber Atrasadas' },
  { value: 'UNCATEGORIZED_TRANSACTIONS', label: 'Transações Não Categorizadas' }
];

export function RulesetsConfigTab({ cfoPartnerId }: { cfoPartnerId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<Partial<Ruleset> | null>(null);

  const { data: rulesets, isLoading } = useQuery({
    queryKey: ['cfo-rulesets', cfoPartnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cfo_partner_rulesets')
        .select('*')
        .eq('cfo_partner_id', cfoPartnerId)
        .order('rule_type');

      if (error) throw error;
      return data as Ruleset[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (newRule: Partial<Ruleset>) => {
      const { error } = await supabase
        .from('cfo_partner_rulesets')
        .insert([{
          cfo_partner_id: cfoPartnerId,
          rule_type: newRule.rule_type!,
          threshold_value: newRule.threshold_value!,
          alert_severity: newRule.alert_severity!,
          custom_message_template: newRule.custom_message_template || null,
          active: newRule.active ?? true
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cfo-rulesets', cfoPartnerId] });
      setEditingRule(null);
      toast({
        title: "Sucesso",
        description: "Regra criada com sucesso"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (rule: Ruleset) => {
      const { error } = await supabase
        .from('cfo_partner_rulesets')
        .update({
          threshold_value: rule.threshold_value,
          alert_severity: rule.alert_severity,
          custom_message_template: rule.custom_message_template,
          active: rule.active
        })
        .eq('id', rule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cfo-rulesets', cfoPartnerId] });
      toast({
        title: "Sucesso",
        description: "Regra atualizada com sucesso"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('cfo_partner_rulesets')
        .delete()
        .eq('id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cfo-rulesets', cfoPartnerId] });
      toast({
        title: "Sucesso",
        description: "Regra removida com sucesso"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Partner Ruleset - O "Moat"
          </CardTitle>
          <CardDescription>
            Configure sua metodologia única. A IA executará suas regras personalizadas para cada cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => setEditingRule({ active: true })}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Nova Regra
          </Button>

          {editingRule && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="text-base">
                  {editingRule.id ? 'Editar Regra' : 'Nova Regra'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Regra</Label>
                  <Select
                    value={editingRule.rule_type}
                    onValueChange={(value) => setEditingRule({ ...editingRule, rule_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Threshold (Valor Limite)</Label>
                  <Input
                    type="number"
                    value={editingRule.threshold_value || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, threshold_value: parseFloat(e.target.value) })}
                    placeholder="Ex: -20 para margem crítica"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Severidade do Alerta</Label>
                  <Select
                    value={editingRule.alert_severity}
                    onValueChange={(value: any) => setEditingRule({ ...editingRule, alert_severity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INFO">Info</SelectItem>
                      <SelectItem value="WARNING">Warning</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Mensagem Personalizada (Opcional)</Label>
                  <Textarea
                    value={editingRule.custom_message_template || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, custom_message_template: e.target.value })}
                    placeholder="Use {project_name}, {hours_consumed_pct}, {invoiced_pct}, {margin_gap}"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      if (editingRule.id) {
                        updateMutation.mutate(editingRule as Ruleset);
                      } else {
                        createMutation.mutate(editingRule);
                      }
                    }}
                    disabled={!editingRule.rule_type || !editingRule.threshold_value || !editingRule.alert_severity}
                  >
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={() => setEditingRule(null)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {rulesets?.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">
                        {RULE_TYPES.find(t => t.value === rule.rule_type)?.label || rule.rule_type}
                      </h4>
                      <span className="text-xs px-2 py-1 rounded bg-muted">
                        {rule.alert_severity}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Threshold: {rule.threshold_value}
                    </p>
                    {rule.custom_message_template && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        "{rule.custom_message_template.substring(0, 80)}..."
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={rule.active}
                      onCheckedChange={(checked) => {
                        updateMutation.mutate({ ...rule, active: checked });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRule(rule)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(rule.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {(!rulesets || rulesets.length === 0) && !editingRule && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma regra configurada. Adicione sua primeira regra para personalizar a IA.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
