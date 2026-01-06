import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2, Eye, EyeOff, Building2, Save, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PrefeituraCredentials() {
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchCredentials();
    }
  }, [currentOrganization?.id]);

  const fetchCredentials = async () => {
    if (!currentOrganization?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("config_fiscal")
        .select("prefeitura_login, prefeitura_inscricao_municipal")
        .eq("company_id", currentOrganization.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLogin(data.prefeitura_login || "");
        setInscricaoMunicipal(data.prefeitura_inscricao_municipal || "");
        
        // Check if password exists in vault
        const { data: secretData } = await supabase.rpc("get_secret", {
          p_entity_type: "prefeitura",
          p_entity_id: currentOrganization.id,
          p_secret_type: "password"
        });
        
        if (secretData) {
          setPassword("••••••••");
          setHasExistingCredentials(true);
        }
      }
    } catch (error) {
      console.error("Error fetching credentials:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentOrganization?.id) {
      toast({
        title: "Erro",
        description: "Nenhuma empresa selecionada",
        variant: "destructive"
      });
      return;
    }

    if (!login || !inscricaoMunicipal) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o login e a inscrição municipal",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // Check if config exists
      const { data: existingConfig } = await supabase
        .from("config_fiscal")
        .select("id")
        .eq("company_id", currentOrganization.id)
        .maybeSingle();

      if (existingConfig) {
        // Update existing
        const { error: updateError } = await supabase
          .from("config_fiscal")
          .update({
            prefeitura_login: login,
            prefeitura_inscricao_municipal: inscricaoMunicipal
          })
          .eq("company_id", currentOrganization.id);
        
        if (updateError) throw updateError;
      } else {
        // Insert new - need to check required fields from types
        const { error: insertError } = await supabase
          .from("config_fiscal")
          .insert({
            company_id: currentOrganization.id,
            prefeitura_login: login,
            prefeitura_inscricao_municipal: inscricaoMunicipal,
            client_id: "",
            client_secret: ""
          });
        
        if (insertError) throw insertError;
      }

      // Store password securely in vault if provided (not placeholder)
      if (password && password !== "••••••••") {
        const { error: secretError } = await supabase.rpc("store_secret", {
          p_entity_type: "prefeitura",
          p_entity_id: currentOrganization.id,
          p_secret_type: "password",
          p_secret_value: password
        });

        if (secretError) throw secretError;
      }

      setHasExistingCredentials(true);
      toast({
        title: "Credenciais salvas",
        description: "As credenciais da Prefeitura foram salvas com segurança"
      });
    } catch (error: any) {
      console.error("Error saving credentials:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as credenciais",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Credenciais da Prefeitura
        </CardTitle>
        <CardDescription>
          Configure as credenciais de acesso ao sistema da Prefeitura de Osasco para consulta e emissão de notas fiscais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            Suas credenciais são armazenadas de forma segura e criptografada. A senha é protegida no Vault.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prefeitura-login">Login da Prefeitura</Label>
            <Input
              id="prefeitura-login"
              placeholder="Digite o login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prefeitura-inscricao">Inscrição Municipal</Label>
            <Input
              id="prefeitura-inscricao"
              placeholder="Ex: 123456"
              value={inscricaoMunicipal}
              onChange={(e) => setInscricaoMunicipal(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prefeitura-password">Senha da Prefeitura</Label>
          <div className="relative">
            <Input
              id="prefeitura-password"
              type={showPassword ? "text" : "password"}
              placeholder={hasExistingCredentials ? "Deixe em branco para manter a senha atual" : "Digite a senha"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => {
                if (password === "••••••••") {
                  setPassword("");
                }
              }}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {hasExistingCredentials && (
            <p className="text-xs text-muted-foreground">
              Uma senha já está configurada. Preencha apenas se desejar alterá-la.
            </p>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Credenciais
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
