import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';

const comparisons = [
  { traditional: 'Telas complexas e confusas', kingyoube: 'Interface conversacional intuitiva' },
  { traditional: 'Digitação manual de dados', kingyoube: 'IA que processa automaticamente' },
  { traditional: '~1.500 horas/ano perdidas', kingyoube: '70% menos tempo operacional' },
  { traditional: 'Erros humanos frequentes', kingyoube: 'Precisão automatizada' },
  { traditional: 'Relatórios manuais', kingyoube: 'Insights em tempo real' },
];

export function SolutionSection() {
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          comparisons.forEach((_, index) => {
            setTimeout(() => {
              setVisibleItems(prev => [...prev, index]);
            }, index * 200);
          });
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 relative bg-card/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-4 uppercase tracking-wider text-sm">
            A Solução
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            De ERP Tradicional para{' '}
            <span className="text-primary">KingYouBe</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Uma transformação completa na forma de gerenciar seu financeiro
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="grid grid-cols-[1fr,auto,1fr] gap-4 mb-6 px-4">
            <div className="text-center">
              <span className="text-sm font-medium text-muted-foreground">ERP Tradicional</span>
            </div>
            <div className="w-8" />
            <div className="text-center">
              <span className="text-sm font-medium text-primary">KingYouBe</span>
            </div>
          </div>

          {/* Comparison rows */}
          <div className="space-y-3">
            {comparisons.map((item, index) => (
              <div
                key={index}
                className={`grid grid-cols-[1fr,auto,1fr] gap-4 items-center transition-all duration-500 ${
                  visibleItems.includes(index) 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-4'
                }`}
              >
                {/* Traditional side */}
                <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 flex items-center gap-3">
                  <X className="w-5 h-5 text-destructive shrink-0" />
                  <span className="text-sm text-muted-foreground">{item.traditional}</span>
                </div>

                {/* Arrow */}
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-primary" />
                </div>

                {/* KingYouBe side */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm text-foreground">{item.kingyoube}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
