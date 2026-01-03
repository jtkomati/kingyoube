import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, LogOut, BarChart3, Link2, Receipt, Calculator, Bot, BrainCircuit, Database, Building2, Activity, Brain, Cog } from 'lucide-react';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
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
import { ThemeToggle } from '@/components/ui/theme-toggle';
import kingyoubeLogo from '@/assets/kingyoube-logo-full.png';

type NavItem = {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRole?: string;
};

const navigation: NavItem[] = [
  { key: 'accountantPortal', href: '/accountant-portal', icon: Building2 },
  { key: 'aiAgents', href: '/ai-agents', icon: Bot },
  { key: 'dashboard', href: '/dashboard', icon: Home },
  { key: 'cfoCockpit', href: '/cfo-cockpit', icon: BarChart3 },
  { key: 'cadastros', href: '/cadastros', icon: Database },
  { key: 'transactions', href: '/transactions', icon: FileText },
  { key: 'invoices', href: '/invoices', icon: Receipt },
  { key: 'reports', href: '/reports', icon: BarChart3 },
  { key: 'predictiveAnalytics', href: '/predictive-analytics', icon: BrainCircuit },
  { key: 'integrations', href: '/bank-integrations', icon: Link2 },
  { key: 'taxReform', href: '/reforma-tributaria', icon: Calculator },
  { key: 'observability', href: '/observability', icon: Activity, requiredRole: 'SUPERADMIN' },
  { key: 'aiCommandCenter', href: '/ai-command-center', icon: Brain, requiredRole: 'SUPERADMIN' },
  { key: 'businessRules', href: '/admin/rules', icon: Cog, requiredRole: 'ADMIN' },
];

export function AppSidebar() {
  const { signOut, userRole } = useAuth();
  const location = useLocation();
  const { open } = useSidebar();
  const { language } = useLanguage();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-center px-3 py-6">
          {open && (
            <img 
              src={kingyoubeLogo} 
              alt="KingYouBe" 
              className="h-20 w-auto object-contain"
              style={{ imageRendering: 'crisp-edges' }}
            />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t(language, 'common', 'menu')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation
                .filter((item) => !item.requiredRole || userRole === item.requiredRole)
                .map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{t(language, 'sidebar', item.key)}</span>
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
          <OrganizationSwitcher />
          {open && (
            <div className="px-2 py-2 rounded-lg bg-sidebar-accent">
              <p className="text-xs text-sidebar-foreground/70">{t(language, 'common', 'permission')}</p>
              <p className="text-sm font-medium text-sidebar-foreground">{userRole}</p>
            </div>
          )}
          <div className={`flex ${open ? 'justify-start px-2' : 'justify-center'}`}>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            <span className="ml-2">{t(language, 'common', 'logout')}</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
