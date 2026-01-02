import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PluggyConnect } from "react-pluggy-connect";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * PluggyConnectPopup - Widget with forceOauthInBrowser
 * 
 * Uses the official Pluggy Connect widget with forceOauthInBrowser={true}
 * to ensure OAuth/Open Finance flows open in the system browser,
 * bypassing iframe/webview blocking issues.
 */
export default function PluggyConnectPopup() {
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Get URL params
  const urlParams = new URLSearchParams(window.location.search);
  const companyId = urlParams.get('companyId');
  const cnpj = urlParams.get('cnpj');
  const includeSandbox = urlParams.get('sandbox') === 'true';
  const showDebug = urlParams.has('debug');

  const addDebug = useCallback((msg: string) => {
    const timestamp = new Date().toISOString().slice(11, 23);
    setDebugInfo(prev => [...prev.slice(-29), `[${timestamp}] ${msg}`]);
    console.log(`[PluggyPopup] ${msg}`);
  }, []);

  const notifyParent = useCallback((type: string, data?: Record<string, unknown>) => {
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
  }, [addDebug]);

  // Fetch connect token on mount
  useEffect(() => {
    const fetchToken = async () => {
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

        addDebug('Token received successfully');
        setConnectToken(data.accessToken);
        setIsLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMessage);
        addDebug(`Error: ${errorMessage}`);
        notifyParent('pluggy:error', { error: errorMessage });
        setIsLoading(false);
      }
    };

    fetchToken();
  }, [companyId, addDebug, notifyParent]);

  // Handle widget success
  const handleSuccess = useCallback((data: { item: { id: string } }) => {
    const itemId = data.item?.id;
    addDebug(`Success! itemId: ${itemId}`);
    
    // Save success marker
    try {
      localStorage.setItem('pluggy_last_success', JSON.stringify({
        itemId,
        companyId,
        timestamp: Date.now()
      }));
    } catch (e) {
      addDebug(`localStorage save failed: ${e}`);
    }
    
    notifyParent('pluggy:success', { itemId, companyId });
    
    // Close popup after brief delay
    setTimeout(() => {
      window.close();
    }, 500);
  }, [companyId, addDebug, notifyParent]);

  // Handle widget error
  const handleError = useCallback((error: { message?: string; code?: string }) => {
    const errorMessage = error?.message || error?.code || 'Erro desconhecido';
    addDebug(`Widget error: ${errorMessage}`);
    
    try {
      localStorage.setItem('pluggy_last_error', JSON.stringify({
        error: errorMessage,
        timestamp: Date.now()
      }));
    } catch (e) {
      addDebug(`localStorage save failed: ${e}`);
    }
    
    notifyParent('pluggy:error', { error: errorMessage });
    setError(errorMessage);
  }, [addDebug, notifyParent]);

  // Handle widget close
  const handleClose = useCallback(() => {
    addDebug('Widget closed by user');
    notifyParent('pluggy:close');
    window.close();
  }, [addDebug, notifyParent]);

  // Log events for debugging
  const handleEvent = useCallback((payload: { event: string; timestamp: number }) => {
    addDebug(`Event: ${payload.event}`);
  }, [addDebug]);

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    window.location.reload();
  };

  const handleManualClose = () => {
    notifyParent('pluggy:close');
    window.close();
  };

  // Show error state
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
            <Button onClick={handleManualClose} variant="outline" className="w-full">
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

  // Show loading state
  if (isLoading || !connectToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <CardTitle>Conectando ao Open Finance</CardTitle>
            <CardDescription>
              Preparando conexão segura...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Button onClick={handleManualClose} variant="ghost" size="sm">
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

  // Render widget with forceOauthInBrowser to bypass iframe blocking
  return (
    <div className="min-h-screen bg-background">
      <PluggyConnect
        connectToken={connectToken}
        includeSandbox={includeSandbox}
        forceOauthInBrowser={true}
        onSuccess={handleSuccess}
        onError={handleError}
        onClose={handleClose}
        onEvent={handleEvent}
        language="pt"
        openFinanceParameters={cnpj ? { cnpj: cnpj.replace(/\D/g, '') } : undefined}
      />
      
      {showDebug && (
        <div className="fixed bottom-4 right-4 w-80 p-3 bg-card border rounded-md shadow-lg text-xs font-mono max-h-60 overflow-y-auto">
          <div className="font-bold mb-2 text-foreground">Debug Log</div>
          {debugInfo.map((log, i) => (
            <div key={i} className="text-muted-foreground">{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}
