import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown,
  Wifi,
  Key,
  Server,
  Clock,
  Building2,
  ExternalLink,
  Info,
  ShieldCheck
} from "lucide-react";

interface TestResult {
  method: string;
  endpoint: string;
  status: number;
  success: boolean;
  response?: unknown;
  error?: string;
  latencyMs: number;
  errorType?: 'auth' | 'validation' | 'network' | 'server' | 'not_found';
  headerVariant?: string;
  message?: string;
  hint?: string;
}

interface DiagnosticsResult {
  success: boolean;
  credentialsOk?: boolean;
  payerCnpjUsed?: string | null;
  environment?: string;
  workingHeaderVariant?: string;
  testedVariants?: string[];
  summary?: {
    totalTests: number;
    successful: number;
    authErrors: number;
    validationErrors: number;
    notFoundErrors: number;
    networkErrors: number;
    serverErrors: number;
    totalTimeMs: number;
  };
  workingMethod?: {
    method: string;
    endpoint: string;
    latencyMs: number;
  } | null;
  recommendations?: string[];
  results?: TestResult[];
  credentials?: {
    tokenConfigured: boolean;
    tokenLength: number;
    cnpjShConfigured: boolean;
    cnpjShPreview: string | null;
  };
  error?: string;
}

export function TecnoSpeedDiagnostics() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticsResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [payerCpfCnpj, setPayerCpfCnpj] = useState("");
  const [useProduction, setUseProduction] = useState(false);

  const runDiagnostics = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      const envLabel = useProduction ? 'produção' : 'staging';
      toast.info(`Executando diagnóstico no ambiente ${envLabel}...`);
      
      const body: Record<string, string> = {};
      if (payerCpfCnpj.trim()) body.payerCpfCnpj = payerCpfCnpj.trim();
      if (useProduction) body.environment = 'production';
      
      const { data, error } = await supabase.functions.invoke('test-tecnospeed-connection', {
        body: Object.keys(body).length > 0 ? body : undefined
      });
      
      if (error) throw error;
      
      setResult(data as DiagnosticsResult);
      
      if (data?.success) {
        toast.success("Conexão com TecnoSpeed funcionando!");
      } else if (data?.credentialsOk) {
        toast.info("Credenciais OK - verifique os dados");
      } else {
        toast.warning("Diagnóstico concluído - verifique os resultados");
      }
    } catch (error) {
      console.error('Diagnostics failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      toast.error("Falha ao executar diagnóstico");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-destructive" />
    );
  };

  const getStatusBadge = (status: number, errorType?: string) => {
    if (status === 0) return <Badge variant="outline">Rede</Badge>;
    if (status >= 200 && status < 300) return <Badge className="bg-green-500">OK</Badge>;
    if (status === 401 || status === 403) return <Badge variant="destructive">Auth</Badge>;
    if (status === 422) {
      if (errorType === 'auth') return <Badge variant="destructive">Rejeitado</Badge>;
      return <Badge variant="outline" className="border-amber-500 text-amber-600">422</Badge>;
    }
    if (status === 404) return <Badge variant="secondary">404</Badge>;
    if (status >= 500) return <Badge variant="destructive">5xx</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const getOverallStatus = () => {
    if (!result) return null;
    
    if (result.success) {
      return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', title: 'Conexão Funcionando', variant: 'default' as const };
    }
    if (result.credentialsOk) {
      return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', title: 'Credenciais OK - Dados Pendentes', variant: 'default' as const };
    }
    
    // Check if most errors are auth-related (including 422 treated as auth)
    const authCount = result.summary?.authErrors || 0;
    const total = result.summary?.totalTests || 1;
    if (authCount >= total / 2) {
      return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', title: 'Credenciais Rejeitadas', variant: 'destructive' as const };
    }
    
    return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', title: 'Autenticação Falhou', variant: 'destructive' as const };
  };

  const overallStatus = getOverallStatus();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Diagnóstico TecnoSpeed Open Finance</CardTitle>
              <CardDescription>
                Teste a conectividade e autenticação com a API
              </CardDescription>
            </div>
          </div>
          <Button 
            onClick={runDiagnostics} 
            disabled={isLoading}
            variant={result?.success ? "outline" : "default"}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 mr-2" />
                Executar
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pré-requisitos */}
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-600">Pré-requisitos</AlertTitle>
          <AlertDescription className="text-sm space-y-2 mt-2">
            <p>Antes de testar, verifique no <a href="https://conta.tecnospeed.com.br" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">TecnoAccount <ExternalLink className="h-3 w-3" /></a>:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Conta da Software House ativa</li>
              <li>Token API gerado para o ambiente correto (staging/produção)</li>
              <li>CNPJ da Software House vinculado ao token</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Opções de teste */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="payerCnpj" className="text-sm font-medium">
                CNPJ do Pagador (Opcional)
              </Label>
            </div>
            <Input
              id="payerCnpj"
              placeholder="00.000.000/0001-00"
              value={payerCpfCnpj}
              onChange={(e) => setPayerCpfCnpj(e.target.value)}
            />
          </div>
          
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="useProduction" className="text-sm font-medium">
                  Testar em Produção
                </Label>
              </div>
              <Switch
                id="useProduction"
                checked={useProduction}
                onCheckedChange={setUseProduction}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {useProduction ? '⚠️ Testando API de produção' : 'Testando API de staging (homologação)'}
            </p>
          </div>
        </div>

        {result && (
          <>
            {/* Status Geral */}
            {overallStatus && (
              <Alert variant={overallStatus.variant} className={overallStatus.bg}>
                <div className="flex items-center gap-2">
                  <overallStatus.icon className={`h-5 w-5 ${overallStatus.color}`} />
                  <AlertTitle>{overallStatus.title}</AlertTitle>
                </div>
                <AlertDescription className="mt-2">
                  {result.success 
                    ? `Ambiente: ${result.environment} | Headers: ${result.workingHeaderVariant}` 
                    : result.credentialsOk
                    ? "Credenciais funcionando - verifique dados do pagador"
                    : result.error || "Verifique as recomendações abaixo"}
                </AlertDescription>
              </Alert>
            )}

            {/* Variantes testadas */}
            {result.testedVariants && !result.success && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">Variantes de headers testadas:</p>
                <div className="flex flex-wrap gap-1">
                  {result.testedVariants.map((v, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Credenciais */}
            {result.credentials && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">TOKEN</p>
                    <p className="text-xs text-muted-foreground">
                      {result.credentials.tokenConfigured 
                        ? `${result.credentials.tokenLength} chars` 
                        : "Não configurado"}
                    </p>
                  </div>
                  {getStatusIcon(result.credentials.tokenConfigured)}
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">CNPJ_SH</p>
                    <p className="text-xs text-muted-foreground">
                      {result.credentials.cnpjShConfigured 
                        ? result.credentials.cnpjShPreview 
                        : "Não configurado"}
                    </p>
                  </div>
                  {getStatusIcon(result.credentials.cnpjShConfigured)}
                </div>
              </div>
            )}

            {/* Resumo */}
            {result.summary && (
              <div className="grid grid-cols-5 gap-2">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Server className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{result.summary.totalTests}</p>
                  <p className="text-xs text-muted-foreground">Testes</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-green-500" />
                  <p className="text-lg font-bold text-green-600">{result.summary.successful}</p>
                  <p className="text-xs text-muted-foreground">OK</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-destructive/10">
                  <XCircle className="h-4 w-4 mx-auto mb-1 text-destructive" />
                  <p className="text-lg font-bold text-destructive">{result.summary.authErrors}</p>
                  <p className="text-xs text-muted-foreground">Auth</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                  <p className="text-lg font-bold text-amber-600">{result.summary.validationErrors}</p>
                  <p className="text-xs text-muted-foreground">422</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{result.summary.totalTimeMs}ms</p>
                  <p className="text-xs text-muted-foreground">Tempo</p>
                </div>
              </div>
            )}

            {/* Método Funcional */}
            {result.workingMethod && (
              <Alert className="border-green-500 bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <AlertTitle className="text-green-600">Autenticação Funcional</AlertTitle>
                <AlertDescription className="mt-2 text-sm">
                  <p><strong>Headers:</strong> {result.workingMethod.method}</p>
                  <p><strong>Latência:</strong> {result.workingMethod.latencyMs}ms</p>
                </AlertDescription>
              </Alert>
            )}

            {/* Recomendações */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Recomendações
                </h4>
                <div className="space-y-1 text-sm text-muted-foreground whitespace-pre-line">
                  {result.recommendations.map((rec, idx) => (
                    <p key={idx}>{rec}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Detalhes dos Testes */}
            {result.results && result.results.length > 0 && (
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span>Detalhes ({result.results.length} testes)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
                    {result.results.map((test, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border ${
                          test.success 
                            ? 'border-green-500/50 bg-green-500/5' 
                            : test.errorType === 'auth'
                            ? 'border-destructive/50 bg-destructive/5'
                            : 'border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{test.method}</span>
                            {test.headerVariant && (
                              <Badge variant="outline" className="text-xs">
                                {test.headerVariant}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(test.status, test.errorType)}
                            <span className="text-xs text-muted-foreground">{test.latencyMs}ms</span>
                          </div>
                        </div>
                        {test.message && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <strong>Resposta:</strong> {test.message}
                          </p>
                        )}
                        {test.hint && (
                          <p className="text-xs text-amber-600 mt-1">
                            💡 {test.hint}
                          </p>
                        )}
                        {test.error && (
                          <p className="text-xs text-destructive mt-1">{test.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}

        {!result && !isLoading && (
          <div className="text-center py-6 text-muted-foreground">
            <Wifi className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Clique em "Executar" para testar a conexão</p>
            <p className="text-sm mt-1">O teste verificará múltiplas variantes de headers</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
