import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Sparkles, Phone, Mail, MapPin } from 'lucide-react';

interface Lead {
  id: string;
  company_name: string;
  industry: string;
  region: string;
  address: string;
  phone: string;
  email: string;
  status: string;
  score: number;
  created_at: string;
}

export function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const { toast } = useToast();

  const handleGenerateLeads = async () => {
    if (!industry || !region) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Por favor, selecione o setor e a região.',
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

      const { data, error } = await supabase.functions.invoke('cfo-generate-leads', {
        body: {
          cfoPartnerId: partner.id,
          industry,
          region
        }
      });

      if (error) throw error;

      toast({
        title: 'Leads Gerados!',
        description: `${data.count} novos leads foram adicionados à sua lista.`,
      });

      await fetchLeads();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Falha ao gerar leads',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('partner_prospect_leads')
        .select('*')
        .order('score', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await (supabase as any)
        .from('partner_prospect_leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;
      
      await fetchLeads();
      
      toast({
        title: 'Status Atualizado',
        description: 'O status do lead foi atualizado com sucesso.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao atualizar status',
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      LEAD: 'default',
      CONTACTED: 'secondary',
      CONVERTED: 'default',
      REJECTED: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerador de Leads com IA
          </CardTitle>
          <CardDescription>
            Use IA para encontrar PMEs que são clientes ideais para CFO as a Service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry">Setor</Label>
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

            <div className="space-y-2">
              <Label htmlFor="region">Região</Label>
              <Input
                id="region"
                placeholder="Ex: Osasco, São Paulo"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleGenerateLeads} 
            disabled={loading || !industry || !region}
            className="w-full"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {loading ? 'Gerando Leads...' : 'Gerar 10 Leads Qualificados'}
          </Button>
        </CardContent>
      </Card>

      {leads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Leads Gerados ({leads.length})
            </CardTitle>
            <CardDescription>
              Empresas prospectadas pela IA, ordenadas por score de qualidade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className={`text-2xl font-bold ${getScoreColor(lead.score)}`}>
                          {lead.score}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{lead.company_name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {lead.region}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{lead.industry.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                          </div>
                          <div className="text-sm flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(lead.status)}</TableCell>
                      <TableCell>
                        <Select
                          value={lead.status}
                          onValueChange={(value) => updateLeadStatus(lead.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LEAD">Lead</SelectItem>
                            <SelectItem value="CONTACTED">Contatado</SelectItem>
                            <SelectItem value="CONVERTED">Convertido</SelectItem>
                            <SelectItem value="REJECTED">Rejeitado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}