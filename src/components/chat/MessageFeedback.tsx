import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MessageFeedbackProps {
  messageIndex: number;
  messageContent: string;
}

const feedbackTags = [
  "Dados incorretos",
  "Alucinação/Inventou informações",
  "Bug técnico",
  "Resposta incompleta",
  "Não respondeu o que pedi",
];

export function MessageFeedback({ messageIndex, messageContent }: MessageFeedbackProps) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const { toast } = useToast();

  const handleFeedback = async (type: 'up' | 'down') => {
    if (type === 'down') {
      setShowFeedbackDialog(true);
    } else {
      await saveFeedback(type, []);
    }
    setFeedback(type);
  };

  const saveFeedback = async (type: 'up' | 'down', tags: string[]) => {
    try {
      // Salvar no banco de dados para RLHF
      const { error } = await supabase.from('ai_feedback').insert({
        message_index: messageIndex,
        message_content: messageContent,
        feedback_type: type,
        feedback_tags: tags,
      });

      if (error) throw error;

      toast({
        title: 'Feedback enviado',
        description: 'Obrigado! Seu feedback nos ajuda a melhorar.',
      });
    } catch (error) {
      console.error('Erro ao salvar feedback:', error);
    }
  };

  const handleTagSelect = async (tag: string) => {
    await saveFeedback('down', [tag]);
    setShowFeedbackDialog(false);
  };

  return (
    <>
      <div className="flex items-center gap-1 mt-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => handleFeedback('up')}
          disabled={feedback !== null}
        >
          <ThumbsUp className={`h-3 w-3 ${feedback === 'up' ? 'fill-primary text-primary' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => handleFeedback('down')}
          disabled={feedback !== null}
        >
          <ThumbsDown className={`h-3 w-3 ${feedback === 'down' ? 'fill-destructive text-destructive' : ''}`} />
        </Button>
      </div>

      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que deu errado?</DialogTitle>
            <DialogDescription>
              Selecione o que melhor descreve o problema
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {feedbackTags.map((tag) => (
              <Button
                key={tag}
                variant="outline"
                onClick={() => handleTagSelect(tag)}
                className="justify-start"
              >
                {tag}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
