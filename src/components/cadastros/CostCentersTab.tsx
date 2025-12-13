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
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface CostCenter {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  parent_cost_center_id: string | null;
}

export function CostCentersTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CostCenter | null>(null);
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('FINANCEIRO');
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['cost-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_cost_centers')
        .select('*')
        .order('code');
      if (error) throw error;
      return data as CostCenter[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounting_cost_centers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success('Centro de custo excluído');
    },
    onError: () => {
      toast.error('Erro ao excluir');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (item: Partial<CostCenter>) => {
      if (item.id) {
        const { error } = await supabase
          .from('accounting_cost_centers')
          .update(item)
          .eq('id', item.id);
        if (error) throw error;
      } else {
      const { error } = await supabase
          .from('accounting_cost_centers')
          .insert([item as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success('Centro de custo salvo');
      setIsDialogOpen(false);
      setSelectedItem(null);
    },
    onError: () => {
      toast.error('Erro ao salvar');
    },
  });

  const filteredItems = items?.filter(
    (item) =>
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Centros de Custos</CardTitle>
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
              Novo Centro
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
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.description || '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.is_active ? 'Ativo' : 'Inativo'}
                    </span>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}</DialogTitle>
          </DialogHeader>
          <CostCenterForm
            item={selectedItem}
            items={items || []}
            onSave={(data) => saveMutation.mutate(data)}
            onCancel={() => { setIsDialogOpen(false); setSelectedItem(null); }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface FormProps {
  item: CostCenter | null;
  items: CostCenter[];
  onSave: (data: Partial<CostCenter>) => void;
  onCancel: () => void;
}

function CostCenterForm({ item, items, onSave, onCancel }: FormProps) {
  const [formData, setFormData] = useState<Partial<CostCenter>>(
    item || { code: '', name: '', description: '', is_active: true }
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
        <div>
          <Label>Código *</Label>
          <Input
            value={formData.code || ''}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          />
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
          <Label>Centro Pai</Label>
          <Select
            value={formData.parent_cost_center_id || 'none'}
            onValueChange={(value) => setFormData({ ...formData, parent_cost_center_id: value === 'none' ? null : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {items.filter(i => i.id !== item?.id).map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.code} - {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
