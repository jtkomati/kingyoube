import { createContext, useContext, ReactNode } from 'react';
import { useAuth, Organization } from '@/hooks/useAuth';

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  switchOrganization: (id: string) => void;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { 
    userOrganizations, 
    currentOrganization, 
    switchOrganization,
    loading 
  } = useAuth();

  return (
    <OrganizationContext.Provider value={{
      organizations: userOrganizations,
      currentOrganization,
      switchOrganization,
      isLoading: loading,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}
