import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentButtonProps {
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  isActive?: boolean;
  onClick: () => void;
}

export function AgentButton({ 
  name, 
  description, 
  icon: Icon, 
  color, 
  isActive,
  onClick 
}: AgentButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 group",
        "hover:scale-105 active:scale-95",
        isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <div 
        className={cn(
          "w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center",
          "shadow-lg transition-all duration-300 group-hover:shadow-xl",
          "bg-gradient-to-br",
          color
        )}
      >
        <Icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
      </div>
      <div className="text-center max-w-[100px]">
        <p className="text-xs md:text-sm font-medium text-foreground leading-tight">
          {name}
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight hidden md:block">
          {description}
        </p>
      </div>
    </button>
  );
}
