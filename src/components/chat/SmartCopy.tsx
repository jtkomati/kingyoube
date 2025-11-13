import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface SmartCopyProps {
  text: string;
  label?: string;
}

export function SmartCopy({ text, label }: SmartCopyProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        description: `${label || 'Texto'} copiado!`,
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 flex-shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

// Detectar e renderizar entidades com botão de copiar
export function detectAndRenderEntities(text: string) {
  const patterns = {
    cnpj: /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g,
    cpf: /\d{3}\.\d{3}\.\d{3}-\d{2}/g,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /\(\d{2}\)\s?\d{4,5}-?\d{4}/g,
    pixKey: /[a-zA-Z0-9]{32}/g,
  };

  let result: JSX.Element[] = [];
  let lastIndex = 0;
  const matches: Array<{ start: number; end: number; text: string; type: string }> = [];

  // Encontrar todas as correspondências
  Object.entries(patterns).forEach(([type, pattern]) => {
    const matches_temp = Array.from(text.matchAll(pattern));
    matches_temp.forEach((match) => {
      if (match.index !== undefined) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          type,
        });
      }
    });
  });

  // Ordenar por posição
  matches.sort((a, b) => a.start - b.start);

  // Renderizar texto com entidades
  matches.forEach((match, idx) => {
    if (match.start > lastIndex) {
      result.push(
        <span key={`text-${idx}`}>{text.slice(lastIndex, match.start)}</span>
      );
    }
    result.push(
      <span key={`entity-${idx}`} className="inline-flex items-center gap-1">
        <code className="bg-muted px-1 py-0.5 rounded text-xs">{match.text}</code>
        <SmartCopy text={match.text} label={match.type.toUpperCase()} />
      </span>
    );
    lastIndex = match.end;
  });

  if (lastIndex < text.length) {
    result.push(<span key="text-end">{text.slice(lastIndex)}</span>);
  }

  return result.length > 0 ? result : [<span key="full-text">{text}</span>];
}
