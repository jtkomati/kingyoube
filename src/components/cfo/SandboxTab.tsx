import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Target, Sparkles, ExternalLink, Copy, Calendar } from 'lucide-react';

interface Sandbox {
  id: string;
  client_name: string;
  industry: string;
  sandbox_url: string;
  status: string;
  created_at: string;
  expires_at: string;
  demo_data: any;
}

export function SandboxTab() {
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [industry, setIndustry] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchSandboxes();
  }, []);

  const handleCreateSandbox = async () => {
    if (!clientName || !industry) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha o nome do cliente e selecione o setor.',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const { data: partner } = await (supabase as any)
        .from('cfo_partners')
        .select('id')
        .eq('user_id', user.user.id)
        .single();

      if (!partner) throw new Error('Parceiro CFO não encontrado');

      const { data, error } = await supabase.functions.invoke('cfo-create-sandbox', {
        body: {
          cfoPartnerId: partner.id,
          clientName,
          industry
        }
      });

      if (error) throw error;

      toast({
        title: 'Sandbox Criado!',
        description: `Ambiente demo para "${clientName}" está pronto. Link copiado para a área de transferência.`,
      });

      // Copy to clipboard
      navigator.clipboard.writeText(data.sandbox_url);

      setClientName('');
      setIndustry('');
      await fetchSandboxes();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Falha ao criar sandbox',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSandboxes = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('client_sandboxes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSandboxes(data || []);
    } catch (error) {
      console.error('Error fetching sandboxes:', error);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copiado!',
      description: 'O link do sandbox foi copiado para a área de transferência.',
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      ACTIVE: 'default',
      CONVERTED: 'default',
      EXPIRED: 'secondary',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getDaysUntilExpiration = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Criar Demo Sandbox Instantâneo
          </CardTitle>
          <CardDescription>
            Crie um ambiente demo completo com dados fictícios em 1 clique para impressionar prospects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientName">Nome do Prospect</Label>
              <Input
                id="clientName"
                placeholder="Ex: Padaria do Zé"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sandbox-industry">Setor</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurante">Restaurante</SelectItem>
                  <SelectItem value="servicos_ti">Serviços de TI</SelectItem>
                  <SelectItem value="varejo">Varejo</SelectItem>
                  <SelectItem value="saude">Saúde</SelectItem>
                  <SelectItem value="educacao">Educação</SelectItem>
                  <SelectItem value="construcao">Construção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">O que será criado:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✓ Dashboard completo com métricas financeiras realistas</li>
              <li>✓ Transações de exemplo do setor selecionado</li>
              <li>✓ Projeção de fluxo de caixa</li>
              <li>✓ Alertas e insights personalizados</li>
              <li>✓ Link válido por 7 dias</li>
            </ul>
          </div>

          <Button 
            onClick={handleCreateSandbox} 
            disabled={loading || !clientName || !industry}
            className="w-full"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {loading ? 'Criando Sandbox...' : 'Criar Sandbox Demo Agora'}
          </Button>
        </CardContent>
      </Card>

      {sandboxes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sandboxes Criados ({sandboxes.length})</CardTitle>
            <CardDescription>
              Ambientes demo para apresentação aos prospects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sandboxes.map((sandbox) => {
                    const daysLeft = getDaysUntilExpiration(sandbox.expires_at);
                    return (
                      <TableRow key={sandbox.id}>
                        <TableCell className="font-medium">{sandbox.client_name}</TableCell>
                        <TableCell className="capitalize">
                          {sandbox.industry.replace('_', ' ')}
                        </TableCell>
                        <TableCell>{formatDate(sandbox.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span className={daysLeft <= 2 ? 'text-destructive' : ''}>
                              {daysLeft > 0 ? `${daysLeft} dias` : 'Expirado'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(sandbox.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(sandbox.sandbox_url, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(sandbox.sandbox_url)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}