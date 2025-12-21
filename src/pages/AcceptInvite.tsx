import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Check, Loader2, XCircle, Building2 } from 'lucide-react';

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepted' | 'error'>('loading');
  const [invitation, setInvitation] = useState<{
    firmName: string | null;
    organizationName: string | null;
    email: string;
  } | null>(null);
  const [processing, setProcessing] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      validateToken();
    } else {
      setStatus('invalid');
    }
  }, [token]);

  const validateToken = async () => {
    try {
      const { data: inv, error } = await supabase
        .from('invitations')
        .select(`
          *,
          company_settings:organization_id (
            company_name
          )
        `)
        .eq('token', token)
        .single();

      if (error || !inv) {
        setStatus('invalid');
        return;
      }

      if (inv.status !== 'pending') {
        setStatus(inv.status === 'accepted' ? 'accepted' : 'invalid');
        return;
      }

      if (new Date(inv.expires_at) < new Date()) {
        setStatus('invalid');
        return;
      }

      setInvitation({
        firmName: inv.firm_name,
        organizationName: (inv.company_settings as any)?.company_name || 'Empresa',
        email: inv.email
      });
      setStatus('valid');
    } catch (error) {
      console.error('Error validating token:', error);
      setStatus('error');
    }
  };

  const acceptInvitation = async () => {
    if (!token) return;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Redirecionar para login com redirect back
        toast({
          title: 'Faça login primeiro',
          description: 'Você precisa estar logado para aceitar o convite'
        });
        navigate(`/?redirect=/accept-invite?token=${token}`);
        return;
      }

      // Chamar função de aceitar convite
      const { data, error } = await supabase.rpc('accept_invitation', {
        p_token: token
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; organization_id?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao aceitar convite');
      }

      toast({
        title: 'Convite aceito!',
        description: 'Você agora tem acesso aos dados da empresa'
      });

      setStatus('accepted');
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Erro ao aceitar convite',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${
            status === 'valid' ? 'bg-primary/10' :
            status === 'accepted' ? 'bg-green-500/10' :
            'bg-red-500/10'
          }`}>
            {status === 'loading' ? (
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            ) : status === 'valid' ? (
              <Building2 className="w-8 h-8 text-primary" />
            ) : status === 'accepted' ? (
              <Check className="w-8 h-8 text-green-500" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500" />
            )}
          </div>
          
          <CardTitle className="text-2xl">
            {status === 'loading' ? 'Validando convite...' :
             status === 'valid' ? 'Convite para Contador' :
             status === 'accepted' ? 'Convite aceito!' :
             'Convite inválido'}
          </CardTitle>
          
          <CardDescription>
            {status === 'loading' ? 'Aguarde enquanto verificamos o convite' :
             status === 'valid' && invitation ? 
               `Você foi convidado para acessar os dados de ${invitation.organizationName}` :
             status === 'accepted' ? 'Você já pode acessar os dados da empresa' :
             'Este convite expirou ou já foi utilizado'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {status === 'valid' && invitation && (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Empresa:</span>
                  <span className="font-medium">{invitation.organizationName}</span>
                </div>
                {invitation.firmName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Escritório:</span>
                    <span>{invitation.firmName}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Seu email:</span>
                  <span>{invitation.email}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button 
                  className="w-full" 
                  onClick={acceptInvitation}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Aceitar Convite
                    </>
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => navigate('/')}
                >
                  Recusar
                </Button>
              </div>
            </>
          )}

          {status === 'accepted' && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Redirecionando para o dashboard...
              </p>
            </div>
          )}

          {(status === 'invalid' || status === 'error') && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground text-center">
                Se você acredita que isto é um erro, peça um novo convite ao administrador da empresa.
              </p>
              <Button variant="outline" onClick={() => navigate('/')}>
                Voltar para o início
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
