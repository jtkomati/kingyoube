import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Link2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TecnoSpeedConnectButtonProps {
  bankId: string;
  onSuccess: (accountHash: string) => void;
}

export function TecnoSpeedConnectButton({ bankId, onSuccess }: TecnoSpeedConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // First validate credentials with our edge function
      const { data, error } = await supabase.functions.invoke('create-tecnospeed-token');

      if (error) {
        throw new Error(error.message || 'Falha ao validar credenciais');
      }

      if (!data.success) {
        throw new Error(data.error || 'Falha na autenticação');
      }

      // For now, we'll simulate the connection flow
      // In production, this would redirect to TecnoSpeed's Open Finance authorization flow
      toast.info("Redirecionando para autorização Open Finance...", {
        description: "Você será redirecionado para o portal do seu banco.",
      });

      // Simulate a delay for the authorization flow
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful connection - in production this would come from callback
      const mockAccountHash = `TRS${Date.now().toString(36).toUpperCase()}`;
      
      setIsConnected(true);
      onSuccess(mockAccountHash);
      
      toast.success("Conta conectada com sucesso!", {
        description: "Sua conta bancária foi vinculada via Open Finance.",
      });

    } catch (error) {
      console.error('Error connecting to TecnoSpeed:', error);
      toast.error("Falha na conexão", {
        description: error instanceof Error ? error.message : "Não foi possível conectar ao banco.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isConnected) {
    return (
      <Button disabled className="w-full gap-2 bg-green-600 hover:bg-green-600">
        <CheckCircle2 className="h-4 w-4" />
        Conta Conectada
      </Button>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isLoading}
      className="w-full gap-2"
      size="lg"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Conectando...
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4" />
          Conectar via Open Finance
        </>
      )}
    </Button>
  );
}
