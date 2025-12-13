import { useState, useRef } from 'react';
import { Send, Plus, Mic, MicOff, Loader2, TrendingUp, Receipt, Users, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant-webhook`;

const quickPrompts = [
  { icon: TrendingUp, label: 'Análise de fluxo de caixa', prompt: 'Faça uma análise do meu fluxo de caixa dos últimos 30 dias' },
  { icon: Receipt, label: 'Resumo de transações', prompt: 'Resuma minhas transações recentes e identifique padrões' },
  { icon: Users, label: 'Relatório de clientes', prompt: 'Quais são meus principais clientes por volume de transações?' },
  { icon: BarChart3, label: 'Previsão financeira', prompt: 'Faça uma projeção financeira para os próximos 3 meses' },
];

export default function AIAgents() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      if (response.status === 429) {
        toast.error('Limite de requisições excedido. Tente novamente em alguns segundos.');
        return;
      }

      if (response.status === 402) {
        toast.error('Créditos insuficientes. Adicione créditos à sua conta.');
        return;
      }

      if (!response.ok) {
        throw new Error('Erro ao processar mensagem');
      }

      const data = await response.json();
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.message || data.response || 'Resposta do assistente' 
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    handleSend(prompt);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Gravando... Clique novamente para parar.');
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessingVoice(true);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          throw new Error('Erro ao processar áudio');
        }

        const { data, error } = await supabase.functions.invoke('voice-to-text', {
          body: { audio: base64Audio },
        });

        if (error) throw error;

        if (data?.text) {
          setInput(data.text);
          toast.success('Áudio transcrito! Pressione enviar para continuar.');
        }
      };
    } catch (error) {
      console.error('Erro ao transcrever áudio:', error);
      toast.error('Não foi possível transcrever o áudio');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleVoiceClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <DashboardLayout>
      <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-background via-background to-muted" />
        
        {/* Subtle glow effect */}
        <div className="absolute inset-0 z-0 opacity-30 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.15),transparent_70%)]" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-3xl px-4 flex flex-col items-center">
          {/* Messages area */}
          {messages.length > 0 && (
            <div className="w-full max-h-[50vh] overflow-y-auto mb-8 space-y-4 scrollbar-thin">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl max-w-[80%] ${
                    msg.role === 'user'
                      ? 'ml-auto bg-primary/20 text-foreground'
                      : 'mr-auto bg-card text-foreground backdrop-blur-sm border border-border'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {isLoading && (
                <div className="mr-auto bg-card text-foreground backdrop-blur-sm p-4 rounded-2xl border border-border">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Headline */}
          {messages.length === 0 && (
            <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
              Peça para o Agente de IA
            </h1>
          )}

          {/* Chat Input */}
          <div className="w-full bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-2">
            <div className="flex items-center gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Peça ao Agente de IA para analisar seus dados..."
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none border-0 focus:ring-0 focus:outline-none px-3 py-2 min-h-[44px] max-h-32"
                rows={1}
              />
            </div>
            
            <div className="flex items-center justify-between mt-2 px-2">
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full h-9 w-9 p-0"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {quickPrompts.map((item, idx) => (
                      <DropdownMenuItem
                        key={idx}
                        onClick={() => handleQuickPrompt(item.prompt)}
                        className="cursor-pointer"
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleVoiceClick}
                  disabled={isProcessingVoice}
                  className={`rounded-full h-9 w-9 p-0 ${
                    isRecording 
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {isProcessingVoice ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-9 w-9 p-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
