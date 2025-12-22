import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyError, isRetryableError, shouldLogError } from '@/lib/errorMessages';

export interface Organization {
  id: string;
  company_name: string;
  nome_fantasia: string | null;
  cnpj: string;
  status: string | null;
  is_default: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Setup auth listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      // Defer Supabase calls to avoid deadlock
      if (newSession?.user) {
        setTimeout(() => {
          fetchUserRole(newSession.user.id);
          fetchUserOrganizations(newSession.user.id);
        }, 0);
      } else {
        setUserRole(null);
        setUserOrganizations([]);
        setCurrentOrganization(null);
      }
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchUserRole(currentSession.user.id);
        fetchUserOrganizations(currentSession.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // Only log non-sensitive errors
      if (shouldLogError(error)) {
        console.error('Erro ao buscar role:', error);
      }
      return;
    }

    setUserRole(data?.role ?? 'VIEWER');
  };

  const fetchUserOrganizations = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_organizations')
      .select(`
        is_default,
        organization_id,
        company_settings (
          id,
          company_name,
          nome_fantasia,
          cnpj,
          status
        )
      `)
      .eq('user_id', userId);

    if (error) {
      if (shouldLogError(error)) {
        console.error('Erro ao buscar organizações:', error);
      }
      return;
    }

    // Map data to Organization interface
    const organizations: Organization[] = (data ?? [])
      .filter((item: any) => item.company_settings)
      .map((item: any) => ({
        id: item.company_settings.id,
        company_name: item.company_settings.company_name,
        nome_fantasia: item.company_settings.nome_fantasia,
        cnpj: item.company_settings.cnpj,
        status: item.company_settings.status,
        is_default: item.is_default ?? false,
      }));

    setUserOrganizations(organizations);

    // Restore from localStorage or use default
    const savedOrgId = localStorage.getItem('currentOrganizationId');
    const savedOrg = savedOrgId ? organizations.find(org => org.id === savedOrgId) : null;
    const defaultOrg = savedOrg || organizations.find(org => org.is_default) || organizations[0];
    
    if (defaultOrg) {
      setCurrentOrganization(defaultOrg);
      // Garantir que localStorage esteja sempre sincronizado com a organização atual
      localStorage.setItem('currentOrganizationId', defaultOrg.id);
    }
  };

  const switchOrganization = (organizationId: string) => {
    const org = userOrganizations.find(o => o.id === organizationId);
    if (org) {
      setCurrentOrganization(org);
      localStorage.setItem('currentOrganizationId', organizationId);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: 'Login realizado',
        description: 'Bem-vindo de volta!',
      });
      return true;
    } catch (error: any) {
      const friendlyError = getFriendlyError(error);
      
      toast({
        variant: 'destructive',
        title: friendlyError.title,
        description: friendlyError.message,
      });
      
      // Only log non-sensitive errors
      if (shouldLogError(error)) {
        console.error('Sign in error:', error);
      }
      
      return false;
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phoneNumber?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
          },
        },
      });

      if (error) {
        console.error('Signup error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });
        throw error;
      }

      // Verificar se o usuário foi criado com sucesso
      if (!data.user) {
        throw new Error('Failed to create user');
      }

      toast({
        title: 'Conta criada com sucesso!',
        description: 'Você já pode fazer login.',
      });
      return true;
    } catch (error: any) {
      const friendlyError = getFriendlyError(error);
      
      // Mensagem mais específica baseada no erro
      let errorDescription = friendlyError.message;
      
      if (error?.message?.includes('already registered')) {
        errorDescription = 'Este email já está em uso. Tente fazer login ou usar outro email.';
      } else if (error?.message?.includes('password')) {
        errorDescription = 'A senha não atende aos requisitos de segurança. Use pelo menos 8 caracteres com letras maiúsculas, minúsculas, números e caracteres especiais.';
      } else if (error?.message?.includes('email')) {
        errorDescription = 'O email informado é inválido. Verifique e tente novamente.';
      }
      
      toast({
        variant: 'destructive',
        title: friendlyError.title,
        description: errorDescription,
        duration: 7000,
      });
      
      // Only log non-sensitive errors
      if (shouldLogError(error)) {
        console.error('Sign up error:', error);
      }
      
      return false;
    }
  };

  const signOut = async () => {
    // IMMEDIATELY clear all local state first
    setSession(null);
    setUser(null);
    setUserRole(null);
    setUserOrganizations([]);
    setCurrentOrganization(null);
    localStorage.removeItem('currentOrganizationId');
    setLoading(false);
    
    // Then call Supabase to clear server session
    try {
      await supabase.auth.signOut();
    } catch (error: any) {
      // Ignore errors - we already cleared local state
      if (shouldLogError(error) && !error?.message?.includes('session')) {
        console.error('Sign out error:', error);
      }
    }
    
    toast({
      title: 'Até logo!',
      description: 'Você foi desconectado.',
    });
  };

  const hasPermission = (requiredRole: string): boolean => {
    if (!userRole) return false;

    const roleHierarchy: { [key: string]: number } = {
      VIEWER: 1,
      FISCAL: 2,
      FINANCEIRO: 3,
      ADMIN: 4,
      SUPERADMIN: 5,
    };

    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  };

  return {
    user,
    session,
    userRole,
    loading,
    signIn,
    signUp,
    signOut,
    hasPermission,
    userOrganizations,
    currentOrganization,
    switchOrganization,
  };
}
