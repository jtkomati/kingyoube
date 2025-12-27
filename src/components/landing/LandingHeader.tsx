import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/auth/AuthModal';
import { LeadCaptureDialog } from '@/components/landing/LeadCaptureDialog';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Play } from 'lucide-react';
import kingyoubeLogo from '@/assets/kingyoube-logo.png';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export function LandingHeader() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLeadCaptureDialog, setShowLeadCaptureDialog] = useState(false);
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

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
            <ThemeToggle />
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleTestDemo}
              className="hidden sm:flex border-primary/50 text-primary hover:bg-primary/10"
            >
              <Play className="w-3 h-3 mr-1" />
              Demo
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowAuthModal(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              Entrar
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
    </>
  );
}
