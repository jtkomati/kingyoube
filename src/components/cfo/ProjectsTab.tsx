import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Clock, TrendingDown, TrendingUp, DollarSign, AlertTriangle } from "lucide-react";

interface Project {
  id: string;
  name: string;
  code: string;
  budget_amount: number;
  budget_hours: number;
  hourly_rate: number;
  total_billed: number;
  total_hours_logged: number;
  status: string;
  customers: {
    company_name?: string;
    first_name?: string;
    last_name?: string;
  };
}

export function ProjectsTab({ cfoPartnerId }: { cfoPartnerId: string }) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [timesheetDialogOpen, setTimesheetDialogOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ['cfo-projects', cfoPartnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_projects')
        .select(`
          id,
          name,
          code,
          budget_amount,
          budget_hours,
          hourly_rate,
          total_billed,
          total_hours_logged,
          status,
          customers (
            company_name,
            first_name,
            last_name
          )
        `)
        .eq('status', 'ATIVO')
        .not('budget_hours', 'is', null)
        .order('name');

      if (error) throw error;
      return data as Project[];
    }
  });

  const handleSubmitTimesheet = async () => {
    if (!selectedProject || !hours) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from('project_time_entries')
      .insert({
        project_id: selectedProject.id,
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        hours: parseFloat(hours),
        description: description || null,
        billable: true
      });

    if (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Horas registradas com sucesso"
    });

    setTimesheetDialogOpen(false);
    setHours("");
    setDescription("");
    refetch();
  };

  const getMarginStatus = (project: Project) => {
    if (!project.budget_hours) return { status: 'N/A', color: 'gray', icon: null };
    
    const hoursConsumedPct = (project.total_hours_logged / project.budget_hours) * 100;
    const invoicedPct = project.budget_amount > 0 ? (project.total_billed / project.budget_amount) * 100 : 0;
    const marginGap = invoicedPct - hoursConsumedPct;

    if (marginGap <= -20 && hoursConsumedPct >= 90) {
      return { status: 'CRÍTICO', color: 'destructive', icon: <AlertTriangle className="h-4 w-4" /> };
    } else if (marginGap <= -10 && hoursConsumedPct >= 80) {
      return { status: 'ATENÇÃO', color: 'warning', icon: <TrendingDown className="h-4 w-4" /> };
    } else if (marginGap >= 10) {
      return { status: 'SAUDÁVEL', color: 'success', icon: <TrendingUp className="h-4 w-4" /> };
    }
    return { status: 'NORMAL', color: 'secondary', icon: null };
  };

  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.customers?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalHoursSaved = filteredProjects?.reduce((sum, p) => {
    const remaining = (p.budget_hours || 0) - (p.total_hours_logged || 0);
    return sum + Math.max(0, remaining);
  }, 0) || 0;

  const totalRevenue = filteredProjects?.reduce((sum, p) => sum + (p.total_billed || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredProjects?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Disponíveis</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursSaved.toFixed(1)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar projetos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lucratividade por Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Orçado (h)</TableHead>
                <TableHead className="text-right">Consumido (h)</TableHead>
                <TableHead className="text-right">% Consumo</TableHead>
                <TableHead className="text-right">Faturado</TableHead>
                <TableHead className="text-right">% Faturamento</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects?.map((project) => {
                const hoursConsumedPct = project.budget_hours > 0 
                  ? (project.total_hours_logged / project.budget_hours) * 100 
                  : 0;
                const invoicedPct = project.budget_amount > 0 
                  ? (project.total_billed / project.budget_amount) * 100 
                  : 0;
                const marginGap = invoicedPct - hoursConsumedPct;
                const marginStatus = getMarginStatus(project);
                
                const customerName = project.customers?.company_name || 
                  `${project.customers?.first_name || ''} ${project.customers?.last_name || ''}`.trim() ||
                  'N/A';

                return (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{customerName}</TableCell>
                    <TableCell className="text-right">{project.budget_hours?.toFixed(1) || 'N/A'}</TableCell>
                    <TableCell className="text-right">{project.total_hours_logged?.toFixed(1) || '0.0'}</TableCell>
                    <TableCell className="text-right">
                      <span className={hoursConsumedPct > 90 ? 'text-destructive font-semibold' : ''}>
                        {hoursConsumedPct.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {(project.total_billed || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell className="text-right">{invoicedPct.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">
                      <span className={marginGap < -10 ? 'text-destructive font-semibold' : marginGap > 10 ? 'text-green-600 font-semibold' : ''}>
                        {marginGap.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={marginStatus.color as any} className="flex items-center gap-1 justify-center">
                        {marginStatus.icon}
                        {marginStatus.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Dialog open={timesheetDialogOpen && selectedProject?.id === project.id} onOpenChange={(open) => {
                        setTimesheetDialogOpen(open);
                        if (open) setSelectedProject(project);
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            Registrar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Registrar Horas - {project.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="hours">Horas Trabalhadas *</Label>
                              <Input
                                id="hours"
                                type="number"
                                step="0.5"
                                min="0.5"
                                max="24"
                                value={hours}
                                onChange={(e) => setHours(e.target.value)}
                                placeholder="Ex: 2.5"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="description">Descrição</Label>
                              <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="O que foi feito?"
                              />
                            </div>
                            <Button onClick={handleSubmitTimesheet} className="w-full">
                              Salvar Registro
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {(!filteredProjects || filteredProjects.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum projeto encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
