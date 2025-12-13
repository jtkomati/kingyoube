import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Search, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  customer_id: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  budget_hours: number | null;
  hourly_rate: number | null;
  total_hours_logged: number | null;
  total_billed: number | null;
}

export function ProjectsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Project | null>(null);
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('FINANCEIRO');
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_projects')
        .select('*, customers(id, company_name, first_name, last_name)')
        .order('code');
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, first_name, last_name')
        .order('company_name');
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounting_projects')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto excluído');
    },
    onError: () => {
      toast.error('Erro ao excluir');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (item: Partial<Project>) => {
      if (item.id) {
        const { error } = await supabase
          .from('accounting_projects')
          .update(item)
          .eq('id', item.id);
        if (error) throw error;
      } else {
      const { error } = await supabase
          .from('accounting_projects')
          .insert([item as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto salvo');
      setIsDialogOpen(false);
      setSelectedItem(null);
    },
    onError: () => {
      toast.error('Erro ao salvar');
    },
  });

  const filteredItems = items?.filter(
    (item: any) =>
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCustomerName = (item: any) => {
    if (!item.customers) return '-';
    return item.customers.company_name || `${item.customers.first_name} ${item.customers.last_name}`;
  };

  const getStatusBadge = (status: string | null) => {
    const statusColors: Record<string, string> = {
      'ativo': 'bg-green-100 text-green-700',
      'pausado': 'bg-yellow-100 text-yellow-700',
      'concluido': 'bg-blue-100 text-blue-700',
      'cancelado': 'bg-red-100 text-red-700',
    };
    return statusColors[status || 'ativo'] || 'bg-gray-100 text-gray-700';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Projetos</CardTitle>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          {canEdit && (
            <Button onClick={() => { setSelectedItem(null); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Projeto
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Orçamento</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{getCustomerName(item)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs capitalize ${getStatusBadge(item.status)}`}>
                      {item.status || 'Ativo'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.budget_amount 
                      ? item.budget_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {item.total_hours_logged || 0} / {item.budget_hours || '-'}h
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedItem(item); setIsDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={() => { setIsDialogOpen(false); setSelectedItem(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar Projeto' : 'Novo Projeto'}</DialogTitle>
          </DialogHeader>
          <ProjectForm
            item={selectedItem}
            customers={customers || []}
            onSave={(data) => saveMutation.mutate(data)}
            onCancel={() => { setIsDialogOpen(false); setSelectedItem(null); }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface FormProps {
  item: Project | null;
  customers: any[];
  onSave: (data: Partial<Project>) => void;
  onCancel: () => void;
}

function ProjectForm({ item, customers, onSave, onCancel }: FormProps) {
  const [formData, setFormData] = useState<Partial<Project>>(
    item || { code: '', name: '', description: '', is_active: true, status: 'ativo' }
  );

  const handleSubmit = () => {
    if (!formData.code || !formData.name) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    onSave({ ...formData, id: item?.id });
  };

  return (
    <>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Código *</Label>
            <Input
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={formData.status || 'ativo'}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Nome *</Label>
          <Input
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div>
          <Label>Descrição</Label>
          <Input
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
        <div>
          <Label>Cliente</Label>
          <Select
            value={formData.customer_id || 'none'}
            onValueChange={(value) => setFormData({ ...formData, customer_id: value === 'none' ? null : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name || `${c.first_name} ${c.last_name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Data Início</Label>
            <Input
              type="date"
              value={formData.start_date || ''}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Data Fim</Label>
            <Input
              type="date"
              value={formData.end_date || ''}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Orçamento (R$)</Label>
            <Input
              type="number"
              value={formData.budget_amount || ''}
              onChange={(e) => setFormData({ ...formData, budget_amount: parseFloat(e.target.value) || null })}
            />
          </div>
          <div>
            <Label>Horas Orçadas</Label>
            <Input
              type="number"
              value={formData.budget_hours || ''}
              onChange={(e) => setFormData({ ...formData, budget_hours: parseFloat(e.target.value) || null })}
            />
          </div>
          <div>
            <Label>Valor/Hora (R$)</Label>
            <Input
              type="number"
              value={formData.hourly_rate || ''}
              onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || null })}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_active !== false}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label>Ativo</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSubmit}>Salvar</Button>
      </DialogFooter>
    </>
  );
}
