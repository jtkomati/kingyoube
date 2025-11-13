import { useState, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { VoiceVisualizer } from './VoiceVisualizer';
import { useERPData } from '@/hooks/useERPData';

interface ElevenLabsVoiceChatProps {
  agentId: string;
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
}

export function ElevenLabsVoiceChat({ agentId, onTranscript }: ElevenLabsVoiceChatProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const erpData = useERPData();

  const conversation = useConversation({
    clientTools: {
      get_transactions_summary: async () => {
        console.log('🎙️ Buscando resumo de transações...');
        const result = await erpData.getTransactionsSummary();
        console.log('🎙️ Resultado:', result);
        return result;
      },
      get_recent_transactions: async (parameters: { limit?: number }) => {
        console.log('🎙️ Buscando transações recentes...');
        const result = await erpData.getRecentTransactions(parameters.limit || 5);
        console.log('🎙️ Resultado:', result);
        return result;
      },
      get_customers: async () => {
        console.log('🎙️ Buscando clientes...');
        const result = await erpData.getCustomers();
        console.log('🎙️ Resultado:', result);
        return result;
      },
      get_suppliers: async () => {
        console.log('🎙️ Buscando fornecedores...');
        const result = await erpData.getSuppliers();
        console.log('🎙️ Resultado:', result);
        return result;
      },
      get_cash_flow_summary: async () => {
        console.log('🎙️ Buscando resumo de fluxo de caixa...');
        const result = await erpData.getCashFlowSummary();
        console.log('🎙️ Resultado:', result);
        return result;
      },
    },
    onConnect: () => {
      console.log('🎙️ Conectado ao agente ElevenLabs');
      toast({
        description: 'Conectado ao assistente de voz!',
        duration: 2000,
      });
    },
    onDisconnect: () => {
      console.log('🎙️ Desconectado do agente ElevenLabs');
    },
    onMessage: (message) => {
      console.log('🎙️ Mensagem recebida:', message);
      
      // Enviar transcrições para o componente pai
      if (onTranscript && message.message) {
        const role = message.source === 'user' ? 'user' : 'assistant';
        onTranscript(message.message, role);
      }
    },
    onError: (error) => {
      console.error('🎙️ Erro no agente:', error);
      toast({
        title: 'Erro',
        description: 'Erro na conversa de voz',
        variant: 'destructive',
      });
    },
  });

  const startConversation = async () => {
    try {
      setIsConnecting(true);

      // Solicitar permissão do microfone
      await navigator.mediaDevices.getUserMedia({ audio: true });

      console.log('🎙️ Solicitando signed URL...');
      
      // Obter signed URL do backend
      const { data, error } = await supabase.functions.invoke('elevenlabs-signed-url', {
        body: { agentId }
      });

      if (error) throw error;

      if (!data?.signedUrl) {
        throw new Error('Signed URL não recebida');
      }

      console.log('🎙️ Iniciando sessão...');
      
      // Iniciar conversa com signed URL
      await conversation.startSession({ 
        signedUrl: data.signedUrl 
      });

    } catch (error) {
      console.error('🎙️ Erro ao iniciar conversa:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível iniciar a conversa',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
      toast({
        description: 'Conversa encerrada',
        duration: 2000,
      });
    } catch (error) {
      console.error('🎙️ Erro ao encerrar conversa:', error);
    }
  };

  const toggleConversation = () => {
    if (conversation.status === 'connected') {
      endConversation();
    } else {
      startConversation();
    }
  };

  const isConnected = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Visualizador de voz estilo "Her" */}
      {isConnected && (
        <div className="w-full max-w-2xl">
          <VoiceVisualizer isActive={isConnected} isSpeaking={isSpeaking} />
        </div>
      )}

      {/* Botão central grande */}
      <div className="relative flex flex-col items-center gap-4">
        <Button
          variant={isConnected ? 'destructive' : 'default'}
          size="icon"
          onClick={toggleConversation}
          disabled={isConnecting}
          className={`h-24 w-24 rounded-full transition-all duration-300 ${
            isConnected && isSpeaking 
              ? 'scale-110 shadow-lg shadow-red-500/50' 
              : isConnected 
                ? 'scale-105' 
                : ''
          }`}
          title={isConnected ? 'Encerrar conversa' : 'Iniciar conversa por voz'}
        >
          <Mic className={`h-10 w-10 ${isSpeaking ? 'animate-pulse' : ''}`} />
        </Button>

        {/* Status text */}
        <div className="text-center">
          {isConnecting ? (
            <p className="text-sm text-muted-foreground animate-pulse">Conectando...</p>
          ) : isConnected ? (
            <p className="text-sm text-muted-foreground">
              {isSpeaking ? 'Falando...' : 'Escutando...'}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Clique para conversar</p>
          )}
        </div>
      </div>
    </div>
  );
}
