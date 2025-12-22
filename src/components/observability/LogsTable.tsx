import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronRight, AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  function_name?: string;
  error_stack?: string;
  context?: Record<string, unknown>;
}

interface LogsTableProps {
  logs: LogEntry[];
  isLoading?: boolean;
}

const levelIcons = {
  debug: Bug,
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
};

const levelColors = {
  debug: 'bg-muted text-muted-foreground',
  info: 'bg-blue-500/20 text-blue-500',
  warn: 'bg-yellow-500/20 text-yellow-500',
  error: 'bg-red-500/20 text-red-500',
};

export function LogsTable({ logs, isLoading }: LogsTableProps) {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filteredLogs = logs.filter(log => {
    const matchesLevel = filter === 'all' || log.level === filter;
    const matchesSearch = search === '' || 
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.function_name?.toLowerCase().includes(search.toLowerCase()));
    return matchesLevel && matchesSearch;
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Input 
          placeholder="Buscar mensagem ou função..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <ScrollArea className="h-[500px] rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[80px]">Nível</TableHead>
              <TableHead className="w-[120px]">Fonte</TableHead>
              <TableHead>Mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Carregando logs...
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum log encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const Icon = levelIcons[log.level];
                const isExpanded = expandedRows.has(log.id);
                const hasDetails = log.error_stack || log.context;

                return (
                  <>
                    <TableRow 
                      key={log.id} 
                      className={`cursor-pointer hover:bg-muted/50 ${isExpanded ? 'bg-muted/30' : ''}`}
                      onClick={() => hasDetails && toggleRow(log.id)}
                    >
                      <TableCell>
                        {hasDetails && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.timestamp), 'dd/MM HH:mm:ss', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${levelColors[log.level]} border-0`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {log.level.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.function_name || log.source}
                      </TableCell>
                      <TableCell className="max-w-md truncate text-sm">
                        {log.message}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasDetails && (
                      <TableRow key={`${log.id}-details`}>
                        <TableCell colSpan={5} className="bg-muted/20 p-4">
                          {log.error_stack && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold mb-2">Stack Trace:</p>
                              <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                                {log.error_stack}
                              </pre>
                            </div>
                          )}
                          {log.context && Object.keys(log.context).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold mb-2">Contexto:</p>
                              <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto">
                                {JSON.stringify(log.context, null, 2)}
                              </pre>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
