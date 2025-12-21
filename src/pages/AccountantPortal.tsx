import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Building2,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';

interface ClientDashboardData {
  client_company_id: string;
  client_name: string;
  cfo_partner_id: string;
  total_transactions: number;
  total_receivables: number;
  total_payables: number;
  net_balance: number;
  pending_transactions: number;
  overdue_transactions: number;
  last_transaction_date: string | null;
  health_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

interface AggregatedMetrics {
  totalClients: number;
  totalReceivables: number;
  totalPayables: number;
  totalNetBalance: number;
  criticalClients: number;
  warningClients: number;
  healthyClients: number;
  totalOverdue: number;
}

export default function AccountantPortal() {
  const [clients, setClients] = useState<ClientDashboardData[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientDashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [metrics, setMetrics] = useState<AggregatedMetrics>({
    totalClients: 0,
    totalReceivables: 0,
    totalPayables: 0,
    totalNetBalance: 0,
    criticalClients: 0,
    warningClients: 0,
    healthyClients: 0,
    totalOverdue: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const filtered = clients.filter(client => 
      client.client_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredClients(filtered);
  }, [searchTerm, clients]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast({
          variant: 'destructive',
          title: 'Erro de autenticação',
          description: 'Faça login para acessar o portal.',
        });
        return;
      }

      // Verificar se é SUPERADMIN
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.user.id)
        .single();

      const isSuperAdmin = userRole?.role === 'SUPERADMIN';

      let partnerId = null;

      if (!isSuperAdmin) {
        // Buscar parceiro CFO apenas se não for SUPERADMIN
        const { data: partner } = await (supabase as any)
          .from('cfo_partners')
          .select('id')
          .eq('user_id', user.user.id)
          .single();

        if (!partner) {
          toast({
            variant: 'destructive',
            title: 'Acesso negado',
            description: 'Você não está registrado como parceiro CFO.',
          });
          return;
        }
        partnerId = partner.id;
      }

      // SUPERADMIN vê todos os dados, parceiro CFO vê apenas seus clientes
      let query = (supabase as any).from('accountant_client_dashboard').select('*');
      
      if (partnerId) {
        query = query.eq('cfo_partner_id', partnerId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const dashboardData: ClientDashboardData[] = data || [];
      setClients(dashboardData);
      setFilteredClients(dashboardData);

      // Calculate aggregated metrics
      const aggregated: AggregatedMetrics = {
        totalClients: dashboardData.length,
        totalReceivables: dashboardData.reduce((sum, c) => sum + (c.total_receivables || 0), 0),
        totalPayables: dashboardData.reduce((sum, c) => sum + (c.total_payables || 0), 0),
        totalNetBalance: dashboardData.reduce((sum, c) => sum + (c.net_balance || 0), 0),
        criticalClients: dashboardData.filter(c => c.health_status === 'CRITICAL').length,
        warningClients: dashboardData.filter(c => c.health_status === 'WARNING').length,
        healthyClients: dashboardData.filter(c => c.health_status === 'HEALTHY').length,
        totalOverdue: dashboardData.reduce((sum, c) => sum + (c.overdue_transactions || 0), 0)
      };
      setMetrics(aggregated);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: error.message || 'Tente novamente mais tarde.',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sem movimentação';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getHealthStatusBadge = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Crítico
          </Badge>
        );
      case 'WARNING':
        return (
          <Badge variant="outline" className="gap-1 border-warning text-warning">
            <Clock className="h-3 w-3" />
            Atenção
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 border-success text-success">
            <CheckCircle2 className="h-3 w-3" />
            Saudável
          </Badge>
        );
    }
  };

  const getBalanceIndicator = (balance: number) => {
    if (balance > 0) {
      return <ArrowUpRight className="h-4 w-4 text-success" />;
    } else if (balance < 0) {
      return <ArrowDownRight className="h-4 w-4 text-destructive" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-4xl font-bold text-gradient-primary">
                  Portal do Contador
                </h1>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Visão consolidada da saúde financeira de todos os seus clientes com indicadores em tempo real.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-muted-foreground mt-2">
                Dashboard agregado de clientes
              </p>
            </div>
            <Button 
              onClick={fetchDashboardData} 
              disabled={loading}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden group hover:shadow-glow transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalClients}</div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs text-success">{metrics.healthyClients} saudáveis</span>
                  <span className="text-xs text-warning">{metrics.warningClients} atenção</span>
                  <span className="text-xs text-destructive">{metrics.criticalClients} críticos</span>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-glow transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-success/10 to-transparent opacity-50" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {formatCurrency(metrics.totalReceivables)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Soma de todos os clientes
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-glow transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent opacity-50" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(metrics.totalPayables)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Soma de todos os clientes
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-glow transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Líquido</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metrics.totalNetBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(metrics.totalNetBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.totalOverdue} transações em atraso
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Status Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-success/30 bg-success/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Clientes Saudáveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{metrics.healthyClients}</div>
                <p className="text-xs text-muted-foreground">Sem pendências críticas</p>
              </CardContent>
            </Card>

            <Card className="border-warning/30 bg-warning/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  Requer Atenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning">{metrics.warningClients}</div>
                <p className="text-xs text-muted-foreground">Transações pendentes ou próximas do vencimento</p>
              </CardContent>
            </Card>

            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Situação Crítica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{metrics.criticalClients}</div>
                <p className="text-xs text-muted-foreground">Transações em atraso significativo</p>
              </CardContent>
            </Card>
          </div>

          {/* Clients Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Visão por Cliente
                  </CardTitle>
                  <CardDescription>
                    Detalhamento financeiro de cada empresa
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum cliente encontrado</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">A Receber</TableHead>
                        <TableHead className="text-right">A Pagar</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="text-center">Transações</TableHead>
                        <TableHead className="text-center">Pendentes</TableHead>
                        <TableHead className="text-center">Em Atraso</TableHead>
                        <TableHead>Última Movimentação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClients.map((client) => (
                        <TableRow key={client.client_company_id} className="hover:bg-muted/50">
                          <TableCell>
                            {getHealthStatusBadge(client.health_status)}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{client.client_name}</div>
                          </TableCell>
                          <TableCell className="text-right text-success font-medium">
                            {formatCurrency(client.total_receivables)}
                          </TableCell>
                          <TableCell className="text-right text-destructive font-medium">
                            {formatCurrency(client.total_payables)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {getBalanceIndicator(client.net_balance)}
                              <span className={client.net_balance >= 0 ? 'text-success' : 'text-destructive'}>
                                {formatCurrency(client.net_balance)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{client.total_transactions}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {client.pending_transactions > 0 ? (
                              <Badge variant="outline" className="border-warning text-warning">
                                {client.pending_transactions}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {client.overdue_transactions > 0 ? (
                              <Badge variant="destructive">
                                {client.overdue_transactions}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(client.last_transaction_date)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
