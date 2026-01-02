import { useEffect, useState } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function PluggyConnectPopup() {
  const { user } = useAuth();
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get URL params
  const urlParams = new URLSearchParams(window.location.search);
  const companyId = urlParams.get('companyId');
  const cnpj = urlParams.get('cnpj');
  const includeSandbox = urlParams.get('sandbox') === 'true';

  useEffect(() => {
    const fetchToken = async () => {
      try {
        console.log('Fetching Pluggy connect token...');
        
        const { data, error: fnError } = await supabase.functions.invoke('create-pluggy-token', {
          body: { 
            companyId: companyId || undefined,
            userId: user?.id || undefined
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
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'pluggy:error', 
            error: err instanceof Error ? err.message : 'Unknown error' 
          }, window.location.origin);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, [companyId, user?.id]);

  const handleSuccess = (data: { item: { id: string } }) => {
    console.log('Pluggy connection successful:', data.item.id);
    
    // Send success message to parent window
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'pluggy:success', 
        itemId: data.item.id 
      }, window.location.origin);
    }
    
    // Close this popup
    window.close();
  };

  const handleError = (error: { message?: string; code?: string }) => {
    console.error('Pluggy connection error:', error);
    
    // Send error message to parent window
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'pluggy:error', 
        error: error.message || 'Connection failed' 
      }, window.location.origin);
    }
  };

  const handleClose = () => {
    console.log('Pluggy widget closed');
    
    // Notify parent that widget was closed
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'pluggy:close' 
      }, window.location.origin);
    }
    
    // Close this popup
    window.close();
  };

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
        // Pass CNPJ for pre-filling if available (for companies/PJ)
        {...(cnpj ? { openFinanceParameters: { cnpj: cnpj.replace(/\D/g, '') } } : {})}
      />
    </div>
  );
}
