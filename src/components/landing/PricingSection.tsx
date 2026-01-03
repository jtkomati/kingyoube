import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const plans = [
  {
    name: 'MICRO',
    description: 'Para MEIs e pequenos negócios',
    highlighted: false,
    features: ['1 empresa', 'Até 100 transações/mês', 'Suporte por email'],
  },
  {
    name: 'BUSINESS',
    description: 'Para PMEs em crescimento',
    highlighted: true,
    features: ['3 empresas', 'Transações ilimitadas', 'Suporte prioritário', 'API access'],
  },
  {
    name: 'PRO',
    description: 'Para escritórios contábeis',
    highlighted: false,
    features: ['10 empresas', 'Multi-usuário', 'Relatórios avançados', 'Integração contábil'],
  },
  {
    name: 'ENTERPRISE',
    description: 'Para grandes operações',
    highlighted: false,
    features: ['Empresas ilimitadas', 'SLA dedicado', 'Customização', 'On-premise option'],
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden bg-gradient-to-b from-background via-card/30 to-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-16">
          <p className="text-primary font-semibold mb-4 uppercase tracking-widest text-sm">
            Planos
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Planos que crescem com você
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg leading-relaxed">
            Escolha o plano ideal para o momento do seu negócio
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={cn(
                "relative p-6 rounded-2xl transition-all duration-500",
                "border backdrop-blur-sm",
                plan.highlighted
                  ? "bg-gradient-to-b from-primary/10 to-primary/5 border-primary/50 shadow-xl shadow-primary/10 scale-105 z-10"
                  : "bg-card/50 border-border/50 hover:border-primary/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-full shadow-glow">
                    Mais Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className={cn(
                  "text-xl font-bold mb-2",
                  plan.highlighted ? "text-primary" : "text-foreground"
                )}>
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center",
                      plan.highlighted ? "bg-primary/20" : "bg-muted"
                    )}>
                      <Check className={cn(
                        "w-3 h-3",
                        plan.highlighted ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                className={cn(
                  "w-full py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300",
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {plan.highlighted ? "Começar agora" : "Saiba mais"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
