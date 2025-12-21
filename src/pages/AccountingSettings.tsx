import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { 
  Building2, 
  Mail, 
  FileText, 
  UserPlus, 
  Check, 
  Clock, 
  XCircle,
  Shield,
  Send,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email('Email inválido'),
  crc: z.string().min(5, 'CRC deve ter pelo menos 5 caracteres'),
  firmName: z.string().min(2, 'Nome do escritório é obrigatório')
});

interface AccountantInfo {
  email: string | null;
  crc: string | null;
  firmName: string | null;
  linkedAt: string | null;
  userId: string | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  crc: string | null;
  firmName: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
}

const AccountingSettings = () => {
  const { toast } = useToast();
  const { currentOrganization, userRole } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [accountant, setAccountant] = useState<AccountantInfo | null>(null);
  const [pendingInvitation, setPendingInvitation] = useState<PendingInvitation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [crc, setCrc] = useState('');
  const [firmName, setFirmName] = useState('');

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  useEffect(() => {
    if (currentOrganization?.id) {
      loadAccountantData();
    }
  }, [currentOrganization?.id]);

  const loadAccountantData = async () => {
    if (!currentOrganization?.id) return;
    
    setLoading(true);
    try {
      // Buscar dados da empresa
      const { data: company, error: companyError } = await supabase
        .from('company_settings')
        .select('accountant_email, accountant_crc, accountant_firm_name, accountant_linked_at, accountant_user_id')
        .eq('id', currentOrganization.id)
        .single();

      if (companyError) throw companyError;

      setAccountant({
        email: company.accountant_email,
        crc: company.accountant_crc,
        firmName: company.accountant_firm_name,
        linkedAt: company.accountant_linked_at,
        userId: company.accountant_user_id
      });

      // Buscar convites pendentes
      const { data: invitations } = await supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (invitations && invitations.length > 0) {
        setPendingInvitation({
          id: invitations[0].id,
          email: invitations[0].email,
          crc: invitations[0].crc,
          firmName: invitations[0].firm_name,
          status: invitations[0].status,
          createdAt: invitations[0].created_at,
          expiresAt: invitations[0].expires_at
        });
      } else {
        setPendingInvitation(null);
      }
    } catch (error) {
      console.error('Error loading accountant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    try {
      inviteSchema.parse({ email, crc, firmName });
    } catch (err: any) {
      toast({
        title: 'Dados inválidos',
        description: err.errors?.[0]?.message || 'Verifique os campos',
        variant: 'destructive'
      });
      return;
    }

    if (!currentOrganization?.id) {
      toast({
        title: 'Erro',
        description: 'Nenhuma organização selecionada',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Verificar se já existe um contador vinculado
      if (accountant?.userId) {
        toast({
          title: 'Contador já vinculado',
          description: 'Revogue o acesso atual antes de convidar outro contador',
          variant: 'destructive'
        });
        return;
      }

      // Verificar se o email já é um usuário
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (existingProfile) {
        // Usuário existe - vincular diretamente
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: existingProfile.id,
            role: 'CONTADOR'
          });

        if (roleError && !roleError.message.includes('duplicate')) {
          throw roleError;
        }

        const { error: orgError } = await supabase
          .from('user_organizations')
          .insert({
            user_id: existingProfile.id,
            organization_id: currentOrganization.id,
            is_default: false
          });

        if (orgError && !orgError.message.includes('duplicate')) {
          throw orgError;
        }

        // Atualizar company_settings
        await supabase
          .from('company_settings')
          .update({
            accountant_email: email,
            accountant_crc: crc,
            accountant_firm_name: firmName,
            accountant_user_id: existingProfile.id,
            accountant_linked_at: new Date().toISOString()
          })
          .eq('id', currentOrganization.id);

        toast({
          title: 'Contador vinculado!',
          description: 'O contador já tinha cadastro e foi vinculado automaticamente'
        });
      } else {
        // Criar convite
        const { error: inviteError } = await supabase
          .from('invitations')
          .insert({
            organization_id: currentOrganization.id,
            email: email.toLowerCase(),
            role: 'CONTADOR',
            crc,
            firm_name: firmName,
            invited_by: user.id
          });

        if (inviteError) throw inviteError;

        toast({
          title: 'Convite enviado!',
          description: 'O contador receberá um email para acessar o sistema'
        });
      }

      setDialogOpen(false);
      setEmail('');
      setCrc('');
      setFirmName('');
      loadAccountantData();
    } catch (error: any) {
      console.error('Error inviting accountant:', error);
      toast({
        title: 'Erro ao convidar',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!currentOrganization?.id || !accountant?.userId) return;

    setSubmitting(true);
    try {
      // Remover vínculo da organização
      await supabase
        .from('user_organizations')
        .delete()
        .eq('user_id', accountant.userId)
        .eq('organization_id', currentOrganization.id);

      // Limpar dados do contador na empresa
      await supabase
        .from('company_settings')
        .update({
          accountant_email: null,
          accountant_crc: null,
          accountant_firm_name: null,
          accountant_user_id: null,
          accountant_linked_at: null
        })
        .eq('id', currentOrganization.id);

      toast({
        title: 'Acesso revogado',
        description: 'O contador não tem mais acesso a esta empresa'
      });

      loadAccountantData();
    } catch (error: any) {
      console.error('Error revoking access:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível revogar o acesso',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelInvitation = async () => {
    if (!pendingInvitation?.id) return;

    try {
      await supabase
        .from('invitations')
        .update({ status: 'revoked' })
        .eq('id', pendingInvitation.id);

      toast({
        title: 'Convite cancelado',
        description: 'O convite foi revogado com sucesso'
      });

      loadAccountantData();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
    }
  };

  const getStatusInfo = () => {
    if (accountant?.userId) {
      return {
        status: 'linked',
        badge: <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">🟢 Vinculado</Badge>,
        icon: <Check className="w-5 h-5 text-green-500" />
      };
    }
    if (pendingInvitation) {
      return {
        status: 'pending',
        badge: <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">🟡 Pendente</Badge>,
        icon: <Clock className="w-5 h-5 text-yellow-500" />
      };
    }
    return {
      status: 'none',
      badge: <Badge variant="outline" className="text-muted-foreground">⚪ Não configurado</Badge>,
      icon: <XCircle className="w-5 h-5 text-muted-foreground" />
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Configurações de Contabilidade</h1>
          <p className="text-muted-foreground">Gerencie o acesso do seu contador ao sistema</p>
        </div>

        {!isAdmin && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Apenas administradores podem gerenciar configurações de contabilidade.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Sua Contabilidade</CardTitle>
                <CardDescription>Status do vínculo com escritório contábil</CardDescription>
              </div>
            </div>
            {statusInfo.badge}
          </CardHeader>

          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : statusInfo.status === 'linked' ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-sm">Escritório</Label>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{accountant?.firmName || 'Não informado'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-sm">Email</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{accountant?.email}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-sm">CRC</Label>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono">{accountant?.crc || 'Não informado'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-sm">Vinculado em</Label>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-muted-foreground" />
                      <span>{accountant?.linkedAt ? new Date(accountant.linkedAt).toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={handleRevoke} disabled={submitting}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Revogar Acesso
                    </Button>
                  </div>
                )}
              </>
            ) : statusInfo.status === 'pending' ? (
              <>
                <Alert className="border-yellow-500/30 bg-yellow-500/10">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                    Aguardando o contador aceitar o convite. O link expira em{' '}
                    {pendingInvitation && new Date(pendingInvitation.expiresAt).toLocaleDateString('pt-BR')}.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-sm">Email convidado</Label>
                    <span>{pendingInvitation?.email}</span>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-sm">Escritório</Label>
                    <span>{pendingInvitation?.firmName || 'Não informado'}</span>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={cancelInvitation}>
                      Cancelar Convite
                    </Button>
                    <Button variant="outline" onClick={() => {
                      // Reenviar convite (criar novo)
                      if (pendingInvitation) {
                        setEmail(pendingInvitation.email);
                        setCrc(pendingInvitation.crc || '');
                        setFirmName(pendingInvitation.firmName || '');
                        setDialogOpen(true);
                      }
                    }}>
                      <Send className="w-4 h-4 mr-2" />
                      Reenviar
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                    <Shield className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">Nenhum contador vinculado</h3>
                    <p className="text-sm text-muted-foreground">
                      Convide seu contador para ter acesso aos dados financeiros
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex justify-center">
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Convidar Contador
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Convidar Contador</DialogTitle>
                          <DialogDescription>
                            O contador terá acesso de leitura aos dados financeiros desta empresa.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="firmName">Nome do Escritório *</Label>
                            <Input
                              id="firmName"
                              placeholder="Escritório de Contabilidade Oliveira"
                              value={firmName}
                              onChange={(e) => setFirmName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email do Contador *</Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="contador@escritorio.com.br"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="crc">Número do CRC *</Label>
                            <Input
                              id="crc"
                              placeholder="SP-123456/O"
                              value={crc}
                              onChange={(e) => setCrc(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Registro no Conselho Regional de Contabilidade
                            </p>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleInvite} disabled={submitting}>
                            {submitting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4 mr-2" />
                                Enviar Convite
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Por que vincular seu contador?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <h4 className="font-medium">Rastreabilidade Fiscal</h4>
              <p className="text-sm text-muted-foreground">
                O CRC é usado automaticamente em documentos fiscais como SPED e Notas Fiscais.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-500" />
              </div>
              <h4 className="font-medium">Acesso Seguro</h4>
              <p className="text-sm text-muted-foreground">
                O contador tem apenas permissão de leitura, sem poder alterar ou excluir dados.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-500" />
              </div>
              <h4 className="font-medium">Gestão Integrada</h4>
              <p className="text-sm text-muted-foreground">
                Seu contador acessa o Cockpit do CFO para monitorar todos os clientes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AccountingSettings;
