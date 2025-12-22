import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, Search, Ban, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface TenantUsage {
  tenant_id: string;
  company_name: string;
  cnpj: string;
  total_tokens: number;
  cost_cents: number;
  last_request: string;
  favorite_model: string;
  request_count: number;
}

interface TenantUsageTableProps {
  data: TenantUsage[];
  isLoading?: boolean;
}

export function TenantUsageTable({ data, isLoading }: TenantUsageTableProps) {
  const [search, setSearch] = useState('');
  const [blockedTenants, setBlockedTenants] = useState<Set<string>>(new Set());

  const filteredData = data.filter(
    (tenant) =>
      tenant.company_name.toLowerCase().includes(search.toLowerCase()) ||
      tenant.cnpj.includes(search)
  );

  const handleBlockTenant = (tenantId: string, companyName: string) => {
    setBlockedTenants((prev) => new Set(prev).add(tenantId));
    toast.success(`Uso de IA bloqueado para ${companyName}`);
    // Em produção: chamar edge function para atualizar o banco
  };

  const handleUnblockTenant = (tenantId: string, companyName: string) => {
    setBlockedTenants((prev) => {
      const newSet = new Set(prev);
      newSet.delete(tenantId);
      return newSet;
    });
    toast.success(`Uso de IA desbloqueado para ${companyName}`);
  };

  const formatModel = (model: string) => {
    if (model.includes('/')) {
      return model.split('/').pop()?.split('-').slice(0, 2).join('-') || model;
    }
    return model;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Uso por Cliente (CNPJ)
          </CardTitle>
          <CardDescription>Consumo de IA por organização</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Uso por Cliente (CNPJ)
            </CardTitle>
            <CardDescription>
              {data.length} organizações • Consumo de IA nos últimos 30 dias
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            {search ? 'Nenhum resultado encontrado' : 'Nenhum dado disponível'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa / CNPJ</TableHead>
                  <TableHead className="text-right">Total Tokens</TableHead>
                  <TableHead className="text-right">Custo ($)</TableHead>
                  <TableHead>Última Requisição</TableHead>
                  <TableHead>Modelo Favorito</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((tenant) => {
                  const isBlocked = blockedTenants.has(tenant.tenant_id);
                  return (
                    <TableRow key={tenant.tenant_id} className={isBlocked ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isBlocked && <Ban className="h-4 w-4 text-destructive" />}
                          <div>
                            <p className="font-medium">{tenant.company_name}</p>
                            <p className="text-xs text-muted-foreground">{tenant.cnpj}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {tenant.total_tokens.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${(tenant.cost_cents / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(tenant.last_request), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {formatModel(tenant.favorite_model)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {isBlocked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnblockTenant(tenant.tenant_id, tenant.company_name)}
                          >
                            Desbloquear
                          </Button>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Ban className="h-4 w-4 mr-1" />
                                Bloquear IA
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                  Bloquear Uso de IA
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja bloquear o uso de IA para{' '}
                                  <strong>{tenant.company_name}</strong>?
                                  <br />
                                  <br />
                                  Esta ação impedirá que o cliente utilize qualquer funcionalidade
                                  de inteligência artificial até ser desbloqueado.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => handleBlockTenant(tenant.tenant_id, tenant.company_name)}
                                >
                                  Confirmar Bloqueio
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
