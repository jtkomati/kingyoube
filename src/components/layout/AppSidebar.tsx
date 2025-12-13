import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, Users, TrendingUp, LogOut, BarChart3, Link2, GitCompare, Receipt, Calculator, Building2, Bot } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import kingyoubeLogo from '@/assets/kingyoube-logo-full.png';

const navigation = [
  { name: 'Agentes de IA', href: '/ai-agents', icon: Bot },
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Cockpit CFO', href: '/cfo-cockpit', icon: BarChart3 },
  { name: 'Transações', href: '/transactions', icon: FileText },
  { name: 'Notas Fiscais', href: '/invoices', icon: Receipt },
  { name: 'Fluxo de Caixa', href: '/cash-flow', icon: TrendingUp },
  { name: 'Clientes', href: '/customers', icon: Users },
  { name: 'Fornecedores', href: '/suppliers', icon: Users },
  { name: 'Relatórios', href: '/reports', icon: BarChart3 },
  { name: 'Integrações', href: '/bank-integrations', icon: Link2 },
  { name: 'Conciliação', href: '/reconciliation', icon: GitCompare },
  { name: 'Open Finance', href: '/open-finance', icon: Building2 },
  { name: 'Reforma Tributária', href: '/reforma-tributaria', icon: Calculator },
];

export function AppSidebar() {
  const { signOut, userRole } = useAuth();
  const location = useLocation();
  const { open } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-center px-2 py-4">
          {open && (
            <img 
              src={kingyoubeLogo} 
              alt="KingYouBe" 
              className="h-10 w-auto"
            />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-2 space-y-2">
          {open && (
            <div className="px-2 py-2 rounded-lg bg-sidebar-accent">
              <p className="text-xs text-sidebar-foreground/70">Permissão</p>
              <p className="text-sm font-medium text-sidebar-foreground">{userRole}</p>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            <span className="ml-2">Sair</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
