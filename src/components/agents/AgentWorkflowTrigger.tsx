import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Play, 
  Loader2, 
  FileText,
  CreditCard,
  HandCoins,
  Phone,
  Landmark,
  Receipt,
  FileBarChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  icon: typeof FileText;
  color: string;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'date';
    required?: boolean;
    options?: { value: string; label: string }[];
    placeholder?: string;
  }[];
}

const workflows: WorkflowConfig[] = [
  {
    id: 'billing',
    name: 'Faturamento',
    description: 'Emitir NF, boletos e cobranças em lote',
    icon: FileText,
    color: 'from-blue-500 to-blue-600',
    fields: [
      { 
        name: 'action', 
        label: 'Ação', 
        type: 'select', 
        required: true,
        options: [
          { value: 'issue_invoice', label: 'Emitir Nota Fiscal' },
          { value: 'issue_batch', label: 'Emissão em Lote' },
          { value: 'generate_billet', label: 'Gerar Boleto' },
          { value: 'issue_with_billet', label: 'NF + Boleto Automático' },
        ]
      },
      { name: 'customer_name', label: 'Cliente', type: 'text', placeholder: 'Nome do cliente (opcional para lote)' },
      { name: 'amount', label: 'Valor (R$)', type: 'number', placeholder: '0,00' },
    ],
  },
  {
    id: 'receivables',
    name: 'Contas a Receber',
    description: 'Sincronizar extratos, DDA e conciliar',
    icon: HandCoins,
    color: 'from-green-500 to-green-600',
    fields: [
      { 
        name: 'action', 
        label: 'Ação', 
        type: 'select', 
        required: true,
        options: [
          { value: 'sync_statements', label: 'Sincronizar Extratos Bancários' },
          { value: 'reconcile_all', label: 'Conciliar Automaticamente' },
          { value: 'check_dda', label: 'Verificar Boletos DDA' },
          { value: 'review_pending', label: 'Revisar Pendentes' },
          { value: 'check_overdue', label: 'Verificar Vencidos' },
        ]
      },
    ],
  },
  {
    id: 'collection',
    name: 'Cobrança',
    description: 'Identificar inadimplentes e disparar cobranças',
    icon: Phone,
    color: 'from-orange-500 to-orange-600',
    fields: [
      { 
        name: 'aging_filter', 
        label: 'Atraso mínimo', 
        type: 'select', 
        required: true,
        options: [
          { value: '1', label: '1+ dias' },
          { value: '7', label: '7+ dias' },
          { value: '15', label: '15+ dias' },
          { value: '30', label: '30+ dias' },
        ]
      },
      {
        name: 'channel',
        label: 'Canal de cobrança',
        type: 'select',
        options: [
          { value: 'email', label: 'E-mail' },
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'all', label: 'Todos' },
        ]
      },
    ],
  },
  {
    id: 'payables',
    name: 'Contas a Pagar',
    description: 'DDA, pagamentos e remessa CNAB',
    icon: CreditCard,
    color: 'from-red-500 to-red-600',
    fields: [
      { 
        name: 'action', 
        label: 'Ação', 
        type: 'select', 
        required: true,
        options: [
          { value: 'sync_dda', label: 'Sincronizar Boletos DDA' },
          { value: 'process_invoices', label: 'Processar NFs Pendentes' },
          { value: 'schedule_payments', label: 'Agendar Pagamentos' },
          { value: 'generate_remessa', label: 'Gerar Remessa CNAB' },
          { value: 'review_overdue', label: 'Revisar Vencidos' },
        ]
      },
    ],
  },
  {
    id: 'treasury',
    name: 'Tesouraria',
    description: 'Saldos, fluxo de caixa e transferências',
    icon: Landmark,
    color: 'from-purple-500 to-purple-600',
    fields: [
      { 
        name: 'action', 
        label: 'Ação', 
        type: 'select', 
        required: true,
        options: [
          { value: 'sync_balances', label: 'Sincronizar Saldos' },
          { value: 'project_cashflow', label: 'Projetar Fluxo de Caixa' },
          { value: 'schedule_transfer', label: 'Agendar Transferência/PIX' },
          { value: 'check_alerts', label: 'Verificar Alertas' },
        ]
      },
      {
        name: 'projection_days',
        label: 'Dias de projeção',
        type: 'select',
        options: [
          { value: '7', label: '7 dias' },
          { value: '30', label: '30 dias' },
          { value: '90', label: '90 dias' },
        ]
      },
    ],
  },
  {
    id: 'taxes',
    name: 'Tributos',
    description: 'Gerar guias DARF, GPS, GARE e FGTS',
    icon: Receipt,
    color: 'from-amber-500 to-amber-600',
    fields: [
      { 
        name: 'tax_type', 
        label: 'Tipo de Tributo', 
        type: 'select', 
        required: true,
        options: [
          { value: 'darf', label: 'DARF (Federal)' },
          { value: 'gps', label: 'GPS (INSS)' },
          { value: 'gare', label: 'GARE (Estadual)' },
          { value: 'fgts', label: 'FGTS' },
          { value: 'ipva', label: 'IPVA' },
          { value: 'dpvat', label: 'DPVAT' },
        ]
      },
      { name: 'reference_period', label: 'Período (MM/AAAA)', type: 'text', placeholder: '01/2026' },
      { name: 'amount', label: 'Valor (R$)', type: 'number', placeholder: '0,00' },
    ],
  },
  {
    id: 'reports',
    name: 'Relatórios',
    description: 'Gerar relatórios financeiros e gerenciais',
    icon: FileBarChart,
    color: 'from-cyan-500 to-cyan-600',
    fields: [
      { 
        name: 'report_type', 
        label: 'Tipo de Relatório', 
        type: 'select', 
        required: true,
        options: [
          { value: 'cashflow', label: 'Fluxo de Caixa' },
          { value: 'receivables', label: 'Contas a Receber' },
          { value: 'payables', label: 'Contas a Pagar' },
          { value: 'dre', label: 'DRE Gerencial' },
          { value: 'reconciliation', label: 'Conciliação Bancária' },
        ]
      },
      {
        name: 'period',
        label: 'Período',
        type: 'select',
        options: [
          { value: 'current_month', label: 'Mês Atual' },
          { value: 'last_month', label: 'Mês Anterior' },
          { value: 'current_quarter', label: 'Trimestre Atual' },
          { value: 'current_year', label: 'Ano Atual' },
        ]
      },
    ],
  },
];

