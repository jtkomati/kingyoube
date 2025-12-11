import kingyoubeLogo from '@/assets/kingyoube-logo.png';
import { Mail, Phone, Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-12 border-t border-border/50 bg-card/30">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Logo & Description */}
          <div>
            <img 
              src={kingyoubeLogo} 
              alt="KingYouBe" 
              className="h-10 w-auto mb-4"
            />
            <p className="text-sm text-muted-foreground">
              O ERP autônomo que executa o back-office para você, 
              potencializado por inteligência artificial.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Contato</h4>
            <ul className="space-y-3">
              <li>
                <a 
                  href="mailto:jeferson.komati@kingyoube.com"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  jeferson.komati@kingyoube.com
                </a>
              </li>
              <li>
                <a 
                  href="tel:+5511999999999"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  +55 11 99999-9999
                </a>
              </li>
              <li>
                <a 
                  href="https://linkedin.com/company/kingyoube"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-3">
              <li>
                <a 
                  href="#"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Termos de Uso
                </a>
              </li>
              <li>
                <a 
                  href="#"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Política de Privacidade
                </a>
              </li>
              <li>
                <a 
                  href="#"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  LGPD
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/50 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} KingYouBe. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
