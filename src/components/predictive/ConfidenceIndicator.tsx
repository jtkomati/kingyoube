import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';

interface ConfidenceIndicatorProps {
  score: number;
  className?: string;
}

export function ConfidenceIndicator({ score, className }: ConfidenceIndicatorProps) {
  const getLevel = () => {
    if (score >= 80) return { label: 'Alta', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', Icon: ShieldCheck };
    if (score >= 60) return { label: 'Média', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', Icon: Shield };
    return { label: 'Baixa', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', Icon: ShieldAlert };
  };

  const { label, color, bgColor, Icon } = getLevel();

  return (
    <div className={cn("flex items-center gap-3 p-4 rounded-lg", bgColor, className)}>
      <Icon className={cn("h-8 w-8", color)} />
      <div>
        <p className="text-sm text-muted-foreground">Confiança da Projeção</p>
        <div className="flex items-center gap-2">
          <span className={cn("text-2xl font-bold", color)}>{score}%</span>
          <span className={cn("text-sm font-medium", color)}>{label}</span>
        </div>
      </div>
      <div className="flex-1 ml-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-500", color.replace('text-', 'bg-'))}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}
