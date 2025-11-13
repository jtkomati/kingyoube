import { useState, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ElevenLabsVoiceChatProps {
  agentId: string;
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
}

export function ElevenLabsVoiceChat({ agentId, onTranscript }: ElevenLabsVoiceChatProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const conversation = useConversation({
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
    <div className="flex items-center gap-2">
      <Button
        variant={isConnected ? 'destructive' : 'default'}
        size="icon"
        onClick={toggleConversation}
        disabled={isConnecting}
        className="h-[60px] w-[60px]"
        title={isConnected ? 'Encerrar conversa' : 'Iniciar conversa por voz'}
      >
        {isConnected ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>

      {isConnected && (
        <div className="flex items-center gap-2 text-sm">
          {isSpeaking ? (
            <>
              <Volume2 className="h-4 w-4 animate-pulse text-primary" />
              <span className="text-muted-foreground">Falando...</span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Escutando...</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
