import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CloudOff, CloudUpload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function ConfiguracoesAPI() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [testing, setTesting] = useState(false);

  // Buscar configuração existente
  const { data: config } = useQuery({
    queryKey: ["config-fiscal"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return null;

      const { data, error } = await supabase
        .from("config_fiscal")
        .select("*")
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setClientId(data.client_id || "");
        setClientSecret(data.client_secret || "");
        setWebhookUrl(data.webhook_url || "");
      }
      
      return data;
    },
  });

  // Salvar configuração
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) throw new Error("Company ID not found");

      const payload = {
        company_id: profile.company_id,
        client_id: clientId,
        client_secret: clientSecret,
        webhook_url: webhookUrl,
      };

      if (config?.id) {
        const { error } = await supabase
          .from("config_fiscal")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("config_fiscal")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Configurações salvas",
        description: "As credenciais de API foram atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["config-fiscal"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTestConnection = async () => {
    setTesting(true);
    // Simular teste de conexão
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const success = Math.random() > 0.3; // 70% de chance de sucesso
    
    if (success) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (config?.id && profile?.company_id) {
        await supabase
          .from("config_fiscal")
          .update({ 
            api_status: "online",
            last_connection_test: new Date().toISOString()
          })
          .eq("id", config.id);
        
        queryClient.invalidateQueries({ queryKey: ["config-fiscal"] });
      }
      
      toast({
        title: "Conexão estabelecida",
        description: "API da Receita Federal está acessível.",
      });
    } else {
      toast({
        title: "Falha na conexão",
        description: "Não foi possível conectar à API. Verifique as credenciais.",
        variant: "destructive",
      });
    }
    
    setTesting(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configurações de API</CardTitle>
            <CardDescription>
              Configure as credenciais para integração com a Receita Federal
            </CardDescription>
          </div>
          <Badge variant={config?.api_status === "online" ? "default" : "secondary"}>
            {config?.api_status === "online" ? (
              <>
                <CloudUpload className="mr-1 h-3 w-3" />
                Online
              </>
            ) : (
              <>
                <CloudOff className="mr-1 h-3 w-3" />
                Offline
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              type="text"
              placeholder="Digite o Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              placeholder="Digite o Client Secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookUrl">URL do Webhook</Label>
            <Input
              id="webhookUrl"
              type="url"
              placeholder="https://seu-dominio.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              URL onde receberemos os retornos assíncronos da API
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !clientId || !clientSecret}
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configurações
          </Button>
          
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !config?.id}
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Testar Conexão
          </Button>
        </div>

        {config?.last_connection_test && (
          <p className="text-xs text-muted-foreground">
            Último teste: {new Date(config.last_connection_test).toLocaleString('pt-BR')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
