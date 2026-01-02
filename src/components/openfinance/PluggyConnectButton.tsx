import { useState } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';
import { Button } from '@/components/ui/button';
import { Landmark, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Get connect token from edge function
      const { data, error } = await supabase.functions.invoke('pluggy-create-connect-token', {
        body: {
          webhookUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pluggy-webhook`,
        },
      });

      if (error) throw error;

      if (!data?.accessToken) {
        throw new Error('Failed to get connect token');
      }

      console.log('Connect token obtained, opening Pluggy widget');
      setConnectToken(data.accessToken);
    } catch (error) {
      console.error('Error getting connect token:', error);
      toast.error('Erro ao iniciar conexão com Open Finance');
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePluggySuccess = async (data: { item: { id: string } }) => {
    console.log('Pluggy connection success:', data);
    const itemId = data.item.id;

    try {
      // Save item to database
      if (companyId) {
        const { error } = await supabase
          .from('bank_accounts')
          .insert({
            company_id: companyId,
            pluggy_item_id: itemId,
            bank_name: 'Open Finance',
            open_finance_status: 'pending',
          });

        if (error) {
          console.error('Error saving item:', error);
        }
      }

      setIsConnected(true);
      setConnectToken(null);
      toast.success('Conta bancária conectada com sucesso!');
      onSuccess?.(itemId);
    } catch (error) {
      console.error('Error saving connection:', error);
      toast.error('Erro ao salvar conexão');
    }
  };

  const handlePluggyError = (error: { message: string; code?: string }) => {
    console.error('Pluggy error:', error);
    setConnectToken(null);
    toast.error(`Erro na conexão: ${error.message}`);
    onError?.(new Error(error.message));
  };

  const handlePluggyClose = () => {
    console.log('Pluggy widget closed');
    setConnectToken(null);
  };

  if (isConnected) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <CheckCircle className="h-4 w-4 text-green-500" />
        Conta Conectada
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={handleConnect}
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Conectando...
          </>
        ) : (
          <>
            <Landmark className="h-4 w-4" />
            Conectar via Open Finance
          </>
        )}
      </Button>

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={true}
          onSuccess={handlePluggySuccess}
          onError={handlePluggyError}
          onClose={handlePluggyClose}
          connectorTypes={[1, 2, 3, 4]} // Banks, Credit cards, Investments, etc.
        />
      )}
    </>
  );
}
