import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LeadsTab } from '@/components/cfo/LeadsTab';
import { SandboxTab } from '@/components/cfo/SandboxTab';
import { BudgetTab } from '@/components/cfo/BudgetTab';
import { ConfigTab } from '@/components/cfo/ConfigTab';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Building2, 
  FileText, 
  RefreshCw, 
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Sparkles,
  BarChart3,
  Settings,
  HelpCircle
} from 'lucide-react';

interface Alert {
  id: string;
  client_name: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  is_read: boolean;
  resolved: boolean;
  created_at: string;
  metadata?: any;
}

interface Client {
  client_id: string;
  client_name: string;
  primary_contact: string;
}

interface ClientVitals {
  cash_balance: number;
  ar_overdue_30d: number;
  ap_due_7d: number;
  cash_projection_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  min_projected_balance?: number;
  days_to_negative?: number;
}

interface ROIDashboard {
  total_hours_saved: number;
  reports_generated: number;
  critical_alerts_viewed: number;
  manual_tasks_avoided: number;
  total_value_generated: number;
  this_month_hours_saved: number;
  this_month_value: number;
  hourly_rate: number;
}

// Dados fictícios
const mockAlerts: Alert[] = [
  {
    id: '1',
    client_name: 'Tech Solutions LTDA',
    message: 'Fluxo de caixa crítico: Previsão negativa em 5 dias',
    severity: 'CRITICAL',
    is_read: false,
    resolved: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    metadata: { days_to_negative: 5, projected_balance: -15000 }
  },
  {
    id: '2',
    client_name: 'Varejo Moderno S.A.',
    message: 'Contas a receber vencidas excedem 30% do AR total',
    severity: 'CRITICAL',
    is_read: false,
    resolved: false,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    metadata: { overdue_percentage: 32, overdue_amount: 85000 }
  },
  {
    id: '3',
    client_name: 'Indústria Brasil Forte',
    message: 'Alto volume de transações não categorizadas (45 itens)',
    severity: 'WARNING',
    is_read: false,
    resolved: false,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    metadata: { uncategorized_count: 45 }
  },
  {
    id: '4',
    client_name: 'Consultoria Premium',
    message: 'Despesas operacionais 15% acima do orçamento',
    severity: 'WARNING',
    is_read: true,
    resolved: false,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    metadata: { variance_percent: 15, budget: 50000, actual: 57500 }
  },
  {
    id: '5',
    client_name: 'E-commerce Express',
    message: 'Nova oportunidade de otimização fiscal identificada',
    severity: 'INFO',
    is_read: false,
    resolved: false,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    metadata: { estimated_savings: 12000 }
  }
];

const mockClients: Client[] = [
  { client_id: 'c1', client_name: 'Tech Solutions LTDA', primary_contact: 'João Silva - joao@techsolutions.com' },
  { client_id: 'c2', client_name: 'Varejo Moderno S.A.', primary_contact: 'Maria Santos - maria@varejomoderno.com.br' },
  { client_id: 'c3', client_name: 'Indústria Brasil Forte', primary_contact: 'Pedro Costa - pedro@brasilforte.ind.br' },
  { client_id: 'c4', client_name: 'Consultoria Premium', primary_contact: 'Ana Paula - ana@consultoriapremium.com' },
  { client_id: 'c5', client_name: 'E-commerce Express', primary_contact: 'Carlos Mendes - carlos@ecomexpress.com.br' },
  { client_id: 'c6', client_name: 'Logística Total', primary_contact: 'Fernanda Lima - contato@logisticatotal.com.br' }
];

const mockROI: ROIDashboard = {
  total_hours_saved: 284.5,
  reports_generated: 47,
  critical_alerts_viewed: 23,
  manual_tasks_avoided: 156,
  total_value_generated: 85350,
  this_month_hours_saved: 52.3,
  this_month_value: 15690,
  hourly_rate: 300
};

