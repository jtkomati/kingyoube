import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter, ArrowDownCircle, ArrowUpCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

export function TransactionsList() {
  const [dateFilter, setDateFilter] = useState<Date>();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { currentOrganization } = useAuth();

  // Buscar transações do banco de dados
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['bank-statements', currentOrganization?.id, dateFilter, typeFilter],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      // Primeiro buscar contas bancárias da organização
      const { data: bankAccounts, error: bankError } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('company_id', currentOrganization.id);
      
      if (bankError) throw bankError;
      if (!bankAccounts || bankAccounts.length === 0) return [];
      
      const bankAccountIds = bankAccounts.map(ba => ba.id);
      
      // Buscar transações bancárias
      let query = supabase
        .from('bank_statements')
        .select('*')
        .in('bank_account_id', bankAccountIds)
        .order('statement_date', { ascending: false })
        .limit(50);
      
      if (dateFilter) {
        const dateStr = format(dateFilter, 'yyyy-MM-dd');
        query = query.eq('statement_date', dateStr);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Filtrar por tipo se necessário
      let filtered = data || [];
      if (typeFilter !== 'all') {
        filtered = filtered.filter(t => {
          const isEntrada = (t.amount || 0) > 0;
          return typeFilter === 'ENTRADA' ? isEntrada : !isEntrada;
        });
      }
      
      return filtered.map(t => ({
        id: t.id,
        date: t.statement_date,
        description: t.description || 'Sem descrição',
        category: t.category || 'Não categorizado',
        amount: t.amount || 0,
        type: (t.amount || 0) > 0 ? 'ENTRADA' : 'SAIDA',
        status: t.reconciliation_status === 'reconciled' ? 'CONCILIADO' : 'PENDENTE',
      }));
    },
    enabled: !!currentOrganization?.id,
  });

  const formatCurrency = (value: number) => {
    const absolute = Math.abs(value);
    return absolute.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Extrato Inteligente</CardTitle>
            <CardDescription>
              Transações bancárias com categorização automática
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {dateFilter ? format(dateFilter, "PPP", { locale: ptBR }) : "Filtrar por data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={setDateFilter}
                  initialFocus
                  className="pointer-events-auto"
                />
                {dateFilter && (
                  <div className="p-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setDateFilter(undefined)}
                    >
                      Limpar filtro
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as transações</SelectItem>
                <SelectItem value="ENTRADA">Entradas</SelectItem>
                <SelectItem value="SAIDA">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <RefreshCw className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-center text-lg font-medium mb-2">
              Nenhuma transação bancária encontrada
            </p>
            <p className="text-center text-sm">
              Sincronize sua conta bancária para visualizar o extrato inteligente.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">
                    {format(new Date(transaction.date), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {transaction.type === "ENTRADA" ? (
                        <ArrowDownCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 text-red-600" />
                      )}
                      {transaction.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{transaction.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "font-semibold",
                      transaction.type === "ENTRADA" ? "text-green-600" : "text-red-600"
                    )}>
                      {transaction.type === "ENTRADA" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={transaction.status === "CONCILIADO" ? "default" : "secondary"}
                      className={transaction.status === "CONCILIADO" ? "bg-green-600" : ""}
                    >
                      {transaction.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
