import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    totalReceivables: 0,
    totalPayables: 0,
    balance: 0,
    customersCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      // Buscar transações
      const { data: transactions } = await supabase
        .from('transactions')
        .select('type, net_amount, payment_date');

      // Buscar clientes
      const { data: customers } = await supabase
        .from('customers')
        .select('id');

      let totalReceivables = 0;
      let totalPayables = 0;
      const today = new Date().toISOString().split('T')[0];

      transactions?.forEach((tx) => {
        // Considerar apenas transações futuras ou do mês atual
        if (!tx.payment_date || tx.payment_date >= today || 
            new Date(tx.payment_date).getMonth() === new Date().getMonth()) {
          if (tx.type === 'RECEIVABLE') {
            totalReceivables += Number(tx.net_amount);
          } else {
            totalPayables += Number(tx.net_amount);
          }
        }
      });

      setMetrics({
        totalReceivables,
        totalPayables,
        balance: totalReceivables - totalPayables,
        customersCount: customers?.length || 0,
      });
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const metricCards = [
    {
      title: 'Receitas a Receber',
      value: `R$ ${metrics.totalReceivables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      description: 'Total de receitas pendentes',
      icon: TrendingUp,
      gradient: 'gradient-success',
    },
    {
      title: 'Despesas a Pagar',
      value: `R$ ${metrics.totalPayables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      description: 'Total de despesas pendentes',
      icon: TrendingDown,
      gradient: 'gradient-danger',
    },
    {
      title: 'Saldo Projetado',
      value: `R$ ${metrics.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      description: 'Receitas - Despesas',
      icon: DollarSign,
      gradient: 'gradient-primary',
    },
    {
      title: 'Clientes Cadastrados',
      value: metrics.customersCount.toString(),
      description: 'Total de clientes ativos',
      icon: Users,
      gradient: 'gradient-primary',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-gradient-primary">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Visão geral das suas finanças
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metricCards.map((card) => (
              <Card key={card.title} className="relative overflow-hidden group hover:shadow-glow transition-all">
                <div className={`absolute inset-0 ${card.gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {card.title}
                  </CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <CardDescription className="text-xs">
                    {card.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo ao FinanceFlow</CardTitle>
            <CardDescription>
              Gerencie suas transações financeiras com facilidade e segurança
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use o menu lateral para navegar entre as diferentes funcionalidades da plataforma.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Registre transações com cálculo automático de impostos</li>
              <li>Cadastre clientes (Pessoa Física ou Jurídica)</li>
              <li>Visualize projeções de fluxo de caixa</li>
              <li>Todas as ações são auditadas e seguras</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
