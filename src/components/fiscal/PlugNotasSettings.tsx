import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Plug, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SANDBOX_TOKEN = "2da392a6-79d2-4304-a8b7-959572c7e44d";

export function PlugNotasSettings() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [environment, setEnvironment] = useState<"SANDBOX" | "PRODUCTION">("SANDBOX");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);

  // Fetch existing config
  const { data: config, isLoading } = useQuery({
    queryKey: ["plugnotas-config"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) return null;

      const { data } = await supabase
        .from("config_fiscal")
        .select("plugnotas_token, plugnotas_environment, plugnotas_status, plugnotas_last_test, company_id")
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (data) {
        setToken(data.plugnotas_token || "");
        setEnvironment((data.plugnotas_environment as "SANDBOX" | "PRODUCTION") || "SANDBOX");
      }

      return { ...data, company_id: profile.company_id };
    }
  });

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!config?.company_id) throw new Error("Company ID não encontrado");

      const { data: existing } = await supabase
        .from("config_fiscal")
        .select("id")
        .eq("company_id", config.company_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("config_fiscal")
          .update({
            plugnotas_token: token,
            plugnotas_environment: environment,
            updated_at: new Date().toISOString()
          })
          .eq("company_id", config.company_id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("config_fiscal")
          .insert({
            company_id: config.company_id,
            client_id: "plugnotas",
            client_secret: "configured",
            plugnotas_token: token,
            plugnotas_environment: environment
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["plugnotas-config"] });
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + (error as Error).message);
    }
  });

  // Test connection
  const handleTestConnection = async () => {
    if (!token) {
      toast.error("Informe o token antes de testar");
      return;
    }

    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke("test-plugnotas-connection", {
        body: {
          token,
          environment,
          company_id: config?.company_id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("🎉 Conexão Estabelecida: Hello World!", {
          description: `Ambiente: ${environment}`,
          duration: 5000
        });
        queryClient.invalidateQueries({ queryKey: ["plugnotas-config"] });
      } else {
        toast.error("Falha na conexão", {
          description: data?.error || "Erro desconhecido"
        });
      }
    } catch (error) {
      toast.error("Erro ao testar conexão", {
        description: (error as Error).message
      });
    } finally {
      setTesting(false);
    }
  };

  const handleUseSandboxToken = () => {
    setToken(SANDBOX_TOKEN);
    setEnvironment("SANDBOX");
    toast.info("Token de Sandbox inserido automaticamente");
  };

  const getStatusBadge = () => {
    const status = config?.plugnotas_status;
    
    if (status === "connected") {
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Online
        </Badge>
      );
    }
    
    if (status === "error") {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Erro
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary">
        <Plug className="h-3 w-3 mr-1" />
        Desconectado
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isSandbox = environment === "SANDBOX";

  return (
    <Card className={isSandbox ? "border-orange-500/50" : "border-green-500/50"}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Integração Fiscal - PlugNotas</CardTitle>
              <CardDescription>
                Configure a conexão com a API da TecnoSpeed PlugNotas
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
        
        {isSandbox && (
          <div className="mt-4">
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 px-3 py-1">
              <AlertTriangle className="h-3 w-3 mr-1" />
              MODO SANDBOX - Ambiente de Testes
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Environment Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Ambiente</Label>
          <RadioGroup
            value={environment}
            onValueChange={(value) => setEnvironment(value as "SANDBOX" | "PRODUCTION")}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="SANDBOX" id="sandbox" />
              <Label htmlFor="sandbox" className="cursor-pointer">
                SANDBOX (Testes)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="PRODUCTION" id="production" />
              <Label htmlFor="production" className="cursor-pointer text-green-600">
                PRODUCTION (Real)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {environment === "PRODUCTION" && (
          <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção: Ambiente de Produção</AlertTitle>
            <AlertDescription>
              Você está configurando o ambiente REAL. Notas fiscais emitidas serão válidas e terão efeito fiscal.
            </AlertDescription>
          </Alert>
        )}

        {/* Token Input */}
        <div className="space-y-2">
          <Label htmlFor="token" className="text-sm font-medium">
            Token de API (x-api-key)
          </Label>
          <div className="relative">
            <Input
              id="token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Insira seu token da PlugNotas"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          
          {isSandbox && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Token Sandbox padrão:</span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-primary"
                onClick={handleUseSandboxToken}
              >
                Usar token de teste
              </Button>
            </div>
          )}
        </div>

        {/* Last Test Info */}
        {config?.plugnotas_last_test && (
          <div className="text-sm text-muted-foreground">
            Último teste: {format(new Date(config.plugnotas_last_test), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !token}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Configurações
          </Button>
          
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !token}
          >
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Testar Conexão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
