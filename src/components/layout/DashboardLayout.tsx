import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Home, FileText, Users, TrendingUp, LogOut, Bird, BarChart3, Link2, GitCompare, Receipt } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut, userRole, hasPermission } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Cockpit CFO', href: '/cfo-cockpit', icon: BarChart3 },
    { name: 'Transações', href: '/transactions', icon: FileText },
    { name: 'Notas Fiscais', href: '/invoices', icon: Receipt, permission: 'FISCAL' },
    { name: 'Fluxo de Caixa', href: '/cash-flow', icon: TrendingUp },
    { name: 'Clientes', href: '/customers', icon: Users },
    { name: 'Fornecedores', href: '/suppliers', icon: Users, permission: 'FINANCEIRO' },
    { name: 'Relatórios', href: '/reports', icon: BarChart3 },
    { name: 'Integrações', href: '/bank-integrations', icon: Link2, permission: 'ADMIN' },
    { name: 'Conciliação', href: '/reconciliation', icon: GitCompare, permission: 'FINANCEIRO' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed top-0 left-0 z-40 w-64 h-screen border-r border-border bg-card">
        <div className="h-full px-3 py-4 overflow-y-auto">
          <div className="mb-10 flex items-center px-3">
            <Bird className="h-8 w-8 text-primary mr-2" />
            <span className="text-2xl font-bold text-gradient-primary">
              FAS AI
            </span>
          </div>
          <ul className="space-y-2 font-medium">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const canView = !item.permission || hasPermission(item.permission);
              
              if (!canView) return null;

              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`flex items-center p-2 rounded-lg group transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 transition duration-75 ${
                      isActive ? '' : 'text-muted-foreground group-hover:text-foreground'
                    }`} />
                    <span className="ml-3">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="absolute bottom-4 left-0 w-full px-3">
            <div className="px-3 py-2 mb-2 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground">Permissão</p>
              <p className="text-sm font-medium">{userRole}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={signOut}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <div className="ml-64">
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
