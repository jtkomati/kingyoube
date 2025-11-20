import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface PluggyConnectButtonProps {
  bankId: string;
  onSuccess: (itemId: string) => void;
}

// Declare Pluggy types
declare global {
  interface Window {
    PluggyConnect: {
      init: (config: {
        connectToken: string;
        includeSandbox?: boolean;
        onSuccess?: (itemData: { item: { id: string } }) => void;
        onError?: (error: { message: string }) => void;
        onClose?: () => void;
      }) => {
        open: () => void;
      };
    };
  }
}

export function PluggyConnectButton({ bankId, onSuccess }: PluggyConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPluggyLoaded, setIsPluggyLoaded] = useState(false);
  const { toast } = useToast();

  // Load Pluggy script
  useEffect(() => {
    if (window.PluggyConnect) {
      setIsPluggyLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js';
    script.async = true;
    script.onload = () => setIsPluggyLoaded(true);
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const fetchConnectToken = async (): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('create-pluggy-token');
      
      if (error) {
        console.error('Error calling create-pluggy-token:', error);
        throw new Error('Falha ao obter token de conexão');
      }

      if (!data?.accessToken) {
        throw new Error('Token não retornado pela API');
      }

      console.log('Successfully obtained Pluggy token');
      return data.accessToken;
    } catch (error) {
      console.error('Error in fetchConnectToken:', error);
      throw error;
    }
  };

  const handleConnect = async () => {
    if (!isPluggyLoaded) {
      toast({
        title: "Erro",
        description: "Widget de conexão ainda está carregando...",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      
      toast({
        title: "Conectando...",
        description: "Obtendo credenciais seguras da Pluggy...",
      });

      const connectToken = await fetchConnectToken();

      const pluggyConnect = window.PluggyConnect.init({
        connectToken,
        includeSandbox: true, // Enable sandbox for testing
        onSuccess: async (itemData) => {
          const itemId = itemData.item.id;
          
          toast({
            title: "Conexão realizada!",
            description: "Sincronizando dados...",
          });

          // Save itemId to Supabase
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error } = await supabase
              .from('bank_accounts')
              .insert({
                bank_name: bankId === 'bradesco' ? 'Bradesco' : bankId,
                open_finance_consent_id: itemId,
                open_finance_status: 'connected',
                permissions_granted: ['ACCOUNTS_READ', 'ACCOUNTS_BALANCES_READ', 'TRANSACTIONS_READ'],
                consent_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
              });

            if (error) {
              console.error('Error saving bank account:', error);
              toast({
                title: "Erro ao salvar",
                description: "Não foi possível salvar a conexão no banco de dados.",
                variant: "destructive",
              });
            } else {
              onSuccess(itemId);
            }
          }
        },
        onError: (error) => {
          toast({
            title: "Erro na conexão",
            description: error.message || "Não foi possível conectar com o banco.",
            variant: "destructive",
          });
          setIsLoading(false);
        },
        onClose: () => {
          setIsLoading(false);
        },
      });

      pluggyConnect.open();
    } catch (error) {
      console.error('Error connecting:', error);
      toast({
        title: "Falha ao iniciar conexão segura",
        description: error instanceof Error ? error.message : "Não foi possível obter credenciais da Pluggy.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleConnect}
      disabled={isLoading || !isPluggyLoaded}
      className="w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Conectando...
        </>
      ) : (
        'Conectar com Pluggy'
      )}
    </Button>
  );
}
