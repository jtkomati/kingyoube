import { useEffect, useState } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ExternalLink } from 'lucide-react';

const BROADCAST_CHANNEL_NAME = 'pluggy_oauth';
const STORAGE_KEY = 'pluggy_oauth_callback';

export default function PluggyConnectPopup() {
  const { user } = useAuth();
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInIframe, setIsInIframe] = useState(false);

  // Get URL params
  const urlParams = new URLSearchParams(window.location.search);
  const companyId = urlParams.get('companyId');
  const cnpj = urlParams.get('cnpj');
  const includeSandbox = urlParams.get('sandbox') === 'true';

  // Detect if we're running inside an iframe
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      // If we can't access window.top, we're definitely in an iframe
      setIsInIframe(true);
    }
  }, []);

  // Listen for OAuth callback via BroadcastChannel and localStorage
  useEffect(() => {
    // BroadcastChannel listener
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (event) => {
        console.log('Received OAuth callback via BroadcastChannel:', event.data);
        if (event.data?.type === 'pluggy:oauth_callback') {
          // OAuth callback received - the widget should handle this automatically
          console.log('OAuth callback detected, widget should continue...');
        }
      };
    } catch (e) {
      console.log('BroadcastChannel not supported');
    }

    // localStorage listener
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          console.log('Received OAuth callback via localStorage:', data);
        } catch (e) {
          console.log('Error parsing storage event:', e);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      channel?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    // Don't fetch token if we're in an iframe - show escape UI instead
    if (isInIframe) {
      setIsLoading(false);
      return;
    }

    const fetchToken = async () => {
      try {
        console.log('Fetching Pluggy connect token...');
        
        const { data, error: fnError } = await supabase.functions.invoke('create-pluggy-token', {
          body: { 
            companyId: companyId || undefined,
            userId: user?.id || undefined,
            origin: window.location.origin
          }
        });

        if (fnError) {
          throw new Error(fnError.message || 'Failed to get connect token');
        }

        if (!data?.accessToken) {
          throw new Error('No access token received');
        }

        console.log('Connect token received');
        setConnectToken(data.accessToken);
      } catch (err) {
        console.error('Error fetching token:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        
        // Notify parent window of error
        notifyParent({ 
          type: 'pluggy:error', 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, [companyId, user?.id, isInIframe]);

  const notifyParent = (message: object) => {
    // Try postMessage to opener
    if (window.opener) {
      try {
        window.opener.postMessage(message, window.location.origin);
      } catch (e) {
        console.log('postMessage to opener failed:', e);
      }
    }
    
    // Try BroadcastChannel
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage(message);
      channel.close();
    } catch (e) {
      console.log('BroadcastChannel not available');
    }
  };

  const handleSuccess = (data: { item: { id: string } }) => {
    console.log('Pluggy connection successful:', data.item.id);
    
    // Notify via multiple channels for resilience
    const successMessage = { 
      type: 'pluggy:success', 
      itemId: data.item.id 
    };
    
    notifyParent(successMessage);
    
    // Also store in localStorage for fallback
    try {
      localStorage.setItem('pluggy_last_success', JSON.stringify({
        ...successMessage,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.log('localStorage not available');
    }
    
    // Close this popup
    window.close();
  };

  const handleError = (error: { message?: string; code?: string }) => {
    console.error('Pluggy connection error:', error);
    
    notifyParent({ 
      type: 'pluggy:error', 
      error: error.message || 'Connection failed' 
    });
  };

  const handleClose = () => {
    console.log('Pluggy widget closed');
    
    notifyParent({ type: 'pluggy:close' });
    
    // Close this popup
    window.close();
  };

  const handleOpenInNewWindow = () => {
    // Open the same URL in a new window (outside iframe)
    const newWindow = window.open(
      window.location.href,
      'PluggyConnect',
      'width=500,height=700,toolbar=no,menubar=no,scrollbars=yes,resizable=yes'
    );
    newWindow?.focus();
  };

  // If we're in an iframe, show escape UI
  if (isInIframe) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <ExternalLink className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Abrir em nova janela
          </h2>
          <p className="text-muted-foreground mb-4">
            Por segurança, a conexão bancária precisa ser aberta em uma janela separada.
          </p>
          <button 
            onClick={handleOpenInNewWindow}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
          >
            Abrir conexão segura
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Preparando conexão segura...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h2 className="text-lg font-semibold text-destructive mb-2">Erro ao conectar</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => window.close()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  if (!connectToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Token não disponível</p>
        <button 
          onClick={() => window.close()}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PluggyConnect
        connectToken={connectToken}
        includeSandbox={includeSandbox}
        updateItem={undefined}
        onSuccess={handleSuccess}
        onError={handleError}
        onClose={handleClose}
        language="pt"
        // Force OAuth to open in system browser instead of webview/iframe
        forceOauthInBrowser={true}
        // Pass CNPJ for pre-filling if available (for companies/PJ)
        {...(cnpj ? { openFinanceParameters: { cnpj: cnpj.replace(/\D/g, '') } } : {})}
      />
    </div>
  );
}
