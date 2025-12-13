import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Download, Trash2, Eye, AlertTriangle, Loader2, Check, FileJson, Clock } from 'lucide-react';

interface Consent {
  id: string;
  consent_type: string;
  consented: boolean;
  consented_at: string;
  version: string;
}

interface LgpdRequest {
  id: string;
  request_type: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
}

export default function PrivacySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [requests, setRequests] = useState<LgpdRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    if (user) {
      fetchConsents();
      fetchRequests();
    }
  }, [user]);

  const fetchConsents = async () => {
    try {
      const { data, error } = await supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setConsents(data || []);
      
      const marketing = data?.find(c => c.consent_type === 'marketing');
      setMarketingConsent(marketing?.consented || false);
    } catch (error) {
      console.error('Error fetching consents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('lgpd_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const handleMarketingConsentChange = async (checked: boolean) => {
    try {
      const existingConsent = consents.find(c => c.consent_type === 'marketing');
      
      if (existingConsent) {
        const { error } = await supabase
          .from('user_consents')
          .update({
            consented: checked,
            consented_at: new Date().toISOString(),
            revoked_at: checked ? null : new Date().toISOString(),
          })
          .eq('id', existingConsent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_consents')
          .insert({
            user_id: user?.id,
            consent_type: 'marketing',
            consented: checked,
            ip_address: null,
            user_agent: navigator.userAgent,
          });

        if (error) throw error;
      }

      setMarketingConsent(checked);
      toast({
        title: checked ? 'Marketing ativado' : 'Marketing desativado',
        description: checked 
          ? 'Você receberá novidades e comunicações de marketing.'
          : 'Você não receberá mais comunicações de marketing.',
      });
      
      fetchConsents();
    } catch (error) {
      console.error('Error updating consent:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar sua preferência.',
      });
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      // Check for pending export request
      const pendingExport = requests.find(r => r.request_type === 'export' && r.status === 'pending');
      if (pendingExport) {
        toast({
          title: 'Solicitação em andamento',
          description: 'Você já possui uma solicitação de exportação em processamento.',
        });
        return;
      }

      const { error } = await supabase
        .from('lgpd_requests')
        .insert({
          user_id: user?.id,
          request_type: 'export',
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Solicitação enviada',
        description: 'Sua solicitação de exportação foi registrada. Você receberá um email quando seus dados estiverem prontos.',
      });

      fetchRequests();
    } catch (error) {
      console.error('Error requesting export:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível solicitar a exportação.',
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'EXCLUIR') {
      toast({
        variant: 'destructive',
        title: 'Confirmação inválida',
        description: 'Digite EXCLUIR para confirmar.',
      });
      return;
    }

    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('lgpd_requests')
        .insert({
          user_id: user?.id,
          request_type: 'deletion',
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Solicitação enviada',
        description: 'Sua solicitação de exclusão foi registrada. Você receberá um email com mais informações.',
      });

      setShowDeleteDialog(false);
      setDeleteConfirmation('');
      fetchRequests();
    } catch (error) {
      console.error('Error requesting deletion:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível solicitar a exclusão.',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 text-warning"><Clock className="h-3 w-3" /> Pendente</span>;
      case 'processing':
        return <span className="inline-flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" /> Processando</span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1 text-success"><Check className="h-3 w-3" /> Concluído</span>;
      default:
        return <span className="text-muted-foreground">{status}</span>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Configurações de Privacidade</h1>
            <p className="text-muted-foreground">Gerencie seus dados pessoais e preferências de privacidade</p>
          </div>
        </div>

        {/* View Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Meus Dados
            </CardTitle>
            <CardDescription>
              Visualize os dados pessoais armazenados em sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">ID do Usuário</Label>
                <p className="font-medium text-xs font-mono">{user?.id}</p>
              </div>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              Além dos dados acima, armazenamos suas transações financeiras, clientes, fornecedores,
              contratos e outras informações relacionadas ao uso da plataforma.
            </p>
          </CardContent>
        </Card>

        {/* Export Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exportar Meus Dados
            </CardTitle>
            <CardDescription>
              Solicite uma cópia de todos os seus dados pessoais (direito à portabilidade - Art. 18, V da LGPD)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <FileJson className="h-4 w-4" />
              <AlertTitle>Exportação de Dados</AlertTitle>
              <AlertDescription>
                Você receberá um arquivo JSON contendo todos os seus dados pessoais.
                O processamento pode levar até 15 dias conforme previsto na LGPD.
              </AlertDescription>
            </Alert>
            <Button onClick={handleExportData} disabled={exportLoading}>
              {exportLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Solicitar Exportação
            </Button>
          </CardContent>
        </Card>

        {/* Manage Consents */}
        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Consentimentos</CardTitle>
            <CardDescription>
              Controle suas preferências de comunicação e uso de dados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Comunicações de Marketing</Label>
                <p className="text-sm text-muted-foreground">
                  Receba novidades, dicas e ofertas especiais por email
                </p>
              </div>
              <Switch
                checked={marketingConsent}
                onCheckedChange={handleMarketingConsentChange}
              />
            </div>
            <Separator />
            <div className="text-sm text-muted-foreground">
              <p>
                <strong>Nota:</strong> Consentimentos obrigatórios (Termos de Uso e Política de Privacidade)
                não podem ser revogados enquanto sua conta estiver ativa. Para revogar esses consentimentos,
                solicite a exclusão da sua conta.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Excluir Minha Conta
            </CardTitle>
            <CardDescription>
              Solicite a exclusão permanente de sua conta e dados pessoais (direito à eliminação - Art. 18, VI da LGPD)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Esta ação é irreversível</li>
                  <li>Seus dados serão anonimizados ou excluídos permanentemente</li>
                  <li>Dados fiscais serão retidos por 5 anos conforme legislação</li>
                  <li>O processamento pode levar até 15 dias</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive">Solicitar Exclusão</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar Exclusão da Conta</DialogTitle>
                  <DialogDescription>
                    Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos.
                    Digite <strong>EXCLUIR</strong> para confirmar.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Digite EXCLUIR"
                  className="uppercase"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading || deleteConfirmation !== 'EXCLUIR'}
                  >
                    {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Exclusão
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Request History */}
        {requests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Solicitações</CardTitle>
              <CardDescription>
                Acompanhe o status das suas solicitações LGPD
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {request.request_type === 'export' && 'Exportação de Dados'}
                        {request.request_type === 'deletion' && 'Exclusão de Conta'}
                        {request.request_type === 'rectification' && 'Correção de Dados'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Solicitado em {new Date(request.requested_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
