import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const BROADCAST_CHANNEL_NAME = 'pluggy_oauth';

interface PluggyConnectButtonProps {
  companyId?: string;
  cnpj?: string;
  onSuccess?: (itemId: string) => void;
  onError?: (error: Error) => void;
}

export function PluggyConnectButton({ 
  companyId, 
  cnpj, 
  onSuccess, 
  onError 
}: PluggyConnectButtonProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);

  // Check for existing Pluggy connections
  useEffect(() => {
    const checkExistingConnection = async () => {
      if (!companyId) return;
      
      const { data } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('company_id', companyId)
        .eq('open_finance_status', 'connected')
        .limit(1);
      
      if (data && data.length > 0) {
        setIsConnected(true);
      }
    };
    
    checkExistingConnection();
  }, [companyId]);

  const handlePluggySuccess = useCallback(async (itemId: string) => {
    console.log('Pluggy connection successful, itemId:', itemId);
    
    try {
      // Save the connection to the database
      if (companyId && user?.id) {
        const { error: connError } = await (supabase
          .from('pluggy_connections' as any)
          .insert({
            company_id: companyId,
            created_by: user.id,
            pluggy_item_id: itemId,
            status: 'connected'
          }) as any);

        if (connError) {
          console.error('Error saving Pluggy connection:', connError);
          if (!connError.message?.includes('duplicate')) {
            console.warn('Non-duplicate error, but continuing...');
          }
        }
      }

      setIsConnected(true);
      setIsLoading(false);
      
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
      setPopupWindow(null);
      
      toast.success('Conexão realizada com sucesso!', {
        description: 'Seus dados bancários aparecerão em instantes.'
      });
      
      onSuccess?.(itemId);
    } catch (error) {
      console.error('Error in handlePluggySuccess:', error);
      toast.error('Erro ao salvar conexão');
    }
  }, [companyId, user?.id, popupWindow, onSuccess]);

  const handlePluggyError = useCallback((error: Error) => {
    console.error('Pluggy connection error:', error);
    setIsLoading(false);
    
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    setPopupWindow(null);
    
    toast.error('Erro na conexão', {
      description: error.message
    });
    
    onError?.(error);
  }, [popupWindow, onError]);

  const handlePluggyClose = useCallback(() => {
    setIsLoading(false);
    setPopupWindow(null);
  }, []);

  // Handle messages from our popup page via postMessage
  const handleMessage = useCallback((event: MessageEvent) => {
    // Only accept messages from our own origin
    if (event.origin !== window.location.origin) {
      return;
    }

    console.log('Received message from popup:', event.data);

    const { type, itemId, error } = event.data || {};

    if (type === 'pluggy:success' && itemId) {
      handlePluggySuccess(itemId);
    } else if (type === 'pluggy:error') {
      handlePluggyError(new Error(error || 'Connection failed'));
    } else if (type === 'pluggy:close') {
      handlePluggyClose();
    }
  }, [handlePluggySuccess, handlePluggyError, handlePluggyClose]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Listen for BroadcastChannel messages (resilient callback)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (event) => {
        console.log('Received via BroadcastChannel:', event.data);
        const { type, itemId, error } = event.data || {};
        
        if (type === 'pluggy:success' && itemId) {
          handlePluggySuccess(itemId);
        } else if (type === 'pluggy:error') {
          handlePluggyError(new Error(error || 'Connection failed'));
        } else if (type === 'pluggy:close') {
          handlePluggyClose();
        }
      };
    } catch (e) {
      console.log('BroadcastChannel not supported');
    }

    return () => {
      channel?.close();
    };
  }, [handlePluggySuccess, handlePluggyError, handlePluggyClose]);

  // Check localStorage for success (fallback mechanism)
  useEffect(() => {
    const checkLocalStorage = () => {
      try {
        const stored = localStorage.getItem('pluggy_last_success');
        if (stored) {
          const data = JSON.parse(stored);
          // Only process if recent (within last 30 seconds)
          if (data.timestamp && Date.now() - data.timestamp < 30000) {
            if (data.type === 'pluggy:success' && data.itemId && isLoading) {
              console.log('Found success in localStorage:', data);
              localStorage.removeItem('pluggy_last_success');
              handlePluggySuccess(data.itemId);
            }
          }
        }
      } catch (e) {
        console.log('Error checking localStorage:', e);
      }
    };

    // Check immediately and on focus
    checkLocalStorage();
    window.addEventListener('focus', checkLocalStorage);
    
    return () => window.removeEventListener('focus', checkLocalStorage);
  }, [isLoading, handlePluggySuccess]);

  // Poll to check if popup was closed manually
  useEffect(() => {
    if (!popupWindow) return;

    const checkPopupClosed = setInterval(() => {
      if (popupWindow.closed) {
        setIsLoading(false);
        setPopupWindow(null);
        clearInterval(checkPopupClosed);
      }
    }, 500);

    return () => clearInterval(checkPopupClosed);
  }, [popupWindow]);

  const handleConnect = async () => {
    setIsLoading(true);
    
    try {
      // Build URL for our popup page
      const params = new URLSearchParams();
      if (companyId) params.set('companyId', companyId);
      if (cnpj) params.set('cnpj', cnpj);
      // Enable sandbox for development/testing
      params.set('sandbox', 'true');

      const popupUrl = `/pluggy/connect?${params.toString()}`;
      
      // Calculate popup position (center of screen)
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Open our popup page - use noopener for security but we have fallbacks
      const popup = window.open(
        popupUrl,
        'PluggyConnect',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        throw new Error('Popup bloqueado pelo navegador. Por favor, permita popups para este site.');
      }

      setPopupWindow(popup);
      popup.focus();

    } catch (error) {
      console.error('Error initiating Pluggy connection:', error);
      setIsLoading(false);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao iniciar conexão', {
        description: errorMessage
      });
      
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  };

  if (isConnected) {
    return (
      <Button 
        variant="outline" 
        className="w-full gap-2 border-green-500 text-green-600 hover:bg-green-50"
        disabled
      >
        <CheckCircle2 className="h-4 w-4" />
        Conectado via Open Finance
      </Button>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isLoading}
      className="w-full gap-2"
      variant="default"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Conectando...
        </>
      ) : (
        <>
          <Building2 className="h-4 w-4" />
          Conectar via Open Finance
          <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
        </>
      )}
    </Button>
  );
}