interface AgentWorkflowTriggerProps {
  className?: string;
}

export function AgentWorkflowTrigger({ className }: AgentWorkflowTriggerProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleTrigger = async () => {
    if (!selectedWorkflow) return;

    // Validate required fields
    const missingFields = selectedWorkflow.fields
      .filter(f => f.required && !formData[f.name])
      .map(f => f.label);

    if (missingFields.length > 0) {
      toast.error(`Campos obrigatórios: ${missingFields.join(', ')}`);
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke(`${selectedWorkflow.id}-agent-workflow`, {
        body: {
          action: 'start_workflow',
          params: formData,
        },
      });

      if (response.error) throw response.error;

      toast.success(
        response.data?.requiresApproval
          ? 'Workflow iniciado - aguardando aprovação do Gerente'
          : 'Workflow executado com sucesso'
      );

      setDialogOpen(false);
      setFormData({});
    } catch (error: any) {
      console.error('Error triggering workflow:', error);
      toast.error('Erro ao iniciar workflow: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderField = (field: WorkflowConfig['fields'][0]) => {
    switch (field.type) {
      case 'select':
        return (
          <Select
            value={formData[field.name] || ''}
            onValueChange={(value) => setFormData(prev => ({ ...prev, [field.name]: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Selecione ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'number':
        return (
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder={field.placeholder}
            value={formData[field.name] || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
          />
        );
      default:
        return (
          <Input
            type={field.type}
            placeholder={field.placeholder}
            value={formData[field.name] || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
          />
        );
    }
  };

  return (
    <Card className={cn("border-border bg-card/50 backdrop-blur-sm", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Play className="h-5 w-5 text-primary" />
          Iniciar Workflow
        </CardTitle>
        <CardDescription>
          Dispare um workflow automatizado com poucos cliques
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <Dialog 
                key={workflow.id} 
                open={dialogOpen && selectedWorkflow?.id === workflow.id}
                onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (open) {
                    setSelectedWorkflow(workflow);
                    setFormData({});
                  }
                }}
              >
                <DialogTrigger asChild>
                  <button
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/50 transition-all group"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center group-hover:scale-110 transition-transform",
                      workflow.color
                    )}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground text-center">
                      {workflow.name}
                    </span>
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center", workflow.color)}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      {workflow.name}
                    </DialogTitle>
                    <DialogDescription>{workflow.description}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {workflow.fields.map((field) => (
                      <div key={field.name} className="space-y-2">
                        <Label htmlFor={field.name}>
                          {field.label}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleTrigger}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Iniciar Workflow
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
