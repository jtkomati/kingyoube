import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'MICRO',
    description: 'Para MEIs e pequenos negócios',
    priceFrom: 99,
    priceTo: 49,
    highlighted: false,
  },
  {
    name: 'BUSINESS',
    description: 'Para PMEs em crescimento',
    priceFrom: 299,
    priceTo: 149,
    highlighted: true,
  },
  {
    name: 'PRO',
    description: 'Para escritórios contábeis',
    priceFrom: 599,
    priceTo: 299,
    highlighted: false,
  },
  {
    name: 'ENTERPRISE',
    description: 'Para grandes operações',
    priceFrom: null,
    priceTo: null,
    customPrice: 'Sob consulta',
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 relative bg-card/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-4 uppercase tracking-wider text-sm">
            Preços
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Planos que crescem com você
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Escolha o plano ideal para o momento do seu negócio
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
                plan.highlighted
                  ? 'bg-primary/5 border-primary/50 shadow-lg shadow-primary/10'
                  : 'bg-card/50 border-border/50 hover:border-primary/30'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                    Mais Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-foreground mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mb-6">
                {plan.customPrice ? (
                  <span className="text-2xl font-bold text-foreground">{plan.customPrice}</span>
                ) : (
                  <div>
                    <span className="text-sm text-muted-foreground line-through">
                      R$ {plan.priceFrom}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">
                        R$ {plan.priceTo}
                      </span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </div>
                  </div>
                )}
              </div>

              <Button
                className={`w-full ${
                  plan.highlighted
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                Escolher {plan.name}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
