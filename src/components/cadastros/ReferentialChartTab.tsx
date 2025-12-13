import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, BookOpen } from 'lucide-react';

export function ReferentialChartTab() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['chart-of-accounts-referential'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_chart_of_accounts')
        .select('id, code, name, referential_code, referential_name, sped_code, account_type, is_active')
        .not('referential_code', 'is', null)
        .order('referential_code');
      if (error) throw error;
      return data;
    },
  });

  const filteredAccounts = accounts?.filter(
    (acc) =>
      acc.referential_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.referential_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Plano de Contas Referencial</CardTitle>
            <CardDescription>
              Mapeamento entre plano de contas interno e referenciais (SPED, RFB)
            </CardDescription>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou nome..."
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
        ) : filteredAccounts && filteredAccounts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código Interno</TableHead>
                <TableHead>Conta Interna</TableHead>
                <TableHead>Código Referencial</TableHead>
                <TableHead>Nome Referencial</TableHead>
                <TableHead>Código SPED</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell className="font-mono">{acc.code}</TableCell>
                  <TableCell>{acc.name}</TableCell>
                  <TableCell className="font-mono text-primary">{acc.referential_code || '-'}</TableCell>
                  <TableCell>{acc.referential_name || '-'}</TableCell>
                  <TableCell className="font-mono">{acc.sped_code || '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${acc.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {acc.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma conta com referencial cadastrado.</p>
            <p className="text-sm mt-2">
              Configure os códigos referenciais no Plano de Contas principal.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
