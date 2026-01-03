import { useState, useRef } from 'react';
import { Send, Mic, MicOff, Loader2, Bot, Volume2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AgentGrid, Agent, agents } from '@/components/agents/AgentGrid';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';
import { ApprovalQueue } from '@/components/agents/ApprovalQueue';
import { AgentWorkflowTrigger } from '@/components/agents/AgentWorkflowTrigger';
import { WorkflowHistory } from '@/components/agents/WorkflowHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agentId?: string;
  toolsUsed?: string[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant-webhook`;
const ORCHESTRATOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-orchestrator`;

export default function AIAgents() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showVoiceMode, setShowVoiceMode] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setMessages([]);
    toast.success(`${agent.name} selecionado`);
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || isLoading) return;

    if (!selectedAgent) {
      toast.error('Selecione um agente primeiro');
      return;
    }

    const userMessage: Message = { 
      role: 'user', 
      content: text,
      agentId: selectedAgent.id 
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Usar orquestrador para Gerente Financeiro
      const isOrchestrator = selectedAgent.id === 'manager';
      const url = isOrchestrator ? ORCHESTRATOR_URL : CHAT_URL;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(isOrchestrator ? {
          message: text,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content }))
        } : { 
          message: text,
          agentId: selectedAgent.id,
          systemPrompt: selectedAgent.systemPrompt,
          n8nWorkflowId: selectedAgent.n8nWorkflowId
        }),
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
        content: data.message || data.response || 'Resposta do assistente',
        agentId: selectedAgent.id,
        toolsUsed: data.toolsUsed
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Mostrar tools usadas pelo orquestrador
      if (data.toolsUsed?.length > 0) {
        toast.success(`Ferramentas usadas: ${data.toolsUsed.join(', ')}`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers para modo de voz
  const handleVoiceTranscript = (text: string) => {
    setInput(text);
  };

  const handleVoiceResponse = (text: string) => {
    if (!selectedAgent) return;
    
    const assistantMessage: Message = { 
      role: 'assistant', 
      content: text,
      agentId: selectedAgent.id
    };
    setMessages(prev => [...prev, assistantMessage]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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

        // Usar Gemini para transcrição
        const { data, error } = await supabase.functions.invoke('gemini-voice-to-text', {
          body: { audio: base64Audio, mimeType: 'audio/webm' },
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

  const getAgentIcon = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.icon || Bot;
  };

  const getAgentColor = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.color || 'from-primary to-primary/80';
  };

  return (
    <DashboardLayout>
      <div className="relative min-h-[calc(100vh-4rem)] flex flex-col overflow-hidden py-6">
        {/* Gradient Background */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-background via-background to-muted" />
        <div className="absolute inset-0 z-0 opacity-30 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.15),transparent_70%)]" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 flex flex-col gap-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Agentes de IA
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              O ERP trabalha para você. Mínima interação, máxima automação.
            </p>
          </div>

          <Tabs defaultValue="workflows" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
              <TabsTrigger value="workflows">Workflows</TabsTrigger>
              <TabsTrigger value="approvals" className="flex items-center gap-1">
                <ClipboardList className="w-4 h-4" />
                Aprovações
              </TabsTrigger>
              <TabsTrigger value="chat">Chat IA</TabsTrigger>
            </TabsList>

            {/* Workflows Tab */}
            <TabsContent value="workflows" className="space-y-6 mt-6">
              <AgentWorkflowTrigger />
              <WorkflowHistory />
            </TabsContent>

            {/* Approvals Tab - Gerente Financeiro */}
            <TabsContent value="approvals" className="mt-6">
              <ApprovalQueue />
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="space-y-6 mt-6">
              {/* Agent Grid */}
              <AgentGrid
                selectedAgent={selectedAgent?.id || null}
                onSelectAgent={handleSelectAgent}
              />

              {/* Selected Agent Indicator */}
              {selectedAgent && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-card/80 backdrop-blur-sm rounded-full border border-border mx-auto w-fit">
                  <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${selectedAgent.color} flex items-center justify-center`}>
                    <selectedAgent.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    Conversando com {selectedAgent.name}
                  </span>
                </div>
              )}

              {/* Messages area */}
              {messages.length > 0 && (
                <div className="w-full max-w-3xl mx-auto max-h-[40vh] overflow-y-auto space-y-4 scrollbar-thin">
                  {messages.map((msg, idx) => {
                    const AgentIcon = msg.agentId ? getAgentIcon(msg.agentId) : Bot;
                    const agentColor = msg.agentId ? getAgentColor(msg.agentId) : 'from-primary to-primary/80';
                    
                    return (
                      <div
                        key={idx}
                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agentColor} flex items-center justify-center flex-shrink-0`}>
                            <AgentIcon className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div
                          className={`p-4 rounded-2xl max-w-[80%] ${
                            msg.role === 'user'
                              ? 'bg-primary/20 text-foreground'
                              : 'bg-card text-foreground backdrop-blur-sm border border-border'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${selectedAgent?.color || 'from-primary to-primary/80'} flex items-center justify-center flex-shrink-0`}>
                        {selectedAgent ? <selectedAgent.icon className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                      </div>
                      <div className="bg-card text-foreground backdrop-blur-sm p-4 rounded-2xl border border-border">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Input */}
              <div className="w-full max-w-3xl mx-auto bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-2">
                <div className="flex items-center gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedAgent 
                      ? `Pergunte ao ${selectedAgent.name}...` 
                      : 'Selecione um agente acima para começar'
                    }
                    disabled={!selectedAgent}
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none border-0 focus:ring-0 focus:outline-none px-3 py-2 min-h-[44px] max-h-32 disabled:opacity-50"
                    rows={1}
                  />
                </div>
                
                <div className="flex items-center justify-end mt-2 px-2 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleVoiceClick}
                    disabled={isProcessingVoice || !selectedAgent}
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
                    disabled={!input.trim() || isLoading || !selectedAgent}
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-9 w-9 p-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
