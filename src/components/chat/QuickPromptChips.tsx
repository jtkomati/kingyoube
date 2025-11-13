import { Button } from '@/components/ui/button';

interface QuickPromptChipsProps {
  onSelect: (prompt: string) => void;
  role?: 'finance' | 'sales' | 'general';
}

const prompts = {
  finance: [
    "📊 Dashboard financeiro",
    "💰 Fluxo de caixa",
    "📈 Receitas vs Despesas",
    "⚠️ Contas atrasadas",
  ],
  sales: [
    "🛍️ Vendas do mês",
    "👥 Principais clientes",
    "📦 Status de pedidos",
    "💳 Vendas pendentes",
  ],
  general: [
    "📊 Resumo geral",
    "📈 Métricas principais",
    "📝 Relatórios",
    "🔔 Notificações",
  ],
};

export function QuickPromptChips({ onSelect, role = 'general' }: QuickPromptChipsProps) {
  const currentPrompts = prompts[role];

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {currentPrompts.map((prompt, idx) => (
        <Button
          key={idx}
          variant="outline"
          size="sm"
          onClick={() => onSelect(prompt)}
          className="text-xs h-7 px-3 hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}
