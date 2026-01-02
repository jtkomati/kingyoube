import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';

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
        .not('tecnospeed_item_id', 'is', null)
        .limit(1);
      
      if (data && data.length > 0) {
        setIsConnected(true);
      }
    };
    
    checkExistingConnection();
  }, [companyId]);

  // Listen for messages from the Pluggy popup
  const handleMessage = useCallback((event: MessageEvent) => {
    // Validate origin - accept messages from Pluggy domains
    const validOrigins = [
      'https://connect.pluggy.ai',
      'https://cdn.pluggy.ai',
      'https://api.pluggy.ai'
    ];
    
    if (!validOrigins.some(origin => event.origin.startsWith(origin.replace('https://', 'https://')))) {
      // Also check if it's from our own origin (for testing)
      if (event.origin !== window.location.origin) {
        return;
      }
    }

    console.log('Received message from Pluggy:', event.data);

    // Handle different message types from Pluggy widget
    if (event.data?.type === 'pluggy-connect:success' || event.data?.event === 'onSuccess') {
      const itemId = event.data?.item?.id || event.data?.itemId;
      if (itemId) {
        handlePluggySuccess(itemId);
      }
    } else if (event.data?.type === 'pluggy-connect:error' || event.data?.event === 'onError') {
      const error = new Error(event.data?.error?.message || 'Erro na conexão');
      handlePluggyError(error);
    } else if (event.data?.type === 'pluggy-connect:close' || event.data?.event === 'onClose') {
      handlePluggyClose();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

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

  const handlePluggySuccess = async (itemId: string) => {
    console.log('Pluggy connection successful, itemId:', itemId);
    
    try {
      // Save the itemId to the database
      if (companyId) {
        const { error } = await supabase
          .from('bank_accounts')
          .upsert({
            company_id: companyId,
            bank_name: 'Open Finance',
            tecnospeed_item_id: itemId,
            open_finance_status: 'connected',
            auto_sync_enabled: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'tecnospeed_item_id'
          });

        if (error) {
          console.error('Error saving Pluggy connection:', error);
          throw error;
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
  };

  const handlePluggyError = (error: Error) => {
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
  };

  const handlePluggyClose = () => {
    setIsLoading(false);
    setPopupWindow(null);
  };

  const handleConnect = async () => {
    setIsLoading(true);
    
    try {
      // Get the webhook URL for this project
      const webhookUrl = `https://rvyoumuclbrjiaeurriy.supabase.co/functions/v1/pluggy-webhook`;
      
      // Fetch connect token from edge function
      const { data, error } = await supabase.functions.invoke('pluggy-create-connect-token', {
        body: { webhookUrl }
      });

      if (error) {
        throw new Error(error.message || 'Erro ao obter token de conexão');
      }

      if (!data?.accessToken) {
        throw new Error('Token de conexão não recebido');
      }

      const connectToken = data.accessToken;
      console.log('Connect token obtained, opening popup...');

      // Build the Pluggy Connect URL with parameters
      const params = new URLSearchParams({
        connectToken,
        includeSandbox: 'true', // Enable sandbox for testing
        language: 'pt'
      });

      // Add CNPJ if available for pre-filling
      if (cnpj) {
        params.append('cpf', cnpj.replace(/\D/g, '')); // Pluggy uses 'cpf' param for both CPF and CNPJ
      }

      const popupUrl = `https://connect.pluggy.ai/?${params.toString()}`;
      
      // Calculate popup position (center of screen)
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Open popup window
      const popup = window.open(
        popupUrl,
        'PluggyConnect',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        throw new Error('Popup bloqueado pelo navegador. Por favor, permita popups para este site.');
      }

      setPopupWindow(popup);
      
      // Focus the popup
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
