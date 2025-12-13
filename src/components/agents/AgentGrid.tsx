import { 
  FileText, 
  HandCoins, 
  Phone, 
  CreditCard, 
  Landmark, 
  Users, 
  TrendingUp 
} from 'lucide-react';
import { AgentButton } from './AgentButton';

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon: typeof FileText;
  color: string;
  n8nWorkflowId?: string;
  systemPrompt: string;
}

export const agents: Agent[] = [
  {
    id: 'billing',
    name: 'Faturamento',
    description: 'Emissão de NFs',
    icon: FileText,
    color: 'from-blue-500 to-blue-600',
    n8nWorkflowId: 'billing-workflow',
    systemPrompt: 'Você é o Agente de Faturamento. Ajude com emissão de notas fiscais, consultas de faturamento e relatórios de vendas.'
  },
  {
    id: 'receivables',
    name: 'Contas a Receber',
    description: 'Recebimentos',
    icon: HandCoins,
    color: 'from-green-500 to-green-600',
    n8nWorkflowId: 'receivables-workflow',
    systemPrompt: 'Você é o Agente de Contas a Receber. Ajude com gestão de recebíveis, aging de clientes e análise de inadimplência.'
  },
  {
    id: 'collection',
    name: 'Cobrança',
    description: 'Inadimplência',
    icon: Phone,
    color: 'from-orange-500 to-orange-600',
    n8nWorkflowId: 'collection-workflow',
    systemPrompt: 'Você é o Agente de Cobrança. Ajude com estratégias de cobrança, negociação de dívidas e recuperação de crédito.'
  },
  {
    id: 'payables',
    name: 'Contas a Pagar',
    description: 'Pagamentos',
    icon: CreditCard,
    color: 'from-red-500 to-red-600',
    n8nWorkflowId: 'payables-workflow',
    systemPrompt: 'Você é o Agente de Contas a Pagar. Ajude com gestão de pagamentos, vencimentos e fluxo de despesas.'
  },
  {
    id: 'treasury',
    name: 'Tesouraria',
    description: 'Caixa e bancos',
    icon: Landmark,
    color: 'from-purple-500 to-purple-600',
    n8nWorkflowId: 'treasury-workflow',
    systemPrompt: 'Você é o Agente de Tesouraria. Ajude com gestão de caixa, conciliação bancária e posição de liquidez.'
  },
  {
    id: 'manager',
    name: 'Gerente Financeiro',
    description: 'Orquestrador',
    icon: Users,
    color: 'from-indigo-500 to-indigo-600',
    n8nWorkflowId: 'manager-workflow',
    systemPrompt: 'Você é o Gerente Financeiro, o orquestrador de todos os agentes. Coordene tarefas entre agentes e forneça visão consolidada das operações financeiras.'
  },
  {
    id: 'cfo',
    name: 'CFO',
    description: 'Planejamento',
    icon: TrendingUp,
    color: 'from-primary to-primary/80',
    n8nWorkflowId: 'cfo-workflow',
    systemPrompt: 'Você é o Agente CFO. Ajude com planejamento financeiro estratégico, análise de cenários, projeções e decisões de investimento.'
  },
];

interface AgentGridProps {
  selectedAgent: string | null;
  onSelectAgent: (agent: Agent) => void;
}

export function AgentGrid({ selectedAgent, onSelectAgent }: AgentGridProps) {
  return (
    <div className="grid grid-cols-4 md:grid-cols-7 gap-2 md:gap-4 w-full max-w-4xl">
      {agents.map((agent) => (
        <AgentButton
          key={agent.id}
          name={agent.name}
          description={agent.description}
          icon={agent.icon}
          color={agent.color}
          isActive={selectedAgent === agent.id}
          onClick={() => onSelectAgent(agent)}
        />
      ))}
    </div>
  );
}
