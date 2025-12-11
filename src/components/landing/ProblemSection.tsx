import { useEffect, useState, useRef } from 'react';
import { Clock, Monitor, RefreshCw } from 'lucide-react';

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const duration = 2000;
          const increment = target / (duration / 16);
          
          const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 16);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, hasAnimated]);

  return (
    <span ref={ref}>
      {count.toLocaleString('pt-BR')}{suffix}
    </span>
  );
}

const problems = [
  {
    icon: Clock,
    title: '70% do tempo',
    description: 'Gasto em rotina manual repetitiva',
  },
  {
    icon: Monitor,
    title: 'ERPs complexos',
    description: 'Que exigem você servi-los ao invés de ajudar',
  },
  {
    icon: RefreshCw,
    title: 'Retrabalho constante',
    description: 'Erros manuais que custam tempo e dinheiro',
  },
];

export function ProblemSection() {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        {/* Main stat */}
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-4 uppercase tracking-wider text-sm">
            O Problema
          </p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            <AnimatedCounter target={1500} /> horas/ano
          </h2>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            perdidas por PMEs brasileiras em tarefas manuais de back-office
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2">
            Fonte: SEBRAE
          </p>
        </div>

        {/* Problem cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="group relative p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4 group-hover:bg-destructive/20 transition-colors">
                <problem.icon className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {problem.title}
              </h3>
              <p className="text-muted-foreground text-sm">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
