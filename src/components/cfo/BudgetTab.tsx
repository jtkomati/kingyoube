import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, Target, Plus, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface Budget {
  id: string;
  account_name: string;
  account_category: string;
  month: string;
  target_amount: number;
  notes: string;
  company_settings: {
    company_name: string;
  };
}

interface Variance {
  budget_id: string;
  account_name: string;
  target_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_percent: number;
  variance_status: string;
  severity: string;
}

export function BudgetTab() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedVariance, setSelectedVariance] = useState<Variance | null>(null);
  
  // Form state
  const [selectedClient, setSelectedClient] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountCategory, setAccountCategory] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [targetAmount, setTargetAmount] = useState('');
  const [notes, setNotes] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    fetchBudgets();
    fetchClients();
  }, []);

  const fetchBudgets = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('budget_targets')
        .select('*, company_settings(company_name)')
        .order('month', { ascending: false })
        .order('account_name');

      if (error) throw error;
      setBudgets(data || []);
    } catch (error) {
      console.error('Error fetching budgets:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: partner } = await (supabase as any)
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

  const handleCreateBudget = async () => {
    if (!selectedClient || !accountName || !accountCategory || !targetAmount) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
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

      const { data, error } = await supabase.functions.invoke('cfo-set-budget', {
        body: {
          cfoPartnerId: partner.id,
          clientCompanyId: selectedClient,
          accountName,
          accountCategory,
          month: `${month}-01`,
          targetAmount: parseFloat(targetAmount),
          notes
        }
      });

      if (error) throw error;

      toast({
        title: 'Meta de Orçamento Definida!',
        description: `Meta de ${formatCurrency(parseFloat(targetAmount))} definida para ${accountName}.`,
      });

      // Reset form
      setSelectedClient('');
      setAccountName('');
      setAccountCategory('');
      setTargetAmount('');
      setNotes('');
      setShowDialog(false);

      await fetchBudgets();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Falha ao definir orçamento',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVariance = async (budget: Budget) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cfo-budget-variance', {
        body: {
          clientCompanyId: budget.company_settings ? selectedClient : budget.id.split('-')[0],
          accountName: budget.account_name,
          month: budget.month
        }
      });

      if (error) throw error;
      setSelectedVariance(data);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Falha ao calcular variance',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'WARNING': return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'INFO': return <Info className="h-5 w-5 text-primary" />;
      default: return <CheckCircle2 className="h-5 w-5 text-success" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: any = {
      CRITICAL: 'destructive',
      WARNING: 'default',
      INFO: 'secondary',
      OK: 'default',
    };
    return <Badge variant={variants[severity]}>{severity}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Gestão de Orçamentos (FP&A)
              </CardTitle>
              <CardDescription>
                Defina metas orçamentárias e monitore desvios automaticamente
              </CardDescription>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Meta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Definir Meta de Orçamento</DialogTitle>
                  <DialogDescription>
                    Configure uma meta orçamentária para um cliente e conta específica
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client">Cliente</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.client_id} value={client.client_id}>
                            {client.client_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountName">Nome da Conta</Label>
                    <Input
                      id="accountName"
                      placeholder="Ex: Marketing Digital"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select value={accountCategory} onValueChange={setAccountCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARKETING">Marketing</SelectItem>
                        <SelectItem value="PESSOAL">Pessoal</SelectItem>
                        <SelectItem value="TECNOLOGIA">Tecnologia</SelectItem>
                        <SelectItem value="FIXOS">Custos Fixos</SelectItem>
                        <SelectItem value="VARIAVEIS">Custos Variáveis</SelectItem>
                        <SelectItem value="VENDAS">Vendas</SelectItem>
                        <SelectItem value="SERVICOS">Serviços</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="month">Mês</Label>
                    <Input
                      id="month"
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetAmount">Meta (Valor)</Label>
                    <Input
                      id="targetAmount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações (opcional)</Label>
                    <Input
                      id="notes"
                      placeholder="Notas sobre esta meta..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <Button 
                    onClick={handleCreateBudget} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Salvando...' : 'Definir Meta'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {budgets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Metas Orçamentárias ({budgets.length})</CardTitle>
            <CardDescription>
              Orçamentos configurados com análise de desvio disponível
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((budget) => (
                    <TableRow key={budget.id}>
                      <TableCell>{budget.company_settings?.company_name || 'N/A'}</TableCell>
                      <TableCell className="font-medium">{budget.account_name}</TableCell>
                      <TableCell className="capitalize">
                        {budget.account_category.toLowerCase()}
                      </TableCell>
                      <TableCell>{formatMonth(budget.month)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(budget.target_amount)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCheckVariance(budget)}
                          disabled={loading}
                        >
                          Ver Desvio
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variance Analysis Dialog */}
      <Dialog open={!!selectedVariance} onOpenChange={() => setSelectedVariance(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedVariance && getSeverityIcon(selectedVariance.severity)}
              Análise de Desvio Orçamentário
            </DialogTitle>
            <DialogDescription>
              {selectedVariance?.account_name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedVariance && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Meta (Budget)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(selectedVariance.target_amount)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Realizado (Actual)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(selectedVariance.actual_amount)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className={
                selectedVariance.severity === 'CRITICAL' ? 'border-destructive bg-destructive/5' :
                selectedVariance.severity === 'WARNING' ? 'border-warning bg-warning/5' :
                selectedVariance.severity === 'INFO' ? 'border-primary bg-primary/5' :
                'border-success bg-success/5'
              }>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {selectedVariance.variance_status === 'OVER_BUDGET' ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    Desvio (Variance)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Valor:</span>
                      <span className="text-lg font-bold">
                        {selectedVariance.variance_amount >= 0 ? '+' : ''}
                        {formatCurrency(selectedVariance.variance_amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Percentual:</span>
                      <span className="text-lg font-bold">
                        {selectedVariance.variance_percent >= 0 ? '+' : ''}
                        {selectedVariance.variance_percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Severidade:</span>
                      {getSeverityBadge(selectedVariance.severity)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}