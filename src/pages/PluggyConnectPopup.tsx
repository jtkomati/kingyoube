import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * PluggyConnectPopup - Redirects directly to Pluggy Connect URL
 * 
 * This approach completely avoids iframe/embedding issues by redirecting
 * this popup window directly to Pluggy's connect page.
 * 
 * Flow:
 * 1. User clicks "Conectar via Open Finance" -> opens this popup
 * 2. This page fetches connectToken from our edge function
 * 3. Redirects to https://connect.pluggy.ai with token and redirect_uri
 * 4. User completes flow on Pluggy's domain
 * 5. Pluggy redirects back to /pluggy/oauth/callback
 * 6. Callback page notifies parent window and closes
 */
export default function PluggyConnectPopup() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Get URL params
  const urlParams = new URLSearchParams(window.location.search);
  const companyId = urlParams.get('companyId');
  const cnpj = urlParams.get('cnpj');
  const includeSandbox = urlParams.get('sandbox') === 'true';
  const showDebug = urlParams.has('debug');

  const addDebug = (msg: string) => {
    const timestamp = new Date().toISOString().slice(11, 23);
    setDebugInfo(prev => [...prev.slice(-19), `[${timestamp}] ${msg}`]);
    console.log(`[PluggyPopup] ${msg}`);
  };

  const notifyParent = (type: string, data?: Record<string, unknown>) => {
    const message = { type, ...data };
    
    // 1. postMessage to opener
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(message, window.location.origin);
        addDebug(`postMessage sent: ${type}`);
      } catch (e) {
        addDebug(`postMessage failed: ${e}`);
      }
    }
    
    // 2. BroadcastChannel fallback
    try {
      const bc = new BroadcastChannel('pluggy_connect');
      bc.postMessage(message);
      bc.close();
      addDebug(`BroadcastChannel sent: ${type}`);
    } catch (e) {
      addDebug(`BroadcastChannel failed: ${e}`);
    }
    
    // 3. localStorage fallback
    try {
      if (type === 'pluggy:error') {
        localStorage.setItem('pluggy_last_error', JSON.stringify({
          error: data?.error || 'Unknown error',
          timestamp: Date.now()
        }));
      }
    } catch (e) {
      addDebug(`localStorage failed: ${e}`);
    }
  };

  const initiatePluggyRedirect = async () => {
    setIsLoading(true);
    setError(null);
    addDebug('Fetching connect token...');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-pluggy-token', {
        body: { 
          companyId: companyId || undefined,
          origin: window.location.origin
        }
      });
      
      if (fnError) {
        throw new Error(fnError.message || 'Failed to create connect token');
      }
      
      if (!data?.accessToken) {
        throw new Error('No access token received from server');
      }

      addDebug('Token received, preparing redirect...');

      // Build the Pluggy Connect URL with redirect
      const redirectUri = `${window.location.origin}/pluggy/oauth/callback`;
      const pluggyConnectUrl = new URL('https://connect.pluggy.ai');
      pluggyConnectUrl.searchParams.set('connect_token', data.accessToken);
      pluggyConnectUrl.searchParams.set('redirect_uri', redirectUri);
      
      // Optional: include sandbox mode
      if (includeSandbox) {
        pluggyConnectUrl.searchParams.set('include_sandbox', 'true');
      }
      
      // Optional: pre-fill CNPJ for companies
      if (cnpj) {
        pluggyConnectUrl.searchParams.set('cpf_cnpj', cnpj.replace(/\D/g, ''));
      }
      
      addDebug(`Redirect URI: ${redirectUri}`);
      addDebug(`Redirecting to Pluggy Connect...`);

      // Redirect this popup window directly to Pluggy
      window.location.href = pluggyConnectUrl.toString();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao conectar';
      setError(errorMessage);
      addDebug(`Error: ${errorMessage}`);
      notifyParent('pluggy:error', { error: errorMessage });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    addDebug(`Popup initialized at ${window.location.origin}`);
    addDebug(`Opener present: ${!!window.opener}`);
    
    // Small delay to ensure the popup is fully rendered
    const timer = setTimeout(() => {
      initiatePluggyRedirect();
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    notifyParent('pluggy:close');
    window.close();
  };

  const handleRetry = () => {
    setError(null);
    initiatePluggyRedirect();
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Erro na conexão</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleRetry} className="w-full" variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
            <Button onClick={handleClose} variant="outline" className="w-full">
              Fechar
            </Button>
            
            {showDebug && (
              <div className="mt-4 p-3 bg-muted rounded-md text-xs font-mono max-h-40 overflow-y-auto">
                {debugInfo.map((log, i) => (
                  <div key={i} className="text-muted-foreground">{log}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <CardTitle>Conectando ao Open Finance</CardTitle>
          <CardDescription>
            Você será redirecionado para a página segura do Pluggy...
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <ExternalLink className="h-4 w-4" />
            <span>Abrindo conexão segura</span>
          </div>
          
          <Button onClick={handleClose} variant="ghost" size="sm">
            Cancelar
          </Button>

          {showDebug && (
            <div className="mt-4 p-3 bg-muted rounded-md text-xs font-mono max-h-40 overflow-y-auto text-left">
              {debugInfo.map((log, i) => (
                <div key={i} className="text-muted-foreground">{log}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
