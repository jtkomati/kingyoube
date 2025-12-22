import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordInput } from '@/components/ui/password-input';
import { ConsentCheckboxes } from '@/components/privacy/ConsentCheckboxes';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { signUpSchema, signInSchema, resetPasswordSchema, validateWithFeedback } from '@/lib/validation';
import { getFriendlyError } from '@/lib/errorMessages';
import { checkPasswordBreach, getBreachWarningMessage } from '@/lib/password-breach-check';
import { AlertCircle, ShieldAlert, Loader2 } from 'lucide-react';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [passwordBreachWarning, setPasswordBreachWarning] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const validation = validateWithFeedback(signInSchema, { email, password });
    
    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }
    
    setLoading(true);
    const success = await signIn(validation.data.email, validation.data.password);
    
    // Se o login falhou, pode ser que o usuário não tenha conta
    if (!success) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível entrar',
        description: 'Email ou senha incorretos. Se você ainda não tem conta, clique em "Criar Conta" acima.',
        duration: 6000,
      });
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setPasswordBreachWarning(null);

    // Validate consent checkboxes
    const consentErrors: Record<string, string> = {};
    if (!termsAccepted) {
      consentErrors.terms = 'Você deve aceitar os Termos de Uso';
    }
    if (!privacyAccepted) {
      consentErrors.privacy = 'Você deve aceitar a Política de Privacidade';
    }
    
    const validation = validateWithFeedback(signUpSchema, {
      email,
      password,
      fullName,
      phoneNumber: phoneNumber || undefined,
    });
    
    if (!validation.success || Object.keys(consentErrors).length > 0) {
      setErrors({ ...validation.errors, ...consentErrors });
      toast({
        variant: 'destructive',
        title: 'Dados Inválidos',
        description: 'Por favor, corrija os erros no formulário.',
      });
      return;
    }
    
    // Verificar senha vazada (HaveIBeenPwned)
    setCheckingPassword(true);
    try {
      const breachResult = await checkPasswordBreach(password);
      if (breachResult.breached) {
        const warningMessage = getBreachWarningMessage(breachResult.count);
        setPasswordBreachWarning(warningMessage);
        setCheckingPassword(false);
        toast({
          variant: 'destructive',
          title: 'Senha Comprometida',
          description: 'Esta senha foi encontrada em vazamentos de dados. Por favor, escolha outra.',
          duration: 8000,
        });
        return;
      }
    } catch (err) {
      console.warn('Password breach check failed:', err);
      // Continuar mesmo se a verificação falhar
    }
    setCheckingPassword(false);
    
    setLoading(true);
    const success = await signUp(
      validation.data.email,
      validation.data.password,
      validation.data.fullName,
      validation.data.phoneNumber
    );
    if (success) {
      // Record consents after successful signup
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const consentsToInsert = [
            { user_id: user.id, consent_type: 'terms', consented: true, user_agent: navigator.userAgent },
            { user_id: user.id, consent_type: 'privacy', consented: true, user_agent: navigator.userAgent },
          ];
          if (marketingAccepted) {
            consentsToInsert.push({ user_id: user.id, consent_type: 'marketing', consented: true, user_agent: navigator.userAgent });
          }
          await supabase.from('user_consents').insert(consentsToInsert);
        }
      } catch (err) {
        console.error('Error recording consents:', err);
      }
      
      setEmail('');
      setPassword('');
      setFullName('');
      setPhoneNumber('');
      setTermsAccepted(false);
      setPrivacyAccepted(false);
      setMarketingAccepted(false);
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const validation = validateWithFeedback(resetPasswordSchema, { email: resetEmail });
    
    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }
    
    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        // Verificar especificamente rate limit
        const errorMessage = error.message?.toLowerCase() || '';
        const isRateLimit = 
          errorMessage.includes('security purposes') || 
          errorMessage.includes('rate limit') ||
          errorMessage.includes('over_email_send_rate_limit') ||
          error.status === 429;

        if (isRateLimit) {
          toast({
            title: 'Aguarde um Momento',
            description: 'Por segurança, aguarde alguns segundos antes de solicitar outro e-mail. Se já solicitou, verifique sua caixa de entrada.',
          });
          setResetLoading(false);
          return; // NÃO fechar o modal, não lançar erro
        }
        
        throw error;
      }

      toast({
        title: 'E-mail enviado!',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
      
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      const friendlyError = getFriendlyError(error);
      toast({
        variant: 'destructive',
        title: friendlyError.title,
        description: friendlyError.message,
      });
      // Manter modal aberto para usuário ver o erro
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center text-gradient-primary">
            KingYouBe
          </CardTitle>
          <CardDescription className="text-center">
            Gestão Financeira Inteligente
          </CardDescription>
        </CardHeader>
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar Conta</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <form onSubmit={handleSignIn}>
              <CardContent className="space-y-4">
                <Alert className="border-primary/20 bg-primary/5">
                  <AlertDescription className="text-sm text-muted-foreground">
                    <strong>Já tem uma conta?</strong> Entre com seu email e senha. 
                    <br />
                    <strong>Novo por aqui?</strong> Clique em <strong>"Criar Conta"</strong> acima.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.password}
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
                <Button 
                  type="button" 
                  variant="link" 
                  className="w-full text-sm text-muted-foreground hover:text-primary"
                  onClick={() => {
                    setResetEmail(email);
                    setShowForgotPassword(true);
                  }}
                >
                  Esqueci minha senha
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignUp}>
              <CardContent className="space-y-4">
                <Alert className="border-success/20 bg-success/5">
                  <AlertDescription className="text-sm text-muted-foreground">
                    Crie sua conta gratuita e comece a gerenciar suas finanças agora mesmo!
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="fullname">Nome Completo</Label>
                  <Input
                    id="fullname"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className={errors.fullName ? 'border-destructive' : ''}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.fullName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone (opcional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+55 11 99999-9999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={errors.phoneNumber ? 'border-destructive' : ''}
                  />
                  {errors.phoneNumber && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.phoneNumber}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <PasswordInput
                    id="signup-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    showStrength
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  <div className="text-xs space-y-1 text-muted-foreground">
                    <p className="font-medium">Requisitos de segurança:</p>
                    <ul className="space-y-0.5 ml-4">
                      <li className={password.length >= 8 ? 'text-success' : ''}>
                        • Mínimo 8 caracteres
                      </li>
                      <li className={/[A-Z]/.test(password) ? 'text-success' : ''}>
                        • Pelo menos uma letra maiúscula
                      </li>
                      <li className={/[a-z]/.test(password) ? 'text-success' : ''}>
                        • Pelo menos uma letra minúscula
                      </li>
                      <li className={/[0-9]/.test(password) ? 'text-success' : ''}>
                        • Pelo menos um número
                      </li>
                      <li className={/[^A-Za-z0-9]/.test(password) ? 'text-success' : ''}>
                        • Pelo menos um caractere especial (!@#$%^&*)
                      </li>
                    </ul>
                  </div>
                  {errors.password && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errors.password}</AlertDescription>
                    </Alert>
                  )}
                  {passwordBreachWarning && (
                    <Alert variant="destructive" className="mt-2 border-orange-500 bg-orange-500/10">
                      <ShieldAlert className="h-4 w-4 text-orange-500" />
                      <AlertDescription className="text-orange-700 dark:text-orange-300">
                        {passwordBreachWarning}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                <ConsentCheckboxes
                  termsAccepted={termsAccepted}
                  privacyAccepted={privacyAccepted}
                  marketingAccepted={marketingAccepted}
                  onTermsChange={setTermsAccepted}
                  onPrivacyChange={setPrivacyAccepted}
                  onMarketingChange={setMarketingAccepted}
                  errors={{ terms: errors.terms, privacy: errors.privacy }}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={loading || checkingPassword}>
                  {checkingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando segurança...
                    </>
                  ) : loading ? (
                    'Criando...'
                  ) : (
                    'Criar Conta'
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              Digite seu e-mail para receber um link de recuperação de senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">E-mail</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowForgotPassword(false)}
                disabled={resetLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {resetLoading ? 'Enviando...' : 'Enviar E-mail'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
