import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

export function OrganizationSwitcher() {
  const { userOrganizations, currentOrganization, switchOrganization } = useAuth();
  const { open } = useSidebar();

  // Não renderiza se não houver organizações
  if (userOrganizations.length === 0) return null;

  // Se só tem uma organização, mostra apenas info (sem dropdown)
  if (userOrganizations.length === 1) {
    return (
      <div className="px-2 py-2 rounded-lg bg-sidebar-accent">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-sidebar-foreground/70 shrink-0" />
          {open && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {currentOrganization?.nome_fantasia || currentOrganization?.company_name}
              </p>
              <p className="text-xs text-sidebar-foreground/70 truncate">
                {currentOrganization?.cnpj ? formatCNPJ(currentOrganization.cnpj) : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Múltiplas organizações - mostra dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2 h-auto py-2"
        >
          <Building2 className="h-4 w-4 shrink-0" />
          {open && (
            <>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {currentOrganization?.nome_fantasia || currentOrganization?.company_name || 'Selecionar'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentOrganization?.cnpj ? formatCNPJ(currentOrganization.cnpj) : ''}
                </p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 bg-popover">
        <DropdownMenuLabel>Trocar Organização</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {userOrganizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => switchOrganization(org.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {org.nome_fantasia || org.company_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                CNPJ: {formatCNPJ(org.cnpj)}
              </p>
            </div>
            {currentOrganization?.id === org.id && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
            {org.is_default && (
              <Badge variant="secondary" className="text-xs shrink-0">
                Padrão
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
