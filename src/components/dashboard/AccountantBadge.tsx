import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Building2, Shield, Check, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AccountantInfo {
  firmName: string | null;
  crc: string | null;
  email: string | null;
  linkedAt: string | null;
}

export const AccountantBadge = () => {
  const { currentOrganization } = useAuth();
  const [accountant, setAccountant] = useState<AccountantInfo | null>(null);
  const [hasPending, setHasPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization?.id) {
      loadAccountantData();
    }
  }, [currentOrganization?.id]);

  const loadAccountantData = async () => {
    if (!currentOrganization?.id) return;

    try {
      const { data: company } = await supabase
        .from('company_settings')
        .select('accountant_email, accountant_crc, accountant_firm_name, accountant_linked_at, accountant_user_id')
        .eq('id', currentOrganization.id)
        .single();

      if (company?.accountant_user_id) {
        setAccountant({
          firmName: company.accountant_firm_name,
          crc: company.accountant_crc,
          email: company.accountant_email,
          linkedAt: company.accountant_linked_at
        });
      } else {
        // Verificar se há convite pendente
        const { data: invitations } = await supabase
          .from('invitations')
          .select('id')
          .eq('organization_id', currentOrganization.id)
          .eq('status', 'pending')
          .limit(1);

        setHasPending(invitations && invitations.length > 0);
      }
    } catch (error) {
      console.error('Error loading accountant data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  // Não mostrar se não há contador nem convite pendente
  if (!accountant && !hasPending) return null;

  return (
    <Link to="/accounting-settings">
      <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              accountant ? 'bg-green-500/10' : 'bg-yellow-500/10'
            }`}>
              {accountant ? (
                <Shield className="w-5 h-5 text-green-500" />
              ) : (
                <Clock className="w-5 h-5 text-yellow-500" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {accountant ? accountant.firmName || 'Contador Vinculado' : 'Convite Pendente'}
                </span>
                {accountant ? (
                  <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
                    <Check className="w-3 h-3 mr-1" />
                    Vinculado
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    Pendente
                  </Badge>
                )}
              </div>
              {accountant?.crc && (
                <span className="text-xs text-muted-foreground font-mono">
                  CRC: {accountant.crc}
                </span>
              )}
            </div>

            <Building2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
