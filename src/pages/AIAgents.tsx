import { useState } from 'react';
import { Send, Plus, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant-webhook`;

export default function AIAgents() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
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
        body: JSON.stringify({ message: input }),
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
                      ? 'ml-auto bg-primary/20 text-white'
                      : 'mr-auto bg-white/10 text-white backdrop-blur-sm'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {isLoading && (
                <div className="mr-auto bg-white/10 text-white backdrop-blur-sm p-4 rounded-2xl">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Headline */}
          {messages.length === 0 && (
            <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Peça para o Agente de IA
            </h1>
          )}

          {/* Chat Input */}
          <div className="w-full bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-white/10 p-2">
            <div className="flex items-center gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Peça ao Agente de IA para analisar seus dados..."
                className="flex-1 bg-transparent text-white placeholder:text-white/50 resize-none border-0 focus:ring-0 focus:outline-none px-3 py-2 min-h-[44px] max-h-32"
                rows={1}
              />
            </div>
            
            <div className="flex items-center justify-between mt-2 px-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-full h-9 w-9 p-0"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-full h-9 w-9 p-0"
                >
                  <Mic className="h-5 w-5" />
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="sm"
                  className="bg-white text-black hover:bg-white/90 rounded-full h-9 w-9 p-0"
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
