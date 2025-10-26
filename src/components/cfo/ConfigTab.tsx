import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings, Save, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ConfigTab() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  // Fetch current config
  const { data: config, isLoading } = useQuery({
    queryKey: ["cfo-monitoring-config"],
    queryFn: async () => {
      // Get current CFO partner ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: partner } = await supabase
        .from("cfo_partners")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!partner) throw new Error("CFO partner not found");

      const { data, error } = await supabase
        .from("cfo_monitoring_config")
        .select("*")
        .eq("cfo_partner_id", partner.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      // Return default values if no config exists
      return data || {
        critical_cash_days_threshold: 7,
        warning_ar_overdue_percentage: 15.0,
        warning_uncategorized_threshold: 20,
        notification_enabled: true,
        notification_hour: 7
      };
    }
  });

  // Local state for editing
  const [formData, setFormData] = useState({
    critical_cash_days_threshold: 7,
    warning_ar_overdue_percentage: 15.0,
    warning_uncategorized_threshold: 20,
    notification_enabled: true,
    notification_hour: 7
  });

  // Update form when config loads
  useEffect(() => {
    if (config) setFormData(config);
  }, [config]);

  // Save config mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: partner } = await supabase
        .from("cfo_partners")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!partner) throw new Error("CFO partner not found");

      const { error } = await supabase
        .from("cfo_monitoring_config")
        .upsert({
          cfo_partner_id: partner.id,
          ...data
        }, {
          onConflict: "cfo_partner_id"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cfo-monitoring-config"] });
      toast.success("Configurações salvas com sucesso!");
      setIsEditing(false);
    },
    onError: (error: any) => {
      console.error("Error saving config:", error);
      toast.error("Erro ao salvar configurações: " + error.message);
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Configuração de Regras de Monitoramento</h2>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            Editar Regras
          </Button>
        )}
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Customize os parâmetros de monitoramento de acordo com sua metodologia. 
          Essas regras serão aplicadas a todos os seus clientes automaticamente.
        </AlertDescription>
      </Alert>

      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Alertas de Projeção de Caixa</h3>
          <div className="space-y-2">
            <Label htmlFor="critical_cash_days">
              Dias Críticos até Caixa Negativo
            </Label>
            <Input
              id="critical_cash_days"
              type="number"
              value={formData.critical_cash_days_threshold || 7}
              onChange={(e) => setFormData({
                ...formData,
                critical_cash_days_threshold: parseInt(e.target.value)
              })}
              disabled={!isEditing}
              min={1}
              max={30}
            />
            <p className="text-sm text-muted-foreground">
              Alerta crítico quando a projeção indica caixa negativo em X dias ou menos
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Alertas de Contas a Receber</h3>
          <div className="space-y-2">
            <Label htmlFor="ar_overdue_percent">
              Percentual de Aviso de AR Vencido (%)
            </Label>
            <Input
              id="ar_overdue_percent"
              type="number"
              step="0.1"
              value={formData.warning_ar_overdue_percentage || 15.0}
              onChange={(e) => setFormData({
                ...formData,
                warning_ar_overdue_percentage: parseFloat(e.target.value)
              })}
              disabled={!isEditing}
              min={0}
              max={100}
            />
            <p className="text-sm text-muted-foreground">
              Alerta de aviso quando AR vencido acima de 30 dias atinge este percentual do caixa
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Alertas de Transações</h3>
          <div className="space-y-2">
            <Label htmlFor="uncategorized_threshold">
              Limite de Transações Não Categorizadas
            </Label>
            <Input
              id="uncategorized_threshold"
              type="number"
              value={formData.warning_uncategorized_threshold || 20}
              onChange={(e) => setFormData({
                ...formData,
                warning_uncategorized_threshold: parseInt(e.target.value)
              })}
              disabled={!isEditing}
              min={1}
              max={1000}
            />
            <p className="text-sm text-muted-foreground">
              Alerta de aviso quando o número de transações não categorizadas excede este valor
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Configurações de Notificação</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications_enabled">
                Notificações Habilitadas
              </Label>
              <p className="text-sm text-muted-foreground">
                Ative/desative o monitoramento automático
              </p>
            </div>
            <Switch
              id="notifications_enabled"
              checked={formData.notification_enabled ?? true}
              onCheckedChange={(checked) => setFormData({
                ...formData,
                notification_enabled: checked
              })}
              disabled={!isEditing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notification_hour">
              Horário de Notificações (0-23h)
            </Label>
            <Input
              id="notification_hour"
              type="number"
              value={formData.notification_hour || 7}
              onChange={(e) => setFormData({
                ...formData,
                notification_hour: parseInt(e.target.value)
              })}
              disabled={!isEditing}
              min={0}
              max={23}
            />
            <p className="text-sm text-muted-foreground">
              Hora do dia para receber alertas agendados (formato 24h)
            </p>
          </div>
        </div>

        {isEditing && (
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setFormData(config);
                setIsEditing(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        )}
      </Card>

      {!isEditing && (
        <Card className="p-6 bg-muted">
          <h3 className="font-semibold mb-2">Configuração Atual</h3>
          <div className="space-y-1 text-sm">
            <p>• Alerta crítico de caixa: {config?.critical_cash_days_threshold || 7} dias</p>
            <p>• Aviso de AR vencido: {config?.warning_ar_overdue_percentage || 15}%</p>
            <p>• Limite de não categorizadas: {config?.warning_uncategorized_threshold || 20} transações</p>
            <p>• Notificações: {config?.notification_enabled ? "Ativadas" : "Desativadas"}</p>
            <p>• Horário de alertas: {config?.notification_hour || 7}:00h</p>
          </div>
        </Card>
      )}
    </div>
  );
}
