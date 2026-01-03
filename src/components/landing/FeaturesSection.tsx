import { Bot, RefreshCw, BarChart3, Building2, Bell, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      
      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-16">
          <p className="text-primary font-semibold mb-4 uppercase tracking-widest text-sm">
            Funcionalidades
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Tudo que você precisa, potencializado por IA
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg leading-relaxed">
            Uma suíte completa de ferramentas financeiras que trabalham para você
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className={cn(
                "group relative p-6 rounded-2xl",
                "bg-card/50 backdrop-blur-sm",
                "border border-border/50",
                "transition-all duration-500",
                "hover:border-primary/40 hover:-translate-y-2",
                "hover:shadow-xl hover:shadow-primary/10"
              )}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              {/* Gradient background on hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
                style={{
                  boxShadow: 'inset 0 1px 0 0 hsl(var(--primary) / 0.1)'
                }}
              />
              
              <div className="relative">
                {/* Icon with gradient background */}
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-glow transition-all duration-300">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                
                <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                
                <p className="text-muted-foreground leading-relaxed">
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
