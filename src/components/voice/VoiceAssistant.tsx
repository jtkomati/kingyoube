import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VoiceVisualizer } from '@/components/chat/VoiceVisualizer';

interface VoiceAssistantProps {
  onTranscript: (text: string) => void;
  onResponse?: (text: string) => void;
  agentId?: string;
  compact?: boolean;
}

export function VoiceAssistant({ 
  onTranscript, 
  onResponse,
  agentId = 'manager',
  compact = false 
}: VoiceAssistantProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Limpar áudio ao desmontar
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Converter para base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result?.toString().split(',')[1];
          if (result) resolve(result);
          else reject(new Error('Falha ao converter áudio'));
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      // Transcrever com Gemini
      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke(
        'gemini-voice-to-text',
        { body: { audio: base64Audio, mimeType: 'audio/webm' } }
      );

      if (transcriptError) throw transcriptError;

      const transcript = transcriptData?.text;
      if (!transcript) {
        toast.error('Não foi possível entender o áudio');
        return;
      }

      toast.success('Áudio transcrito!');
      onTranscript(transcript);

      // Se for o Gerente Financeiro (orquestrador), processar com agent-orchestrator
      if (agentId === 'manager' && onResponse) {
        setIsProcessing(true);
        
        const { data: responseData, error: responseError } = await supabase.functions.invoke(
          'agent-orchestrator',
          { body: { message: transcript } }
        );

        if (responseError) throw responseError;

        const responseText = responseData?.message;
        if (responseText) {
          onResponse(responseText);
          
          // Sintetizar resposta em áudio se habilitado
          if (audioEnabled) {
            await speakResponse(responseText);
          }
        }
      }

    } catch (error) {
      console.error('Erro ao processar áudio:', error);
      toast.error('Erro ao processar áudio');
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true);

      const { data, error } = await supabase.functions.invoke(
        'gemini-text-to-speech',
        { body: { text: text.substring(0, 500), voice: 'Kore' } }
      );

      if (error) throw error;

      if (data?.audioContent) {
        // Criar e reproduzir áudio
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audioRef.current = audio;
        
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          audioRef.current = null;
        };

        await audio.play();
      }
    } catch (error) {
      console.error('Erro ao sintetizar voz:', error);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
    }
  }, []);

  const handleVoiceClick = () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    if (isSpeaking) {
      stopSpeaking();
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant={isRecording ? 'destructive' : 'outline'}
          size="icon"
          onClick={handleVoiceClick}
          disabled={isProcessing}
          className="h-10 w-10"
        >
          {isProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isSpeaking ? (
            <Volume2 className="h-5 w-5 animate-pulse" />
          ) : isRecording ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleAudio}
          className="h-10 w-10"
        >
          {audioEnabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Visualizador */}
      <VoiceVisualizer isActive={isRecording || isSpeaking} isSpeaking={isSpeaking} />
      
      {/* Status */}
      <div className="text-sm text-muted-foreground">
        {isProcessing ? 'Processando...' : 
         isSpeaking ? 'Falando...' : 
         isRecording ? 'Ouvindo...' : 
         'Clique para falar'}
      </div>
      
      {/* Controles */}
      <div className="flex items-center gap-3">
        <Button
          variant={isRecording ? 'destructive' : isSpeaking ? 'secondary' : 'default'}
          size="lg"
          onClick={handleVoiceClick}
          disabled={isProcessing}
          className="h-16 w-16 rounded-full"
        >
          {isProcessing ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : isSpeaking ? (
            <Volume2 className="h-8 w-8 animate-pulse" />
          ) : isRecording ? (
            <MicOff className="h-8 w-8" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleAudio}
          className="h-10 w-10"
        >
          {audioEnabled ? (
            <Volume2 className="h-5 w-5" />
          ) : (
            <VolumeX className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
