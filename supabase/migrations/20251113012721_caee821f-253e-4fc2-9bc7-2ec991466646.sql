-- Criar tabela para feedback de AI (RLHF)
CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_index INTEGER NOT NULL,
  message_content TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('up', 'down')),
  feedback_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Habilitar RLS
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - qualquer usuário autenticado pode inserir seu próprio feedback
CREATE POLICY "Users can insert their own feedback"
  ON public.ai_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Políticas RLS - usuários podem ver seu próprio feedback
CREATE POLICY "Users can view their own feedback"
  ON public.ai_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Índice para melhor performance
CREATE INDEX idx_ai_feedback_user_id ON public.ai_feedback(user_id);
CREATE INDEX idx_ai_feedback_created_at ON public.ai_feedback(created_at DESC);