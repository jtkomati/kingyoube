import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/auth/AuthModal';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { LeadCaptureDialog } from '@/components/landing/LeadCaptureDialog';
import { Play, Building2 } from 'lucide-react';
import kingyoubeLogo from '@/assets/kingyoube-logo.png';
import { supabase } from '@/integrations/supabase/client';

export function LandingHeader() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showLeadCaptureDialog, setShowLeadCaptureDialog] = useState(false);
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setShowOnboardingModal(true);
    } else {
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src={kingyoubeLogo} 
              alt="KingYouBe" 
              className="h-10 w-auto"
            />
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => scrollToSection('features')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Funcionalidades
            </button>
            <button 
              onClick={() => scrollToSection('pricing')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Planos
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleTestDemo}
              className="hidden sm:flex border-primary/50 text-primary hover:bg-primary/10"
            >
              <Play className="w-3 h-3 mr-1" />
              Testar Grátis
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowAuthModal(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              Entrar
            </Button>
            <Button 
              size="sm"
              onClick={handleCreateCompany}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Building2 className="w-3 h-3 mr-1" />
              Cadastrar
            </Button>
          </div>
        </nav>
      </header>

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
