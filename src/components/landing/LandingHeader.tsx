import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/auth/AuthModal';
import kingyoubeLogo from '@/assets/kingyoube-logo.png';

export function LandingHeader() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
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
              Preços
            </button>
            <button 
              onClick={() => scrollToSection('team')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Time
            </button>
          </div>

          <div className="flex items-center gap-3">
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
              onClick={() => setShowAuthModal(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Cadastrar
            </Button>
          </div>
        </nav>
      </header>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  );
}
