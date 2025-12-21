import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  CreditCard,
  Receipt,
  Settings,
  Bot,
  TrendingUp,
  Link,
  Calculator,
  Search,
  Sparkles,
} from "lucide-react";

interface NavigationItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

const navigationItems: NavigationItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "início", "painel"] },
  { title: "Transações", href: "/transactions", icon: FileText, keywords: ["lançamentos", "receitas", "despesas"] },
  { title: "Clientes", href: "/customers", icon: Users, keywords: ["cliente", "customer"] },
  { title: "Fornecedores", href: "/suppliers", icon: Building2, keywords: ["fornecedor", "supplier"] },
  { title: "Notas Fiscais", href: "/invoices", icon: Receipt, keywords: ["nfse", "nota fiscal", "invoice"] },
  { title: "Integrações Bancárias", href: "/bank-integrations", icon: Link, keywords: ["banco", "open finance", "extrato"] },
  { title: "Agentes AI", href: "/ai-agents", icon: Bot, keywords: ["ia", "inteligência artificial", "automação"] },
  { title: "Analytics Preditivo", href: "/predictive-analytics", icon: TrendingUp, keywords: ["previsão", "forecast"] },
  { title: "Reforma Tributária", href: "/reforma-tributaria", icon: Calculator, keywords: ["iva", "ibs", "cbs", "imposto"] },
  { title: "Cadastros", href: "/cadastros", icon: Settings, keywords: ["plano de contas", "centro de custo"] },
  { title: "CFO Cockpit", href: "/cfo-cockpit", icon: CreditCard, keywords: ["cfo", "parceiro"] },
  { title: "Relatórios", href: "/reports", icon: FileText, keywords: ["report", "relatório"] },
];

const quickActions = [
  { title: "Nova Transação", action: "new-transaction", keywords: ["criar", "adicionar", "lançamento"] },
  { title: "Novo Cliente", action: "new-customer", keywords: ["criar", "adicionar"] },
  { title: "Novo Fornecedor", action: "new-supplier", keywords: ["criar", "adicionar"] },
  { title: "Calcular Impostos", action: "calculate-taxes", keywords: ["tributação", "simular"] },
];

export function GlobalCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleNavigation = React.useCallback(
    (href: string) => {
      navigate(href);
      setOpen(false);
    },
    [navigate]
  );

  const handleAction = React.useCallback(
    (action: string) => {
      switch (action) {
        case "new-transaction":
          navigate("/transactions");
          // The page will handle opening the dialog
          break;
        case "new-customer":
          navigate("/customers");
          break;
        case "new-supplier":
          navigate("/suppliers");
          break;
        case "calculate-taxes":
          navigate("/reforma-tributaria");
          break;
      }
      setOpen(false);
    },
    [navigate]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas, ações ou comandos AI..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        
        <CommandGroup heading="Navegação">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.href}
              value={`${item.title} ${item.keywords?.join(" ") || ""}`}
              onSelect={() => handleNavigation(item.href)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações Rápidas">
          {quickActions.map((action) => (
            <CommandItem
              key={action.action}
              value={`${action.title} ${action.keywords?.join(" ") || ""}`}
              onSelect={() => handleAction(action.action)}
            >
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              <span>{action.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Dica">
          <CommandItem disabled>
            <Search className="mr-2 h-4 w-4" />
            <span className="text-muted-foreground text-sm">
              Pressione ⌘K ou Ctrl+K para abrir a busca global
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
