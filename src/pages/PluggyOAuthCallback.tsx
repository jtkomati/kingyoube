import { useEffect, useState } from "react";
import { Loader2, CheckCircle, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * PluggyOAuthCallback - Handles the redirect back from Pluggy Connect
 * 
 * After the user completes the Open Finance flow on Pluggy's page,
 * Pluggy redirects here with the result (itemId on success, error on failure).
 * 
 * This page:
 * 1. Parses the result from URL parameters
 * 2. Notifies the parent window via postMessage, BroadcastChannel, and localStorage
 * 3. Closes automatically (or shows a close button if auto-close fails)
 */
const PluggyOAuthCallback = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando conexão...');
  const [canClose, setCanClose] = useState(false);

  const notifyParent = (type: string, data?: Record<string, unknown>) => {
    const message = { type, ...data };
    
    // 1. Try postMessage to opener
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(message, window.location.origin);
        console.log('[PluggyCallback] postMessage sent:', type);
      } catch (e) {
        console.warn('[PluggyCallback] postMessage failed:', e);
      }
    }
    
    // 2. BroadcastChannel fallback
    try {
      const bc = new BroadcastChannel('pluggy_connect');
      bc.postMessage(message);
      bc.close();
      console.log('[PluggyCallback] BroadcastChannel sent:', type);
    } catch (e) {
      console.warn('[PluggyCallback] BroadcastChannel failed:', e);
    }
    
    // 3. localStorage fallback for success
    if (type === 'pluggy:success' && data?.itemId) {
      try {
        localStorage.setItem('pluggy_last_success', JSON.stringify({
          type: 'pluggy:success',
          itemId: data.itemId,
          timestamp: Date.now()
        }));
        console.log('[PluggyCallback] localStorage success marker set');
      } catch (e) {
        console.warn('[PluggyCallback] localStorage failed:', e);
      }
    }
  };

  useEffect(() => {
    console.log('[PluggyCallback] Processing callback...');
    console.log('[PluggyCallback] URL:', window.location.href);
    
    const searchParams = new URLSearchParams(window.location.search);
    
    // Log all params for debugging
    console.log('[PluggyCallback] Search params:', Object.fromEntries(searchParams.entries()));
    console.log('[PluggyCallback] Hash:', window.location.hash);
    
    // Pluggy returns itemId on success
    // Common parameter names: itemId, item_id, id
    let itemId = searchParams.get('itemId') || 
                 searchParams.get('item_id') || 
                 searchParams.get('id');
    
    // Check for error
    let error = searchParams.get('error');
    let errorMessage = searchParams.get('error_description') || 
                       searchParams.get('message') ||
                       searchParams.get('error_message');

    // Also check hash parameters (some OAuth flows use hash-based routing)
    if (!itemId && !error && window.location.hash) {
      const hashString = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hashString);
      
      itemId = hashParams.get('itemId') || 
               hashParams.get('item_id') || 
               hashParams.get('id');
      error = hashParams.get('error');
      errorMessage = hashParams.get('error_description') || 
                     hashParams.get('message');
    }

    if (itemId) {
      // Success!
      console.log('[PluggyCallback] Success! itemId:', itemId);
      setStatus('success');
      setMessage('Conta conectada com sucesso!');
      notifyParent('pluggy:success', { itemId });
      
      // Try to close after a short delay
      setTimeout(() => {
        try {
          window.close();
        } catch (e) {
          console.log('[PluggyCallback] Could not auto-close window');
          setCanClose(true);
        }
      }, 1500);

      // Fallback: show close button after 2s
      setTimeout(() => setCanClose(true), 2000);

    } else if (error) {
      // Error from Pluggy
      console.error('[PluggyCallback] Error:', error, errorMessage);
      setStatus('error');
      setMessage(errorMessage || error || 'Erro na conexão');
      notifyParent('pluggy:error', { error: errorMessage || error });
      setCanClose(true);

    } else {
      // No clear result - check for cancellation
      const cancelled = searchParams.get('cancelled') || searchParams.get('cancel');
      
      if (cancelled === 'true' || cancelled === '1') {
        setStatus('error');
        setMessage('Conexão cancelada pelo usuário');
        notifyParent('pluggy:close');
      } else {
        // Unknown state - might be an intermediate redirect
        console.log('[PluggyCallback] No itemId or error found');
        setStatus('error');
        setMessage('Resposta inesperada. Por favor, tente novamente.');
        notifyParent('pluggy:error', { error: 'Unexpected callback response' });
      }
      setCanClose(true);
    }
  }, []);

  const handleClose = () => {
    notifyParent('pluggy:close');
    try {
      window.close();
    } catch (e) {
      // If we can't close, redirect to main app
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'processing' && (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            )}
            {status === 'success' && (
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            )}
            {status === 'error' && (
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            )}
          </div>
          <CardTitle>
            {status === 'processing' && 'Processando...'}
            {status === 'success' && 'Conexão realizada!'}
            {status === 'error' && 'Ops!'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        
        {canClose && (
          <CardContent className="text-center">
            <Button onClick={handleClose} variant={status === 'success' ? 'default' : 'outline'}>
              <X className="mr-2 h-4 w-4" />
              Fechar janela
            </Button>
            
            {status === 'success' && (
              <p className="mt-3 text-sm text-muted-foreground">
                Esta janela fechará automaticamente...
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default PluggyOAuthCallback;
