import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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
  const popupRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Check for existing Pluggy connections
  useEffect(() => {
    const checkExistingConnection = async () => {
      if (!companyId) return;
      
      const { data } = await supabase
        .from('bank_accounts')
        .select('id, pluggy_item_id')
        .eq('company_id', companyId)
        .or('open_finance_status.eq.connected,pluggy_item_id.not.is.null')
        .limit(1);
      
      if (data && data.length > 0) {
        setIsConnected(true);
      }
    };
    
    checkExistingConnection();
  }, [companyId]);

  const handlePluggySuccess = useCallback(async (itemId: string) => {
    console.log('[PluggyButton] Success received, itemId:', itemId);
    
    // Clear localStorage marker
    try {
      localStorage.removeItem('pluggy_last_success');
    } catch (e) {}

    // Clear polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    try {
      // Save/update the connection in bank_accounts
      if (companyId && user?.id) {
        const { error: upsertError } = await supabase
          .from('bank_accounts')
          .upsert({
            company_id: companyId,
            pluggy_item_id: itemId,
            open_finance_status: 'connected',
            bank_name: 'Open Finance',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'pluggy_item_id'
          });

        if (upsertError) {
          console.warn('[PluggyButton] Error saving connection:', upsertError);
        }
      }

      setIsConnected(true);
      setIsLoading(false);
      
      // Close popup if still open
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;
      
      toast.success('Conexão realizada com sucesso!', {
        description: 'Seus dados bancários aparecerão em instantes.'
      });
      
      onSuccess?.(itemId);
    } catch (error) {
      console.error('[PluggyButton] Error in handlePluggySuccess:', error);
      toast.error('Erro ao salvar conexão');
    }
  }, [companyId, user?.id, onSuccess]);

  const handlePluggyError = useCallback((error: string) => {
    console.error('[PluggyButton] Error received:', error);
    setIsLoading(false);
    
    // Clear localStorage marker
    try {
      localStorage.removeItem('pluggy_last_error');
    } catch (e) {}

    // Clear polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    // Close popup if still open
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    
    toast.error('Erro na conexão', {
      description: error || 'Não foi possível conectar sua conta bancária.'
    });
    
    onError?.(new Error(error));
  }, [onError]);

  const handlePluggyClose = useCallback(() => {
    console.log('[PluggyButton] Popup closed');
    setIsLoading(false);
    
    // Clear polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    popupRef.current = null;
  }, []);

  // Handle messages from popup via postMessage
  const handleMessage = useCallback((event: MessageEvent) => {
    // Only accept messages from our own origin
    if (event.origin !== window.location.origin) return;

    const { type, itemId, error } = event.data || {};

    if (type === 'pluggy:success' && itemId) {
      handlePluggySuccess(itemId);
    } else if (type === 'pluggy:error') {
      handlePluggyError(error || 'Connection failed');
    } else if (type === 'pluggy:close') {
      handlePluggyClose();
    }
  }, [handlePluggySuccess, handlePluggyError, handlePluggyClose]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Listen for BroadcastChannel messages
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    
    try {
      channel = new BroadcastChannel('pluggy_connect');
      channel.onmessage = (event) => {
        console.log('[PluggyButton] Received via BroadcastChannel:', event.data);
        const { type, itemId, error } = event.data || {};
        
        if (type === 'pluggy:success' && itemId) {
          handlePluggySuccess(itemId);
        } else if (type === 'pluggy:error') {
          handlePluggyError(error || 'Connection failed');
        } else if (type === 'pluggy:close') {
          handlePluggyClose();
        }
      };
    } catch (e) {
      console.log('[PluggyButton] BroadcastChannel not supported');
    }

    return () => {
      channel?.close();
    };
  }, [handlePluggySuccess, handlePluggyError, handlePluggyClose]);

  // Poll for localStorage fallback and check popup status
  useEffect(() => {
    if (!isLoading) return;

    const checkStatus = () => {
      // Check if popup was closed
      if (popupRef.current && popupRef.current.closed) {
        console.log('[PluggyButton] Popup was closed');
        
        // Check localStorage for success before giving up
        try {
          const successData = localStorage.getItem('pluggy_last_success');
          if (successData) {
            const { itemId, timestamp } = JSON.parse(successData);
            // Accept if within last 5 minutes
            if (Date.now() - timestamp < 5 * 60 * 1000 && itemId) {
              handlePluggySuccess(itemId);
              return;
            }
          }
          
          const errorData = localStorage.getItem('pluggy_last_error');
          if (errorData) {
            const { error, timestamp } = JSON.parse(errorData);
            if (Date.now() - timestamp < 5 * 60 * 1000) {
              handlePluggyError(error);
              return;
            }
          }
        } catch (e) {}
        
        // No success/error marker found, just close
        handlePluggyClose();
        return;
      }

      // Also check localStorage while popup is open (in case messages didn't arrive)
      try {
        const successData = localStorage.getItem('pluggy_last_success');
        if (successData) {
          const { itemId, timestamp } = JSON.parse(successData);
          // Accept if recent (within last 2 minutes)
          if (Date.now() - timestamp < 2 * 60 * 1000 && itemId) {
            handlePluggySuccess(itemId);
            return;
          }
        }
      } catch (e) {}
    };

    pollIntervalRef.current = window.setInterval(checkStatus, 1000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isLoading, handlePluggySuccess, handlePluggyError, handlePluggyClose]);

  const handleConnect = () => {
    setIsLoading(true);
    
    // Clear any old markers
    try {
      localStorage.removeItem('pluggy_last_success');
      localStorage.removeItem('pluggy_last_error');
    } catch (e) {}

    // Build URL for popup
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', companyId);
    if (cnpj) params.set('cnpj', cnpj);
    params.set('sandbox', 'true'); // Enable sandbox for testing

    const popupUrl = `/pluggy/connect?${params.toString()}`;
    
    // Calculate popup position (centered)
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Open popup
    const popup = window.open(
      popupUrl,
      'PluggyConnect',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      toast.error('Popup bloqueado', {
        description: 'Por favor, permita popups para este site e tente novamente.'
      });
      setIsLoading(false);
      return;
    }

    popupRef.current = popup;
    popup.focus();
  };

  if (isConnected) {
    return (
      <Button 
        variant="outline" 
        className="w-full gap-2 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10"
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
