import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  AlertCircle,
  CreditCard
} from "lucide-react";
import { useStatementPolling } from "@/hooks/useStatementPolling";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BalanceValidationCard } from "./BalanceValidationCard";

interface Transaction {
  id?: string;
  date: string;
  description: string;
  amount: number;
  document?: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  bank_code: string;
  agency: string;
  account_number: string;
  account_hash: string | null;
  open_finance_status: string;
  consent_link?: string | null;
}

interface StatementDashboardProps {
  bankAccounts: BankAccount[];
  selectedAccountId: string | null;
  selectedAccountHash: string | null;
  companyId?: string;
  onAccountSelect: (accountId: string) => void;
  onRefreshAccounts?: () => void;
}

export function StatementDashboard({ 
  bankAccounts, 
  selectedAccountId, 
  selectedAccountHash, 
  companyId, 
  onAccountSelect,
  onRefreshAccounts
}: StatementDashboardProps) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(format(thirtyDaysAgo, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(today, "yyyy-MM-dd"));
  const [newTransactions, setNewTransactions] = useState<Transaction[]>([]);
  const [pendingProtocol, setPendingProtocol] = useState<string | null>(null);

  // Fetch saved transactions from database
  const { data: savedTransactions = [], isLoading: isLoadingSaved, refetch: refetchSaved } = useQuery({
    queryKey: ['bank-statements', selectedAccountId, startDate, endDate],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      const { data, error } = await supabase
        .from('bank_statements')
        .select('*')
        .eq('bank_account_id', selectedAccountId)
        .gte('statement_date', startDate)
        .lte('statement_date', endDate)
        .order('statement_date', { ascending: false })
        .limit(500);
      
      if (error) {
        console.error('Error fetching saved transactions:', error);
        return [];
      }
      
      return (data || []).map(t => ({
        id: t.id,
        date: t.statement_date,
        description: t.description || '',
        amount: t.amount,
        document: t.external_id || undefined,
      }));
    },
    enabled: !!selectedAccountId,
  });

  // Fetch latest sync protocol with balance validation data
  const { data: lastSyncProtocol, refetch: refetchSyncProtocol } = useQuery({
    queryKey: ['last-sync-protocol', selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return null;
      const { data, error } = await supabase
        .from('sync_protocols')
        .select('opening_balance, closing_balance, balance_validated, balance_difference, completed_at')
        .eq('bank_account_id', selectedAccountId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.log('No sync protocol found:', error.message);
        return null;
      }
      
      return data;
    },
    enabled: !!selectedAccountId,
  });

  // Merge saved and new transactions, deduplicate by id
  const transactions = useMemo(() => {
    const txMap = new Map<string, Transaction>();
    savedTransactions.forEach(t => {
      if (t.id) txMap.set(t.id, t);
    });
    newTransactions.forEach(t => {
      if (t.id) txMap.set(t.id, t);
    });
    return Array.from(txMap.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [savedTransactions, newTransactions]);

  // Calculate totals from merged transactions
  const totals = useMemo(() => {
    const credits = transactions.filter(t => t.amount >= 0).reduce((sum, t) => sum + t.amount, 0);
    const debits = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return { credits, debits };
  }, [transactions]);

  const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);

  const { 
    requestStatement, 
    resumePolling,
    isPolling, 
    status, 
    progress,
    estimatedTimeRemaining,
    lastUniqueId
  } = useStatementPolling({
    onComplete: (statementData) => {
      const allTransactions = [
        ...statementData.credits.map((t) => ({ ...t, type: "credit" as const })),
        ...statementData.debits.map((t) => ({ ...t, type: "debit" as const })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setNewTransactions(allTransactions);
      setPendingProtocol(null);
      
      // Refresh saved transactions, sync protocols, and accounts
      refetchSaved();
      refetchSyncProtocol();
      onRefreshAccounts?.();
      
      // Show balance validation status in toast
      if (statementData.balanceValidated !== undefined) {
        if (statementData.balanceValidated) {
          toast.success("Extrato atualizado!", {
            description: `${allTransactions.length} transações. Saldo validado com o banco ✓`,
          });
        } else if (statementData.balanceDifference !== null) {
          const diff = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
            .format(Math.abs(statementData.balanceDifference));
          toast.warning("Extrato atualizado com divergência", {
            description: `${allTransactions.length} transações. Diferença de ${diff} no saldo.`,
          });
        } else {
          toast.success("Extrato atualizado!", {
            description: `${allTransactions.length} transações encontradas`,
          });
        }
      } else {
        toast.success("Extrato atualizado!", {
          description: `${allTransactions.length} transações encontradas`,
        });
      }
    },
    onError: (error) => {
      toast.error("Erro ao buscar extrato", { description: error });
    },
    onTimeout: (uniqueId) => {
      setPendingProtocol(uniqueId);
      toast.info("O banco ainda está processando", {
        description: "Você pode continuar verificando ou tentar novamente mais tarde.",
        duration: 10000,
      });
    },
  });

  const handleRefresh = async () => {
    if (!selectedAccountHash) {
      toast.error("Nenhuma conta selecionada", { 
        description: "Selecione uma conta bancária conectada" 
      });
      return;
    }

    const result = await requestStatement(
      selectedAccountHash,
      startDate,
      endDate,
      selectedAccountId || undefined,
      companyId
    );

    if (result.success) {
      // Request succeeded, refresh accounts to update status immediately
      onRefreshAccounts?.();
    } else {
      toast.error("Erro", { description: result.error });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (bankAccounts.length === 0) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle>Extrato Bancário</CardTitle>
          <CardDescription>
            Conecte uma conta bancária para visualizar o extrato
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Extrato Bancário</CardTitle>
                <CardDescription>
                  Visualize e sincronize suas transações via Open Finance
                </CardDescription>
              </div>
            </div>
            
            {/* Account selector and filters */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 min-w-[200px]">
                <Label htmlFor="account" className="text-xs">Conta Bancária</Label>
                <Select
                  value={selectedAccountId || ""}
                  onValueChange={onAccountSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          <span>{account.bank_name} - Ag: {account.agency} Cc: {account.account_number}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-xs">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-36"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs">Data Final</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-36"
                />
              </div>
              <Button 
                onClick={handleRefresh} 
                disabled={isPolling || !selectedAccountHash}
                className="min-w-32"
              >
                {isPolling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {progress}%
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </>
                )}
              </Button>
            </div>
            
            {/* Only show consent alert if not currently polling (avoid conflicting messages) */}
            {selectedAccount && selectedAccount.open_finance_status !== "connected" && !isPolling && (
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {selectedAccount.open_finance_status === "awaiting_consent" 
                      ? "Aguardando autorização no banco. Conclua o fluxo de consentimento."
                      : "Esta conta ainda não está conectada via Open Finance."}
                  </span>
                </div>
                {selectedAccount.consent_link && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(selectedAccount.consent_link!, "_blank")}
                  >
                    Autorizar no banco
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Status indicator when polling */}
      {isPolling && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Buscando dados no banco...</p>
                <p className="text-sm text-muted-foreground">
                  Aguarde enquanto o banco processa sua solicitação (tempo restante: {estimatedTimeRemaining})
                </p>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <Badge variant="outline">{status}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending protocol card - shows after timeout */}
      {!isPolling && pendingProtocol && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium">O banco ainda está processando</p>
                  <p className="text-sm text-muted-foreground">
                    Protocolo: {pendingProtocol.substring(0, 12)}...
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setPendingProtocol(null);
                  }}
                >
                  Dispensar
                </Button>
                <Button 
                  size="sm"
                  onClick={() => {
                    resumePolling(pendingProtocol, selectedAccountId || undefined);
                    setPendingProtocol(null);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Continuar verificando
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Entradas</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totals.credits)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-500/10">
                <TrendingDown className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Saídas</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totals.debits)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo do Período</p>
                <p className={`text-2xl font-bold ${totals.credits - totals.debits >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(totals.credits - totals.debits)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Validation Card */}
        <BalanceValidationCard
          openingBalance={lastSyncProtocol?.opening_balance ?? null}
          closingBalance={lastSyncProtocol?.closing_balance ?? null}
          calculatedBalance={(lastSyncProtocol?.opening_balance ?? 0) + totals.credits - totals.debits}
          isValidated={lastSyncProtocol?.balance_validated ?? false}
          difference={lastSyncProtocol?.balance_difference ?? null}
        />
      </div>

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <CardTitle>Transações</CardTitle>
          <CardDescription>
            {transactions.length} transações no período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPolling || isLoadingSaved ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhuma transação encontrada
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em "Atualizar" para buscar o extrato
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction, index) => {
                  const isCredit = transaction.amount >= 0;
                  return (
                    <TableRow key={transaction.id || index}>
                      <TableCell>
                        <div className={`p-1.5 rounded-full ${isCredit ? "bg-green-500/10" : "bg-red-500/10"}`}>
                          {isCredit ? (
                            <ArrowUpRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatDate(transaction.date)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.description}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {transaction.document || "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${isCredit ? "text-green-600" : "text-red-600"}`}>
                        {isCredit ? "+" : ""}{formatCurrency(Math.abs(transaction.amount))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
