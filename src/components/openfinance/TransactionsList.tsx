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
import { CalendarIcon, Filter, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Dados simulados
const mockTransactions = [
  {
    id: "1",
    date: "2024-12-28",
    description: "Pix Recebido - Cliente ABC Ltda",
    category: "Receitas",
    amount: 15800.00,
    type: "ENTRADA",
    status: "CONCILIADO",
  },
  {
    id: "2",
    date: "2024-12-27",
    description: "Pix Enviado - Fornecedor XYZ",
    category: "Serviços",
    amount: -3250.00,
    type: "SAIDA",
    status: "CONCILIADO",
  },
  {
    id: "3",
    date: "2024-12-27",
    description: "TED Recebido - Pagamento Fatura #1234",
    category: "Receitas",
    amount: 8900.00,
    type: "ENTRADA",
    status: "CONCILIADO",
  },
  {
    id: "4",
    date: "2024-12-26",
    description: "Débito - DARF Impostos Federais",
    category: "Impostos",
    amount: -4567.89,
    type: "SAIDA",
    status: "PENDENTE",
  },
  {
    id: "5",
    date: "2024-12-26",
    description: "Pix Recebido - Cliente DEF Serviços",
    category: "Receitas",
    amount: 12300.00,
    type: "ENTRADA",
    status: "CONCILIADO",
  },
  {
    id: "6",
    date: "2024-12-25",
    description: "Boleto - Aluguel Escritório",
    category: "Despesas Fixas",
    amount: -5600.00,
    type: "SAIDA",
    status: "CONCILIADO",
  },
  {
    id: "7",
    date: "2024-12-24",
    description: "Pix Enviado - Salários Funcionários",
    category: "Folha de Pagamento",
    amount: -28500.00,
    type: "SAIDA",
    status: "CONCILIADO",
  },
  {
    id: "8",
    date: "2024-12-23",
    description: "TED Recebido - Prestação de Serviços",
    category: "Receitas",
    amount: 22100.00,
    type: "ENTRADA",
    status: "PENDENTE",
  },
];

export function TransactionsList() {
  const [dateFilter, setDateFilter] = useState<Date>();
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const formatCurrency = (value: number) => {
    const absolute = Math.abs(value);
    return absolute.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const filteredTransactions = mockTransactions.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (dateFilter && format(new Date(t.date), "yyyy-MM-dd") !== format(dateFilter, "yyyy-MM-dd")) {
      return false;
    }
    return true;
  });

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
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma transação encontrada para os filtros selecionados
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
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
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
