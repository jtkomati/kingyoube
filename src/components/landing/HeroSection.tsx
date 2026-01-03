import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/auth/AuthModal';
import { LeadCaptureDialog } from '@/components/landing/LeadCaptureDialog';
import { Play, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function HeroSection() {
  const [mounted, setMounted] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLeadCaptureDialog, setShowLeadCaptureDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTestDemo = () => {
    setShowLeadCaptureDialog(true);
  };

  const handleLeadCaptureSuccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      navigate('/onboarding?demo=true');
    } else {
      sessionStorage.setItem('redirectAfterAuth', '/onboarding?demo=true');
      setShowAuthModal(true);
    }
  };

  return (
    <>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--kingyoube-navy)),hsl(var(--background)))]" />
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* Floating particles with gradient */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: Math.random() * 120 + 40,
                height: Math.random() * 120 + 40,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                background: `radial-gradient(circle, hsl(var(--primary) / ${0.1 + Math.random() * 0.1}), transparent 70%)`,
                animation: `float ${10 + Math.random() * 20}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        {/* Gradient orbs with blur */}
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] bg-primary/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 text-center">
          <div 
            className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            {/* Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm mb-8 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">Em desenvolvimento ativo</span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight tracking-tight text-balance">
              O ERP inteligente que{' '}
              <span className="text-gradient-primary">economiza</span>{' '}
              seu tempo!
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Estamos em desenvolvimento. Nos ajude a criar o ERP que você sempre sonhou.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="xl" 
                variant="glow"
                onClick={handleTestDemo}
                className="text-lg group"
              >
                <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Demo Empresa Modelo
              </Button>
            </div>

            {/* Trust indicators */}
            <div className={`mt-16 flex flex-col items-center gap-4 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <p className="text-sm text-muted-foreground">Tecnologias que utilizamos</p>
              <div className="flex items-center gap-8 opacity-50">
                <span className="text-xs font-medium tracking-wider text-muted-foreground">REACT</span>
                <span className="text-xs font-medium tracking-wider text-muted-foreground">SUPABASE</span>
                <span className="text-xs font-medium tracking-wider text-muted-foreground">AI</span>
                <span className="text-xs font-medium tracking-wider text-muted-foreground">OPEN FINANCE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-muted-foreground/50 rounded-full animate-pulse" />
          </div>
        </div>

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
          }
        `}</style>
      </section>

      <LeadCaptureDialog 
        open={showLeadCaptureDialog} 
        onOpenChange={setShowLeadCaptureDialog}
        onSuccess={handleLeadCaptureSuccess}
      />
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  );
}
