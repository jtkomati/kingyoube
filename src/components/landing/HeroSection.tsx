import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/auth/AuthModal';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { LeadCaptureDialog } from '@/components/landing/LeadCaptureDialog';
import { Play, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function HeroSection() {
  const [mounted, setMounted] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showLeadCaptureDialog, setShowLeadCaptureDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTestDemo = () => {
    // Abrir formulário de captura de lead
    setShowLeadCaptureDialog(true);
  };

  const handleLeadCaptureSuccess = async () => {
    // Após captura, verificar se já está logado para ir direto ao onboarding
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      navigate('/onboarding?demo=true');
    } else {
      // Salvar intenção de demo e abrir modal de auth
      sessionStorage.setItem('redirectAfterAuth', '/onboarding?demo=true');
      setShowAuthModal(true);
    }
  };

  const handleCreateCompany = async () => {
    // Verificar se já está logado
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setShowOnboardingModal(true);
    } else {
      // Após login, abrir o modal de onboarding
      sessionStorage.setItem('openOnboardingAfterAuth', 'true');
      setShowAuthModal(true);
    }
  };

  // Verificar se deve abrir onboarding após auth
  useEffect(() => {
    const handleAuthSuccess = () => {
      if (sessionStorage.getItem('openOnboardingAfterAuth') === 'true') {
        sessionStorage.removeItem('openOnboardingAfterAuth');
        setShowOnboardingModal(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setTimeout(handleAuthSuccess, 500);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Animated background */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--kingyoube-navy)),hsl(var(--background)))]" />
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-primary/10"
              style={{
                width: Math.random() * 100 + 50,
                height: Math.random() * 100 + 50,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${10 + Math.random() * 20}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        {/* Gradient orbs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 text-center">
          <div 
            className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              O ERP inteligente que{' '}
              <span className="text-primary">economiza</span>{' '}
              seu tempo!
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Da operação manual para agentes de IA que fazem o financeiro.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={handleTestDemo}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8 py-6"
              >
                <Play className="w-5 h-5 mr-2" />
                Testar Grátis
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={handleCreateCompany}
                className="text-lg px-8 py-6 border-primary/50 hover:bg-primary/10"
              >
                <Building2 className="w-5 h-5 mr-2" />
                Criar Minha Empresa
              </Button>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/50 flex items-start justify-center p-2">
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
      <OnboardingModal open={showOnboardingModal} onOpenChange={setShowOnboardingModal} />
    </>
  );
}
