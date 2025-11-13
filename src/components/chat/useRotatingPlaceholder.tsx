import { useState, useEffect } from 'react';

interface PlaceholderSet {
  finance: string[];
  sales: string[];
  general: string[];
}

const placeholders: PlaceholderSet = {
  finance: [
    "Ver inadimplência > 30 dias",
    "Análise de fluxo de caixa do mês",
    "Mostrar despesas por categoria",
  ],
  sales: [
    "Status do pedido #123",
    "Listar vendas da última semana",
    "Análise de performance de produtos",
  ],
  general: [
    "Resumo financeiro de hoje",
    "Quais são minhas próximas tarefas?",
    "Gerar relatório mensal",
  ],
};

export function useRotatingPlaceholder(role: 'finance' | 'sales' | 'general' = 'general') {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentPlaceholders = placeholders[role];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % currentPlaceholders.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [currentPlaceholders.length]);

  return currentPlaceholders[currentIndex];
}
