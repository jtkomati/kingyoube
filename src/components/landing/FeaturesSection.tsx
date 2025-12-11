import { Bot, RefreshCw, BarChart3, Building2, Bell, Receipt } from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'IA Assistente',
    description: 'Converse naturalmente com seu ERP. Pergunte, comande e receba insights instantâneos.',
  },
  {
    icon: RefreshCw,
    title: 'Conciliação Automática',
    description: 'Sincronização bancária inteligente com categorização automática de transações.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios Inteligentes',
    description: 'Dashboards em tempo real com projeções de fluxo de caixa e análises preditivas.',
  },
  {
    icon: Building2,
    title: 'Multi-empresa',
    description: 'Gerencie múltiplas empresas em uma única plataforma unificada.',
  },
  {
    icon: Bell,
    title: 'Alertas Proativos',
    description: 'Notificações inteligentes sobre vencimentos, anomalias e oportunidades.',
  },
  {
    icon: Receipt,
    title: 'Fiscal Automatizado',
    description: 'Emissão de NFS-e, cálculo de impostos e preparação para a Reforma Tributária.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-4 uppercase tracking-wider text-sm">
            Funcionalidades
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Tudo que você precisa, potencializado por IA
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Uma suíte completa de ferramentas financeiras que trabalham para você
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
