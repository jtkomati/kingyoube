import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  CalendarIcon, 
  Filter, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Link2, 
  Plus,
  Loader2,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BankStatement {
  id: string;
  external_id: string | null;
  bank_account_id: string;
  statement_date: string;
  description: string | null;
  amount: number;
  type: string | null;
  category: string | null;
  category_confidence: number | null;
  reconciliation_status: string | null;
  linked_transaction_id: string | null;
}

interface Transaction {
  id: string;
  description: string | null;
  gross_amount: number;
  due_date: string;
}

export function ReconciliationTab() {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  // Dialog states
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load bank statements
      const { data: statementsData, error: statementsError } = await supabase
        .from('bank_statements')
        .select('*')
        .order('statement_date', { ascending: false })
        .limit(100);

      if (statementsError) {
        console.error('Error loading statements:', statementsError);
      } else {
        setStatements(statementsData || []);
      }

      // Load transactions for linking
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('id, description, gross_amount, due_date')
        .order('due_date', { ascending: false })
        .limit(100);

      if (transactionsError) {
        console.error('Error loading transactions:', transactionsError);
      } else {
        setTransactions(transactionsData || []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return Math.abs(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const filteredStatements = statements.filter((s) => {
    if (statusFilter !== "all" && s.reconciliation_status !== statusFilter) return false;
    if (typeFilter !== "all" && s.type !== typeFilter) return false;
    if (dateFilter && format(new Date(s.statement_date), "yyyy-MM-dd") !== format(dateFilter, "yyyy-MM-dd")) {
      return false;
    }
    return true;
  });

  const handleLinkTransaction = async () => {
    if (!selectedStatement || !selectedTransactionId) return;

    setIsLinking(true);
    try {
      const { error } = await supabase
        .from('bank_statements')
        .update({
          linked_transaction_id: selectedTransactionId,
          reconciliation_status: 'reconciled',
        })
        .eq('id', selectedStatement.id);

      if (error) throw error;

      toast.success("Transação conciliada com sucesso!");
      setIsLinkDialogOpen(false);
      setSelectedStatement(null);
      setSelectedTransactionId("");
      await loadData();
    } catch (error) {
      console.error('Error linking transaction:', error);
      toast.error("Erro ao conciliar transação");
    } finally {
      setIsLinking(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!selectedStatement) return;

    setIsLinking(true);
    try {
      // Get the default category
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .limit(1)
        .single();

      if (!categoryData) {
        toast.error("Nenhuma categoria encontrada");
        return;
      }

      // Create new transaction
      const { data: newTransaction, error: createError } = await supabase
        .from('transactions')
        .insert({
          description: selectedStatement.description,
          gross_amount: selectedStatement.amount,
          net_amount: selectedStatement.amount,
          due_date: selectedStatement.statement_date,
          payment_date: selectedStatement.statement_date,
          type: selectedStatement.type === 'credit' ? 'RECEIVABLE' : 'PAYABLE',
          category_id: categoryData.id,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Link the bank statement to the new transaction
      const { error: linkError } = await supabase
        .from('bank_statements')
        .update({
          linked_transaction_id: newTransaction.id,
          reconciliation_status: 'reconciled',
        })
        .eq('id', selectedStatement.id);

      if (linkError) throw linkError;

      toast.success("Lançamento criado e conciliado!");
      setIsCreateDialogOpen(false);
      setSelectedStatement(null);
      await loadData();
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error("Erro ao criar lançamento");
    } finally {
      setIsLinking(false);
    }
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null;
    if (confidence >= 0.9) {
      return <Badge variant="default" className="bg-green-600 text-xs">Alta</Badge>;
    } else if (confidence >= 0.7) {
      return <Badge variant="secondary" className="text-xs">Média</Badge>;
    } else {
      return <Badge variant="outline" className="text-xs">Baixa</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conciliação Bancária</CardTitle>
              <CardDescription>
                Vincule extratos bancários a lançamentos existentes ou crie novos
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dateFilter ? format(dateFilter, "PPP", { locale: ptBR }) : "Data"}
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
                        Limpar
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="reconciled">Conciliados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="credit">Créditos</SelectItem>
                  <SelectItem value="debit">Débitos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria IA</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStatements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {statements.length === 0 
                      ? "Nenhum extrato sincronizado. Conecte um banco e sincronize o extrato."
                      : "Nenhum item encontrado para os filtros selecionados"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStatements.map((statement) => (
                  <TableRow key={statement.id}>
                    <TableCell className="font-medium">
                      {format(new Date(statement.statement_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statement.type === "credit" ? (
                          <ArrowDownCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="truncate max-w-[300px]">
                          {statement.description || "Sem descrição"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statement.category && (
                          <>
                            <Sparkles className="h-3 w-3 text-primary" />
                            <Badge variant="outline">{statement.category}</Badge>
                            {getConfidenceBadge(statement.category_confidence)}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "font-semibold",
                        statement.type === "credit" ? "text-green-600" : "text-red-600"
                      )}>
                        {statement.type === "credit" ? "+" : "-"}
                        {formatCurrency(statement.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={statement.reconciliation_status === "reconciled" ? "default" : "secondary"}
                        className={statement.reconciliation_status === "reconciled" ? "bg-green-600" : ""}
                      >
                        {statement.reconciliation_status === "reconciled" ? "Conciliado" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {statement.reconciliation_status !== "reconciled" && (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedStatement(statement);
                              setIsLinkDialogOpen(true);
                            }}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedStatement(statement);
                              setIsCreateDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Link Transaction Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conciliar com Lançamento Existente</DialogTitle>
            <DialogDescription>
              Selecione um lançamento para vincular a este item do extrato.
            </DialogDescription>
          </DialogHeader>
          
          {selectedStatement && (
            <div className="py-4 space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium">{selectedStatement.description}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedStatement.statement_date), "dd/MM/yyyy")} • 
                  {selectedStatement.type === "credit" ? " +" : " -"}
                  {formatCurrency(selectedStatement.amount)}
                </p>
              </div>

              <Select value={selectedTransactionId} onValueChange={setSelectedTransactionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um lançamento" />
                </SelectTrigger>
                <SelectContent>
                  {transactions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.description} - {formatCurrency(t.gross_amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLinkTransaction} disabled={!selectedTransactionId || isLinking}>
              {isLinking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Conciliar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Transaction Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Lançamento</DialogTitle>
            <DialogDescription>
              Criar um lançamento a partir deste item do extrato.
            </DialogDescription>
          </DialogHeader>
          
          {selectedStatement && (
            <div className="py-4">
              <div className="p-4 rounded-lg bg-muted space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Descrição</span>
                  <span className="text-sm font-medium">{selectedStatement.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Data</span>
                  <span className="text-sm font-medium">
                    {format(new Date(selectedStatement.statement_date), "dd/MM/yyyy")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    selectedStatement.type === "credit" ? "text-green-600" : "text-red-600"
                  )}>
                    {selectedStatement.type === "credit" ? "+" : "-"}
                    {formatCurrency(selectedStatement.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tipo</span>
                  <span className="text-sm font-medium">
                    {selectedStatement.type === "credit" ? "Receita (A Receber)" : "Despesa (A Pagar)"}
                  </span>
                </div>
                {selectedStatement.category && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Categoria Sugerida</span>
                    <Badge variant="outline">{selectedStatement.category}</Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTransaction} disabled={isLinking}>
              {isLinking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
