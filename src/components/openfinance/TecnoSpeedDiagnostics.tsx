import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Clock
} from "lucide-react";

interface TestResult {
  method: string;
  endpoint: string;
  status: number;
  success: boolean;
  response?: unknown;
  error?: string;
  latencyMs: number;
}

interface DiagnosticsResult {
  success: boolean;
  summary?: {
    totalTests: number;
    successful: number;
    authErrors: number;
    notFound: number;
    networkErrors: number;
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

  const runDiagnostics = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      toast.info("Executando diagnóstico da conexão TecnoSpeed...");
      
      const { data, error } = await supabase.functions.invoke('test-tecnospeed-connection');
      
      if (error) {
        throw error;
      }
      
      setResult(data as DiagnosticsResult);
      
      if (data?.success) {
        toast.success("Conexão com TecnoSpeed funcionando!");
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

  const getStatusBadge = (status: number) => {
    if (status === 0) return <Badge variant="outline">Erro de Rede</Badge>;
    if (status >= 200 && status < 300) return <Badge className="bg-green-500">OK</Badge>;
    if (status === 401 || status === 403) return <Badge variant="destructive">Auth Inválido</Badge>;
    if (status === 404) return <Badge variant="secondary">Não Encontrado</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

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
                Teste a conectividade e autenticação com a API TecnoSpeed
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
                Executar Diagnóstico
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {result && (
          <>
            {/* Status Geral */}
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
                <AlertTitle>
                  {result.success ? "Conexão Funcionando" : "Problemas Detectados"}
                </AlertTitle>
              </div>
              <AlertDescription className="mt-2">
                {result.success 
                  ? `Método funcional: ${result.workingMethod?.method}` 
                  : result.error || "Verifique as recomendações abaixo"}
              </AlertDescription>
            </Alert>

            {/* Credenciais */}
            {result.credentials && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">TECNOSPEED_TOKEN</p>
                    <p className="text-xs text-muted-foreground">
                      {result.credentials.tokenConfigured 
                        ? `Configurado (${result.credentials.tokenLength} chars)` 
                        : "Não configurado"}
                    </p>
                  </div>
                  {getStatusIcon(result.credentials.tokenConfigured)}
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">TECNOSPEED_CNPJ_SOFTWAREHOUSE</p>
                    <p className="text-xs text-muted-foreground">
                      {result.credentials.cnpjShConfigured 
                        ? `Configurado (${result.credentials.cnpjShPreview})` 
                        : "Não configurado"}
                    </p>
                  </div>
                  {getStatusIcon(result.credentials.cnpjShConfigured)}
                </div>
              </div>
            )}

            {/* Resumo */}
            {result.summary && (
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <Server className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{result.summary.totalTests}</p>
                  <p className="text-xs text-muted-foreground">Testes</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
                  <p className="text-2xl font-bold text-green-600">{result.summary.successful}</p>
                  <p className="text-xs text-muted-foreground">Sucesso</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-destructive/10">
                  <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                  <p className="text-2xl font-bold text-destructive">{result.summary.authErrors}</p>
                  <p className="text-xs text-muted-foreground">Auth Errors</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{result.summary.totalTimeMs}ms</p>
                  <p className="text-xs text-muted-foreground">Tempo Total</p>
                </div>
              </div>
            )}

            {/* Método Funcional */}
            {result.workingMethod && (
              <Alert className="border-green-500 bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <AlertTitle className="text-green-600">Método de Autenticação Funcional</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1">
                    <p><strong>Método:</strong> {result.workingMethod.method}</p>
                    <p><strong>Endpoint:</strong> {result.workingMethod.endpoint}</p>
                    <p><strong>Latência:</strong> {result.workingMethod.latencyMs}ms</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Recomendações */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Recomendações
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {result.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Detalhes dos Testes */}
            {result.results && result.results.length > 0 && (
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span>Ver Detalhes dos Testes ({result.results.length})</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                    {result.results.map((test, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border ${test.success ? 'border-green-500/50 bg-green-500/5' : 'border-border'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{test.method}</span>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(test.status)}
                            <span className="text-xs text-muted-foreground">{test.latencyMs}ms</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{test.endpoint}</p>
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
          <div className="text-center py-8 text-muted-foreground">
            <Wifi className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Clique em "Executar Diagnóstico" para testar a conexão</p>
            <p className="text-sm mt-1">O teste verificará diferentes métodos de autenticação e endpoints</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
