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
import { Plus, Pencil, Trash2, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  account_subtype: string | null;
  nature: string | null;
  level: number;
  is_analytical: boolean | null;
  is_active: boolean | null;
  parent_account_id: string | null;
  sped_code: string | null;
  referential_code: string | null;
  referential_name: string | null;
}

export function ChartOfAccountsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('FINANCEIRO');
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_chart_of_accounts')
        .select('*')
        .order('code');
      if (error) throw error;
      return data as Account[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounting_chart_of_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      toast.success('Conta excluída com sucesso');
    },
    onError: () => {
      toast.error('Erro ao excluir conta');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (account: Partial<Account>) => {
      if (account.id) {
        const { error } = await supabase
          .from('accounting_chart_of_accounts')
          .update(account)
          .eq('id', account.id);
        if (error) throw error;
      } else {
      const { error } = await supabase
          .from('accounting_chart_of_accounts')
          .insert([account as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      toast.success('Conta salva com sucesso');
      setIsDialogOpen(false);
      setSelectedAccount(null);
    },
    onError: () => {
      toast.error('Erro ao salvar conta');
    },
  });

  const filteredAccounts = accounts?.filter(
    (acc) =>
      acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAccounts(newExpanded);
  };

  const getChildAccounts = (parentId: string) => {
    return filteredAccounts?.filter((acc) => acc.parent_account_id === parentId) || [];
  };

  const rootAccounts = filteredAccounts?.filter((acc) => !acc.parent_account_id) || [];

  const renderAccountRow = (account: Account, depth: number = 0) => {
    const children = getChildAccounts(account.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedAccounts.has(account.id);

    return (
      <>
        <TableRow key={account.id} className="hover:bg-muted/50">
          <TableCell style={{ paddingLeft: `${depth * 24 + 16}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren && (
                <button onClick={() => toggleExpand(account.id)} className="p-1 hover:bg-muted rounded">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              )}
              {!hasChildren && <span className="w-6" />}
              <span className="font-mono text-sm">{account.code}</span>
            </div>
          </TableCell>
          <TableCell>{account.name}</TableCell>
          <TableCell>{account.account_type}</TableCell>
          <TableCell>{account.nature || '-'}</TableCell>
          <TableCell>{account.is_analytical ? 'Sim' : 'Não'}</TableCell>
          <TableCell>
            <span className={`px-2 py-1 rounded-full text-xs ${account.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {account.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </TableCell>
          <TableCell>
            {canEdit && (
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => { setSelectedAccount(account); setIsDialogOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(account.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </TableCell>
        </TableRow>
        {hasChildren && isExpanded && children.map((child) => renderAccountRow(child, depth + 1))}
      </>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Plano de Contas</CardTitle>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          {canEdit && (
            <Button onClick={() => { setSelectedAccount(null); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta
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
                <TableHead>Tipo</TableHead>
                <TableHead>Natureza</TableHead>
                <TableHead>Analítica</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rootAccounts.map((account) => renderAccountRow(account))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AccountDialog
        open={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setSelectedAccount(null); }}
        account={selectedAccount}
        accounts={accounts || []}
        onSave={(data) => saveMutation.mutate(data)}
      />
    </Card>
  );
}

interface AccountDialogProps {
  open: boolean;
  onClose: () => void;
  account: Account | null;
  accounts: Account[];
  onSave: (data: Partial<Account>) => void;
}

function AccountDialog({ open, onClose, account, accounts, onSave }: AccountDialogProps) {
  const [formData, setFormData] = useState<Partial<Account>>({
    code: '',
    name: '',
    account_type: 'ATIVO',
    nature: 'D',
    level: 1,
    is_analytical: false,
    is_active: true,
  });

  useState(() => {
    if (account) {
      setFormData(account);
    } else {
      setFormData({
        code: '',
        name: '',
        account_type: 'ATIVO',
        nature: 'D',
        level: 1,
        is_analytical: false,
        is_active: true,
      });
    }
  });

  const handleSubmit = () => {
    if (!formData.code || !formData.name) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    onSave({ ...formData, id: account?.id });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
        </DialogHeader>
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
              <Label>Nível</Label>
              <Input
                type="number"
                value={formData.level || 1}
                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label>Nome *</Label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select
                value={formData.account_type || 'ATIVO'}
                onValueChange={(value) => setFormData({ ...formData, account_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="PASSIVO">Passivo</SelectItem>
                  <SelectItem value="PATRIMONIO_LIQUIDO">Patrimônio Líquido</SelectItem>
                  <SelectItem value="RECEITA">Receita</SelectItem>
                  <SelectItem value="DESPESA">Despesa</SelectItem>
                  <SelectItem value="CUSTO">Custo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Natureza</Label>
              <Select
                value={formData.nature || 'D'}
                onValueChange={(value) => setFormData({ ...formData, nature: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="D">Devedora</SelectItem>
                  <SelectItem value="C">Credora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Conta Pai</Label>
            <Select
              value={formData.parent_account_id || 'none'}
              onValueChange={(value) => setFormData({ ...formData, parent_account_id: value === 'none' ? null : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (Conta Raiz)</SelectItem>
                {accounts.filter(a => a.id !== account?.id).map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_analytical || false}
                onCheckedChange={(checked) => setFormData({ ...formData, is_analytical: checked })}
              />
              <Label>Conta Analítica</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active !== false}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Ativa</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