export default function CFOCockpit() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientVitals, setClientVitals] = useState<ClientVitals | null>(null);
  const [roiDashboard, setRoiDashboard] = useState<ROIDashboard | null>(mockROI);
  const [loading, setLoading] = useState(false);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [alertToResolve, setAlertToResolve] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    
    // Setup realtime para novos alertas
    const channel = supabase
      .channel('cfo-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cfo_alerts'
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchAlerts(), fetchClients(), fetchROIDashboard()]);
    setLoading(false);
  };

  const fetchAlerts = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Buscar o ID do parceiro CFO
      const { data: partner } = await supabase
        .from('cfo_partners')
        .select('id')
        .eq('user_id', user.user.id)
        .single();

      if (!partner) {
        console.log('User is not a CFO partner');
        return;
      }

      const { data, error } = await supabase
        .from('cfo_alerts')
        .select('*')
        .eq('cfo_partner_id', partner.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts((data || []).map(alert => ({
        ...alert,
        severity: alert.severity as 'CRITICAL' | 'WARNING' | 'INFO'
      })));
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: partner } = await supabase
        .from('cfo_partners')
        .select('id')
        .eq('user_id', user.user.id)
        .single();

      if (!partner) return;

      const { data, error } = await supabase.functions.invoke('cfo-get-partner-clients', {
        body: { cfo_partner_id: partner.id }
      });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchROIDashboard = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: partner } = await supabase
        .from('cfo_partners')
        .select('id')
        .eq('user_id', user.user.id)
        .single();

      if (!partner) return;

      const { data, error } = await supabase.functions.invoke('cfo-get-roi-dashboard', {
        body: { cfoPartnerId: partner.id }
      });

      if (error) throw error;
      setRoiDashboard(data);
    } catch (error) {
      console.error('Error fetching ROI dashboard:', error);
    }
  };

  const handleRunMonitor = async () => {
    setMonitorLoading(true);
    try {
      const { error } = await supabase.functions.invoke('cfo-proactive-monitor');
      
      if (error) throw error;

      toast({
        title: 'Monitoramento Executado',
        description: 'Análise proativa concluída. Novos alertas foram gerados.',
      });

      await fetchAlerts();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Falha ao executar monitoramento',
      });
    } finally {
      setMonitorLoading(false);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('cfo_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;
      await fetchAlerts();
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('cfo_alerts')
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString(),
          resolved_by: user.user?.id 
        })
        .eq('id', alertId);

      if (error) throw error;
      await fetchAlerts();
      
      toast({
        title: 'Alerta Resolvido',
        description: 'O alerta foi marcado como resolvido com sucesso.',
      });
      
      setAlertToResolve(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao resolver alerta. Tente novamente.',
      });
    }
  };

  const handleViewClient = async (client: Client) => {
    setSelectedClient(client);
    
    // Dados fictícios de vitals do cliente
    const mockVitals: ClientVitals = {
      cash_balance: Math.random() > 0.5 ? 150000 + Math.random() * 300000 : 50000 + Math.random() * 100000,
      ar_overdue_30d: Math.random() * 150000,
      ap_due_7d: Math.random() * 80000,
      cash_projection_status: Math.random() > 0.7 ? 'CRITICAL' : Math.random() > 0.4 ? 'WARNING' : 'HEALTHY',
      min_projected_balance: Math.random() > 0.5 ? -10000 - Math.random() * 50000 : 20000 + Math.random() * 100000,
      days_to_negative: Math.random() > 0.5 ? Math.floor(Math.random() * 15) : undefined
    };
    
    setClientVitals(mockVitals);
  };

  const handleGenerateReport = async () => {
    if (!selectedClient) return;

    setReportLoading(true);
    
    // Simular delay de geração
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockReport = `
# RELATÓRIO EXECUTIVO - ${selectedClient.client_name}
**Período:** Últimos 30 dias

## 📊 Resumo Financeiro
- **Receita Total:** R$ ${formatNumber(450000 + Math.random() * 200000)}
- **Despesas Totais:** R$ ${formatNumber(320000 + Math.random() * 150000)}
- **Resultado Operacional:** R$ ${formatNumber(130000 + Math.random() * 50000)}

## 💰 Fluxo de Caixa
- **Saldo Inicial:** R$ ${formatNumber(250000 + Math.random() * 100000)}
- **Entradas:** R$ ${formatNumber(420000 + Math.random() * 180000)}
- **Saídas:** R$ ${formatNumber(380000 + Math.random() * 150000)}
- **Saldo Final:** R$ ${formatNumber(290000 + Math.random() * 120000)}

## 🎯 Indicadores-Chave
- **Margem Operacional:** ${(25 + Math.random() * 10).toFixed(1)}%
- **Liquidez Corrente:** ${(1.5 + Math.random() * 0.8).toFixed(2)}
- **Ciclo Financeiro:** ${Math.floor(45 + Math.random() * 30)} dias

## ⚠️ Alertas e Recomendações
1. **Contas a Receber:** Acompanhar de perto ${Math.floor(8 + Math.random() * 15)} faturas com vencimento próximo
2. **Otimização Fiscal:** Oportunidade identificada de economia de ~R$ ${formatNumber(12000 + Math.random() * 18000)}
3. **Gestão de Estoque:** Revisar política para reduzir capital imobilizado

## 📈 Projeções
Baseado nas tendências atuais, projetamos um crescimento de **${(12 + Math.random() * 8).toFixed(1)}%** no próximo trimestre.

---
*Relatório gerado automaticamente pelo FAS.AI em ${new Date().toLocaleDateString('pt-BR')}*
    `.trim();
    
    setGeneratedReport(mockReport);
    setShowReport(true);
    setReportLoading(false);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'WARNING': return <AlertCircle className="h-5 w-5 text-warning" />;
      default: return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: any = {
      CRITICAL: 'destructive',
      WARNING: 'default',
      INFO: 'secondary',
    };
    return <Badge variant={variants[severity]}>{severity}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CRITICAL': return <TrendingDown className="h-6 w-6 text-destructive" />;
      case 'WARNING': return <AlertCircle className="h-6 w-6 text-warning" />;
      default: return <TrendingUp className="h-6 w-6 text-success" />;
    }
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const unreadCritical = alerts.filter(a => !a.is_read && a.severity === 'CRITICAL').length;
  const unreadWarnings = alerts.filter(a => !a.is_read && a.severity === 'WARNING').length;
  const unresolvedAlerts = alerts.filter(a => !a.resolved);

  return (
    <DashboardLayout>
      <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-bold text-gradient-primary">
                Cockpit Multi-Empresa
              </h1>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Painel centralizado para monitorar a saúde financeira de todos os seus clientes em tempo real.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-muted-foreground mt-2">
              Painel proativo de monitoramento de clientes
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleRunMonitor} 
                disabled={monitorLoading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${monitorLoading ? 'animate-spin' : ''}`} />
                {monitorLoading ? 'Analisando...' : 'Executar Análise'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Executa uma análise proativa de todos os clientes para detectar problemas financeiros</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ROI Dashboard Widget - Resposta ao Kevin */}
        {roiDashboard && (
          <Card className="border-success/50 bg-gradient-to-r from-success/5 to-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-success" />
                Valor Gerado pelo FAS.AI
              </CardTitle>
              <CardDescription>
                Este mês, o FAS.AI já economizou {roiDashboard.this_month_hours_saved.toFixed(1)} horas do seu tempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Tempo Total Economizado</div>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-success" />
                    {roiDashboard.total_hours_saved.toFixed(1)}h
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Valor Gerado</div>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-success" />
                    {formatNumber(roiDashboard.total_value_generated)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Relatórios IA</div>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    {roiDashboard.reports_generated}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Alertas Monitorados</div>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    {roiDashboard.critical_alerts_viewed}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumo de Alertas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-destructive/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas Críticos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{unreadCritical}</div>
              <p className="text-xs text-muted-foreground">Requerem atenção imediata</p>
            </CardContent>
          </Card>

          <Card className="border-warning/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avisos</CardTitle>
              <AlertCircle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{unreadWarnings}</div>
              <p className="text-xs text-muted-foreground">Para monitoramento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{clients.length}</div>
              <p className="text-xs text-muted-foreground">Empresas sob gestão</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alerts">
              Alertas ({unresolvedAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="clients">
              Clientes ({clients.length})
            </TabsTrigger>
            <TabsTrigger value="budget">
              <BarChart3 className="h-4 w-4 mr-2" />
              FP&A / Orçamento
            </TabsTrigger>
            <TabsTrigger value="leads">
              <Users className="h-4 w-4 mr-2" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="sandbox">
              <Target className="h-4 w-4 mr-2" />
              Demo Sandbox
            </TabsTrigger>
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 mr-2" />
              Configuração
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Carregando alertas...</div>
            ) : unresolvedAlerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-16 w-16 text-success mb-4" />
                  <p className="text-lg font-medium">Nenhum alerta pendente</p>
                  <p className="text-sm text-muted-foreground">
                    Todos os clientes estão em situação saudável
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {unresolvedAlerts.map((alert) => (
                  <Card 
                    key={alert.id} 
                    className={`${!alert.is_read ? 'border-l-4' : ''} ${
                      alert.severity === 'CRITICAL' ? 'border-l-destructive' :
                      alert.severity === 'WARNING' ? 'border-l-warning' : 'border-l-primary'
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {getSeverityIcon(alert.severity)}
                          <div>
                            <CardTitle className="text-base">{alert.client_name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              {getSeverityBadge(alert.severity)}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(alert.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!alert.is_read && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleMarkAsRead(alert.id)}
                            >
                              Marcar Lido
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setAlertToResolve(alert.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Resolver
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{alert.message}</p>
                      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <div className="mt-3 p-3 bg-muted rounded-lg text-xs space-y-1">
                          {alert.metadata.days_to_negative && (
                            <div>Dias até saldo negativo: <strong>{alert.metadata.days_to_negative}</strong></div>
                          )}
                          {alert.metadata.uncategorized_count && (
                            <div>Transações pendentes: <strong>{alert.metadata.uncategorized_count}</strong></div>
                          )}
                          {alert.metadata.percentage && (
                            <div>Percentual: <strong>{alert.metadata.percentage.toFixed(1)}%</strong></div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="clients" className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Carregando clientes...</div>
            ) : clients.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Nenhum cliente cadastrado</p>
                  <p className="text-sm text-muted-foreground">
                    Vincule clientes ao seu perfil de parceiro CFO
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clients.map((client) => (
                  <Card 
                    key={client.client_id}
                    className="cursor-pointer hover:shadow-lg transition-all"
                    onClick={() => handleViewClient(client)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {client.client_name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {client.primary_contact}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewClient(client);
                          }}
                        >
                          Ver Detalhes
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewClient(client);
                            handleGenerateReport();
                          }}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Relatório
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab de Budget FP&A - Vence a ROQT */}
          <TabsContent value="budget">
            <BudgetTab />
          </TabsContent>

          {/* Tab de Leads - Resposta à Barbara */}
          <TabsContent value="leads">
            <LeadsTab />
          </TabsContent>

          {/* Tab de Sandbox - Resposta à Lori */}
          <TabsContent value="sandbox">
            <SandboxTab />
          </TabsContent>

          {/* Tab de Configuração - Resposta ao Alan */}
          <TabsContent value="config">
            <ConfigTab />
          </TabsContent>
        </Tabs>

        {/* Dialog de Detalhes do Cliente */}
        <Dialog open={!!selectedClient && !showReport} onOpenChange={(open) => !open && setSelectedClient(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {selectedClient?.client_name}
              </DialogTitle>
              <DialogDescription>
                Sinais vitais financeiros
              </DialogDescription>
            </DialogHeader>
            
            {clientVitals && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Saldo de Caixa</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${clientVitals.cash_balance >= 0 ? '' : 'text-destructive'}`}>
                        {formatNumber(clientVitals.cash_balance)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Status Projeção</CardTitle>
                      {getStatusIcon(clientVitals.cash_projection_status)}
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {clientVitals.cash_projection_status}
                      </div>
                      {clientVitals.days_to_negative !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {clientVitals.days_to_negative} dias até negativo
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Recebíveis Vencidos</CardTitle>
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${clientVitals.ar_overdue_30d > 0 ? 'text-warning' : ''}`}>
                        {formatNumber(clientVitals.ar_overdue_30d)}
                      </div>
                      <p className="text-xs text-muted-foreground">Vencidos +30 dias</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${clientVitals.ap_due_7d > clientVitals.cash_balance ? 'text-destructive' : ''}`}>
                        {formatNumber(clientVitals.ap_due_7d)}
                      </div>
                      <p className="text-xs text-muted-foreground">Próximos 7 dias</p>
                    </CardContent>
                  </Card>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedClient(null)}>
                    Fechar
                  </Button>
                  <Button onClick={handleGenerateReport} disabled={reportLoading}>
                    {reportLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Gerar Relatório Executivo
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Relatório Executivo */}
        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatório Executivo - {selectedClient?.client_name}
              </DialogTitle>
              <DialogDescription>
                Gerado com IA - Últimos 30 dias
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-[500px] pr-4">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {generatedReport}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReport(false)}>
                Fechar
              </Button>
              <Button onClick={() => {
                navigator.clipboard.writeText(generatedReport);
                toast({
                  title: 'Copiado!',
                  description: 'Relatório copiado para a área de transferência',
                });
              }}>
                Copiar Relatório
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog for Resolving Alerts */}
        <ConfirmationDialog
          open={!!alertToResolve}
          onOpenChange={(open) => !open && setAlertToResolve(null)}
          title="Confirmar Resolução de Alerta"
          description="Tem certeza que deseja marcar este alerta como resolvido? Esta ação não pode ser desfeita."
          onConfirm={() => alertToResolve && handleResolveAlert(alertToResolve)}
          confirmText="Sim, Resolver"
          cancelText="Cancelar"
          variant="default"
        />
      </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
