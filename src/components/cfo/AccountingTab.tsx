import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileText } from "lucide-react";
import { useState } from "react";

export function AccountingTab() {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch Chart of Accounts
  const { data: chartAccounts } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_chart_of_accounts')
        .select('*')
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  // Fetch Cost Centers
  const { data: costCenters } = useQuery({
    queryKey: ['cost-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_cost_centers')
        .select('*')
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  // Fetch Profit Centers
  const { data: profitCenters } = useQuery({
    queryKey: ['profit-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_profit_centers')
        .select('*, customers(first_name, last_name, company_name)')
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  // Fetch Projects
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_projects')
        .select('*, customers(first_name, last_name, company_name)')
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  const filteredAccounts = chartAccounts?.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.code.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="chart" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="chart">Plano de Contas</TabsTrigger>
          <TabsTrigger value="entries">Lançamentos</TabsTrigger>
          <TabsTrigger value="balance">Balanço</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="dfc">DFC</TabsTrigger>
          <TabsTrigger value="dmpl">DMPL</TabsTrigger>
          <TabsTrigger value="auxiliary">Auxiliares</TabsTrigger>
        </TabsList>

        {/* Plano de Contas */}
        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Plano de Contas</CardTitle>
                  <CardDescription>
                    Plano referencial da Receita Federal - Compatível com SPED ECD/ECF
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Conta
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar conta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Natureza</TableHead>
                      <TableHead>Código Ref. RF</TableHead>
                      <TableHead>Nome Referencial</TableHead>
                      <TableHead>Analítica</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts?.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono">{account.code}</TableCell>
                        <TableCell style={{ paddingLeft: `${(account.level - 1) * 20}px` }}>
                          {account.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{account.account_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={account.nature === 'DEBITO' ? 'default' : 'secondary'}>
                            {account.nature}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {account.referential_code}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {account.referential_name}
                        </TableCell>
                        <TableCell>
                          {account.is_analytical && (
                            <Badge variant="outline" className="bg-green-500/10">Sim</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lançamentos Contábeis */}
        <TabsContent value="entries" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Lançamentos Contábeis</CardTitle>
                  <CardDescription>
                    Lançamentos com Centro de Custos, Centro de Lucros e Projetos
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Lançamento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Nenhum lançamento encontrado</p>
                <p className="text-sm mt-2">Crie seu primeiro lançamento contábil</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balanço Patrimonial */}
        <TabsContent value="balance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Balanço Patrimonial</CardTitle>
              <CardDescription>
                Demonstrativo de Ativos, Passivos e Patrimônio Líquido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-4 text-lg">ATIVO</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="font-medium">Ativo Circulante</span>
                      <span className="font-mono">R$ 0,00</span>
                    </div>
                    <div className="flex justify-between p-2">
                      <span className="ml-4 text-sm">Caixa e Equivalentes</span>
                      <span className="font-mono text-sm">R$ 0,00</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded mt-4">
                      <span className="font-medium">Ativo Não Circulante</span>
                      <span className="font-mono">R$ 0,00</span>
                    </div>
                    <div className="flex justify-between p-3 bg-primary/10 rounded font-bold mt-4">
                      <span>TOTAL DO ATIVO</span>
                      <span className="font-mono">R$ 0,00</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4 text-lg">PASSIVO</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="font-medium">Passivo Circulante</span>
                      <span className="font-mono">R$ 0,00</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded mt-4">
                      <span className="font-medium">Passivo Não Circulante</span>
                      <span className="font-mono">R$ 0,00</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded mt-4">
                      <span className="font-medium">Patrimônio Líquido</span>
                      <span className="font-mono">R$ 0,00</span>
                    </div>
                    <div className="flex justify-between p-3 bg-primary/10 rounded font-bold mt-4">
                      <span>TOTAL DO PASSIVO</span>
                      <span className="font-mono">R$ 0,00</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DRE */}
        <TabsContent value="dre" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demonstração do Resultado do Exercício (DRE)</CardTitle>
              <CardDescription>
                DRE Gerencial com Centro de Custos e Projetos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Receita Bruta</span>
                  <span className="font-mono">R$ 0,00</span>
                </div>
                <div className="flex justify-between p-2">
                  <span className="ml-4 text-sm">(-) Deduções</span>
                  <span className="font-mono text-sm">R$ 0,00</span>
                </div>
                <div className="flex justify-between p-2 bg-primary/10 rounded">
                  <span className="font-semibold">(=) Receita Líquida</span>
                  <span className="font-mono font-semibold">R$ 0,00</span>
                </div>
                <div className="flex justify-between p-2 mt-4">
                  <span className="ml-4 text-sm">(-) Custos</span>
                  <span className="font-mono text-sm">R$ 0,00</span>
                </div>
                <div className="flex justify-between p-2 bg-primary/10 rounded">
                  <span className="font-semibold">(=) Lucro Bruto</span>
                  <span className="font-mono font-semibold">R$ 0,00</span>
                </div>
                <div className="flex justify-between p-2 mt-4">
                  <span className="ml-4 text-sm">(-) Despesas Operacionais</span>
                  <span className="font-mono text-sm">R$ 0,00</span>
                </div>
                <div className="flex justify-between p-2 bg-primary/10 rounded">
                  <span className="font-semibold">(=) Resultado Operacional</span>
                  <span className="font-mono font-semibold">R$ 0,00</span>
                </div>
                <div className="flex justify-between p-3 bg-primary/20 rounded font-bold mt-4">
                  <span>(=) RESULTADO LÍQUIDO</span>
                  <span className="font-mono">R$ 0,00</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DFC */}
        <TabsContent value="dfc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demonstração dos Fluxos de Caixa (DFC)</CardTitle>
              <CardDescription>
                Fluxo de Caixa - Método Direto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Atividades Operacionais</span>
                  <span className="font-mono">R$ 0,00</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Atividades de Investimento</span>
                  <span className="font-mono">R$ 0,00</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="font-medium">Atividades de Financiamento</span>
                  <span className="font-mono">R$ 0,00</span>
                </div>
                <div className="flex justify-between p-3 bg-primary/10 rounded font-bold mt-4">
                  <span>Variação de Caixa</span>
                  <span className="font-mono">R$ 0,00</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DMPL */}
        <TabsContent value="dmpl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demonstração das Mutações do Patrimônio Líquido (DMPL)</CardTitle>
              <CardDescription>
                Movimentações do Patrimônio Líquido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Capital Social</TableHead>
                      <TableHead className="text-right">Reservas</TableHead>
                      <TableHead className="text-right">Lucros Acumulados</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Saldo Inicial</TableCell>
                      <TableCell className="text-right font-mono">R$ 0,00</TableCell>
                      <TableCell className="text-right font-mono">R$ 0,00</TableCell>
                      <TableCell className="text-right font-mono">R$ 0,00</TableCell>
                      <TableCell className="text-right font-mono font-bold">R$ 0,00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Integralização de Capital</TableCell>
                      <TableCell className="text-right font-mono">R$ 0,00</TableCell>
                      <TableCell className="text-right font-mono">-</TableCell>
                      <TableCell className="text-right font-mono">-</TableCell>
                      <TableCell className="text-right font-mono">R$ 0,00</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-medium">Saldo Final</TableCell>
                      <TableCell className="text-right font-mono">R$ 0,00</TableCell>
                      <TableCell className="text-right font-mono">R$ 0,00</TableCell>
                      <TableCell className="text-right font-mono">R$ 0,00</TableCell>
                      <TableCell className="text-right font-mono font-bold">R$ 0,00</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tabelas Auxiliares */}
        <TabsContent value="auxiliary" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Centro de Custos */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Centro de Custos</CardTitle>
                  <Button size="sm">
                    <Plus className="mr-2 h-3 w-3" />
                    Novo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {costCenters?.map((cc) => (
                    <div key={cc.id} className="flex justify-between items-center p-2 rounded hover:bg-muted/50">
                      <div>
                        <p className="font-medium">{cc.name}</p>
                        <p className="text-sm text-muted-foreground">{cc.code}</p>
                      </div>
                      <Badge variant={cc.is_active ? "default" : "secondary"}>
                        {cc.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Centro de Lucros */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Centro de Lucros</CardTitle>
                  <Button size="sm">
                    <Plus className="mr-2 h-3 w-3" />
                    Novo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {profitCenters?.map((pc) => (
                    <div key={pc.id} className="flex justify-between items-center p-2 rounded hover:bg-muted/50">
                      <div>
                        <p className="font-medium">{pc.name}</p>
                        <p className="text-sm text-muted-foreground">{pc.code}</p>
                      </div>
                      <Badge variant={pc.is_active ? "default" : "secondary"}>
                        {pc.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Projetos */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Projetos</CardTitle>
                  <Button size="sm">
                    <Plus className="mr-2 h-3 w-3" />
                    Novo Projeto
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Término</TableHead>
                        <TableHead>Orçamento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhum projeto cadastrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        projects?.map((project) => (
                          <TableRow key={project.id}>
                            <TableCell className="font-mono">{project.code}</TableCell>
                            <TableCell>{project.name}</TableCell>
                            <TableCell>
                              {project.customers?.company_name || 
                               `${project.customers?.first_name} ${project.customers?.last_name}`}
                            </TableCell>
                            <TableCell>
                              {project.start_date ? new Date(project.start_date).toLocaleDateString('pt-BR') : '-'}
                            </TableCell>
                            <TableCell>
                              {project.end_date ? new Date(project.end_date).toLocaleDateString('pt-BR') : '-'}
                            </TableCell>
                            <TableCell className="font-mono">
                              {project.budget_amount ? `R$ ${Number(project.budget_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                project.status === 'ATIVO' ? 'default' : 
                                project.status === 'CONCLUIDO' ? 'secondary' : 'destructive'
                              }>
                                {project.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}