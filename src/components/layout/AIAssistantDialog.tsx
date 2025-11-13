import { useState, useRef } from 'react';
import { Bot, Send, X, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRotatingPlaceholder } from '@/components/chat/useRotatingPlaceholder';
import { QuickPromptChips } from '@/components/chat/QuickPromptChips';
import { MessageFeedback } from '@/components/chat/MessageFeedback';
import { detectAndRenderEntities } from '@/components/chat/SmartCopy';
import { VoiceInput } from '@/components/chat/VoiceInput';

interface ChartData {
  name: string;
  value: number;
  label?: string;
}

interface VariancePeriod {
  period: string;
  value: number;
  variance?: number;
  isAnomaly?: boolean;
  insight?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content?: string;
  type?: 'text' | 'chart' | 'variance';
  chartType?: 'bar' | 'line' | 'area';
  chartTitle?: string;
  chartDescription?: string;
  chartData?: ChartData[];
  varianceTitle?: string;
  variancePeriods?: VariancePeriod[];
  varianceSummary?: string;
  varianceRecommendations?: string[];
}

export function AIAssistantDialog() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const placeholder = useRotatingPlaceholder('general');

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, type: 'text' }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant-webhook', {
        body: { message: userMessage }
      });

      if (error) throw error;

      // Verificar se é um gráfico, análise de variação ou texto
      if (data?.type === 'chart') {
        setMessages(prev => [...prev, { 
          role: 'assistant',
          type: 'chart',
          chartType: data.chartType,
          chartTitle: data.title,
          chartDescription: data.description,
          chartData: data.data
        }]);
      } else if (data?.type === 'variance') {
        setMessages(prev => [...prev, { 
          role: 'assistant',
          type: 'variance',
          varianceTitle: data.title,
          variancePeriods: data.periods,
          varianceSummary: data.summary,
          varianceRecommendations: data.recommendations
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant',
          type: 'text',
          content: data?.response || 'Resposta recebida com sucesso!' 
        }]);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível processar sua mensagem',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const playAudio = async (messageIndex: number, text: string) => {
    try {
      console.log('🎵 Iniciando reprodução de áudio para mensagem:', messageIndex);
      
      // Parar áudio atual se estiver tocando
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setPlayingAudio(messageIndex);

      console.log('🎵 Chamando edge function text-to-speech...');
      
      // Gerar áudio via edge function
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text }
      });

      if (error) {
        console.error('🎵 Erro da edge function:', error);
        throw error;
      }

      if (!data?.audioContent) {
        console.error('🎵 Resposta sem audioContent:', data);
        throw new Error('Resposta da API sem conteúdo de áudio');
      }

      console.log('🎵 Áudio recebido, criando blob...');

      // Criar URL do áudio a partir do base64
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      console.log('🎵 Reproduzindo áudio...');

      // Reproduzir áudio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        console.log('🎵 Áudio finalizado');
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = (e) => {
        console.error('🎵 Erro ao reproduzir áudio:', e);
        setPlayingAudio(null);
        toast({
          title: 'Erro',
          description: 'Não foi possível reproduzir o áudio',
          variant: 'destructive',
        });
      };

      await audio.play();
      console.log('🎵 Áudio iniciado com sucesso');
    } catch (error) {
      console.error('🎵 Erro geral ao reproduzir áudio:', error);
      setPlayingAudio(null);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: 'Erro ao gerar áudio',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingAudio(null);
    }
  };

  return (
    <>
      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => setOpen(true)}
      >
        <Bot className="h-6 w-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl h-[600px] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Assistente de IA
            </DialogTitle>
            <DialogDescription>
              Faça perguntas sobre suas finanças e receba insights personalizados
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Olá! Como posso ajudar você hoje?</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[80%] rounded-lg px-4 py-2 bg-primary text-primary-foreground">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : msg.type === 'chart' ? (
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle>{msg.chartTitle}</CardTitle>
                        <CardDescription>{msg.chartDescription}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          {msg.chartType === 'bar' && (
                            <BarChart data={msg.chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip 
                                formatter={(value: number) => 
                                  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                }
                              />
                              <Bar dataKey="value" fill="hsl(var(--primary))" />
                            </BarChart>
                          )}
                          {msg.chartType === 'line' && (
                            <LineChart data={msg.chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip 
                                formatter={(value: number) => 
                                  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                }
                              />
                              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                            </LineChart>
                          )}
                          {msg.chartType === 'area' && (
                            <AreaChart data={msg.chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip 
                                formatter={(value: number) => 
                                  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                }
                              />
                              <Area type="monotone" dataKey="value" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" />
                            </AreaChart>
                          )}
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  ) : msg.type === 'variance' ? (
                    <Card className="w-full">
                      <CardHeader className="flex flex-row items-start justify-between">
                        <div className="flex-1">
                          <CardTitle>{msg.varianceTitle}</CardTitle>
                          <CardDescription>{msg.varianceSummary}</CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (playingAudio === idx) {
                              stopAudio();
                            } else {
                              const textToSpeak = `${msg.varianceTitle}. ${msg.varianceSummary}`;
                              playAudio(idx, textToSpeak);
                            }
                          }}
                          disabled={isLoading}
                        >
                          {playingAudio === idx ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          {msg.variancePeriods?.map((period, idx) => (
                            <div 
                              key={idx}
                              className={`p-3 rounded-lg border ${
                                period.isAnomaly ? 'border-destructive bg-destructive/10' : 'border-border'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium">{period.period}</span>
                                <span className="text-lg font-bold">
                                  R$ {period.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              {period.variance !== undefined && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className={period.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {period.variance >= 0 ? '↑' : '↓'} {Math.abs(period.variance).toFixed(1)}%
                                  </span>
                                  {period.isAnomaly && (
                                    <span className="text-destructive font-medium">⚠️ Anomalia detectada</span>
                                  )}
                                </div>
                              )}
                              {period.insight && (
                                <p className="text-sm text-muted-foreground mt-2">{period.insight}</p>
                              )}
                            </div>
                          ))}
                        </div>
                        {msg.varianceRecommendations && msg.varianceRecommendations.length > 0 && (
                          <div className="pt-4 border-t">
                            <h4 className="font-semibold mb-2">Recomendações:</h4>
                            <ul className="space-y-1 text-sm">
                              {msg.varianceRecommendations.map((rec, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-primary">•</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                   ) : (
                    <div className="max-w-[80%] space-y-2">
                      <div className="rounded-lg px-4 py-2 bg-secondary flex items-start gap-2">
                        <div className="whitespace-pre-wrap flex-1">
                          {detectAndRenderEntities(msg.content || '')}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={() => {
                            if (playingAudio === idx) {
                              stopAudio();
                            } else {
                              playAudio(idx, msg.content || '');
                            }
                          }}
                          disabled={isLoading}
                        >
                          {playingAudio === idx ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <MessageFeedback messageIndex={idx} messageContent={msg.content || ''} />
                    </div>
                   )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-lg px-4 py-2">
                  <p className="text-muted-foreground">Processando...</p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t space-y-3">
            {messages.length === 0 && (
              <QuickPromptChips 
                onSelect={(prompt) => {
                  setInput(prompt);
                }} 
                role="general"
              />
            )}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                className="min-h-[60px]"
                disabled={isLoading}
              />
              <VoiceInput
                onTranscript={(text) => {
                  setInput(text);
                  // Envia automaticamente após transcrição
                  setTimeout(() => {
                    const userMessage = text.trim();
                    if (!userMessage) return;
                    
                    setMessages(prev => [...prev, { role: 'user', content: userMessage, type: 'text' }]);
                    setInput('');
                    setIsLoading(true);

                    supabase.functions.invoke('ai-assistant-webhook', {
                      body: { message: userMessage }
                    }).then(({ data, error }) => {
                      if (error) throw error;

                      if (data?.type === 'chart') {
                        setMessages(prev => [...prev, { 
                          role: 'assistant',
                          type: 'chart',
                          chartType: data.chartType,
                          chartTitle: data.title,
                          chartDescription: data.description,
                          chartData: data.data
                        }]);
                      } else if (data?.type === 'variance') {
                        setMessages(prev => [...prev, { 
                          role: 'assistant',
                          type: 'variance',
                          varianceTitle: data.title,
                          variancePeriods: data.periods,
                          varianceSummary: data.summary,
                          varianceRecommendations: data.recommendations
                        }]);
                      } else {
                        setMessages(prev => [...prev, { 
                          role: 'assistant',
                          type: 'text',
                          content: data?.response || 'Resposta recebida com sucesso!' 
                        }]);
                      }
                    }).catch((error) => {
                      console.error('Erro ao enviar mensagem:', error);
                      toast({
                        title: 'Erro',
                        description: 'Não foi possível processar sua mensagem',
                        variant: 'destructive',
                      });
                    }).finally(() => {
                      setIsLoading(false);
                    });
                  }, 100);
                }}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-[60px] w-[60px]"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
