import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, PieChart, TrendingUp, TrendingDown } from 'lucide-react';

export function ManagementChartTab() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['chart-of-accounts-management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_chart_of_accounts')
        .select('*')
        .eq('is_analytical', true)
        .eq('is_active', true)
        .order('account_type, code');
      if (error) throw error;
      return data;
    },
  });

  const filteredAccounts = accounts?.filter(
    (acc) =>
      acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.account_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group accounts by type
  const groupedAccounts = filteredAccounts?.reduce((acc, account) => {
    const type = account.account_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(account);
    return acc;
  }, {} as Record<string, typeof accounts>);

  const typeLabels: Record<string, { label: string; icon: typeof PieChart; color: string }> = {
    'RECEITA': { label: 'Receitas', icon: TrendingUp, color: 'text-green-600' },
    'DESPESA': { label: 'Despesas', icon: TrendingDown, color: 'text-red-600' },
    'CUSTO': { label: 'Custos', icon: TrendingDown, color: 'text-orange-600' },
    'ATIVO': { label: 'Ativos', icon: PieChart, color: 'text-blue-600' },
    'PASSIVO': { label: 'Passivos', icon: PieChart, color: 'text-purple-600' },
    'PATRIMONIO_LIQUIDO': { label: 'Patrimônio Líquido', icon: PieChart, color: 'text-indigo-600' },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <PieChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Plano de Contas Gerencial</CardTitle>
            <CardDescription>
              Visão gerencial das contas analíticas ativas para análise de resultados
            </CardDescription>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-80"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : groupedAccounts && Object.keys(groupedAccounts).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedAccounts).map(([type, typeAccounts]) => {
              const typeInfo = typeLabels[type] || { label: type, icon: PieChart, color: 'text-gray-600' };
              const Icon = typeInfo.icon;
              
              return (
                <div key={type} className="border rounded-lg overflow-hidden">
                  <div className={`flex items-center gap-2 px-4 py-3 bg-muted/50 border-b ${typeInfo.color}`}>
                    <Icon className="h-4 w-4" />
                    <span className="font-semibold">{typeInfo.label}</span>
                    <span className="text-muted-foreground text-sm">({typeAccounts?.length || 0} contas)</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Natureza</TableHead>
                        <TableHead>Subtipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typeAccounts?.map((acc) => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-mono">{acc.code}</TableCell>
                          <TableCell>{acc.name}</TableCell>
                          <TableCell>{acc.nature === 'D' ? 'Devedora' : 'Credora'}</TableCell>
                          <TableCell>{acc.account_subtype || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma conta analítica ativa encontrada.</p>
            <p className="text-sm mt-2">
              Cadastre contas analíticas no Plano de Contas para visualizá-las aqui.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
