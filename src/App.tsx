import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";

// Eagerly loaded - critical path
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy loaded - secondary pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Customers = lazy(() => import("./pages/Customers"));
const Reports = lazy(() => import("./pages/Reports"));
const BankIntegrations = lazy(() => import("./pages/BankIntegrations"));
const Invoices = lazy(() => import("./pages/Invoices"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CFOCockpit = lazy(() => import("./pages/CFOCockpit"));
const AccountantPortal = lazy(() => import("./pages/AccountantPortal"));
const ReformaTributaria = lazy(() => import("./pages/ReformaTributaria"));
const AIAgents = lazy(() => import("./pages/AIAgents"));
const PredictiveAnalytics = lazy(() => import("./pages/PredictiveAnalytics"));
const Cadastros = lazy(() => import("./pages/Cadastros"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const PrivacySettings = lazy(() => import("./pages/PrivacySettings"));
const Terms = lazy(() => import("./pages/Terms"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AccountingSettings = lazy(() => import("./pages/AccountingSettings"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Observability = lazy(() => import("./pages/Observability"));
const AICommandCenter = lazy(() => import("./pages/AICommandCenter"));
const PluggyConnectPopup = lazy(() => import("./pages/PluggyConnectPopup"));

// Global query client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

// Loading fallback for lazy routes
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const { user, loading, userRole } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Wrapper for lazy loaded protected routes
function LazyProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  return (
    <ProtectedRoute requiredRole={requiredRole}>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ProtectedRoute>
  );
}

// Wrapper for lazy loaded public routes
function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <OrganizationProvider>
          <BrowserRouter>
            <TooltipProvider>
              <Toaster />
            <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/reset-password" element={<LazyRoute><ResetPassword /></LazyRoute>} />
            <Route path="/privacy-policy" element={<LazyRoute><PrivacyPolicy /></LazyRoute>} />
            <Route path="/terms" element={<LazyRoute><Terms /></LazyRoute>} />
            <Route path="/accept-invite" element={<LazyRoute><AcceptInvite /></LazyRoute>} />
            <Route path="/pluggy/connect" element={<LazyRoute><PluggyConnectPopup /></LazyRoute>} />
            <Route
              path="/onboarding"
              element={<LazyProtectedRoute><Onboarding /></LazyProtectedRoute>}
            />
            <Route
              path="/accounting-settings"
              element={<LazyProtectedRoute><AccountingSettings /></LazyProtectedRoute>}
            />
            <Route
              path="/privacy-settings"
              element={<LazyProtectedRoute><PrivacySettings /></LazyProtectedRoute>}
            />
            <Route
              path="/cfo-cockpit"
              element={<LazyProtectedRoute><CFOCockpit /></LazyProtectedRoute>}
            />
            <Route
              path="/accountant-portal"
              element={<LazyProtectedRoute><AccountantPortal /></LazyProtectedRoute>}
            />
            <Route
              path="/dashboard"
              element={<LazyProtectedRoute><Dashboard /></LazyProtectedRoute>}
            />
            <Route
              path="/transactions"
              element={<LazyProtectedRoute><Transactions /></LazyProtectedRoute>}
            />
            <Route
              path="/suppliers"
              element={<LazyProtectedRoute><Suppliers /></LazyProtectedRoute>}
            />
            <Route
              path="/customers"
              element={<LazyProtectedRoute><Customers /></LazyProtectedRoute>}
            />
            <Route
              path="/reports"
              element={<LazyProtectedRoute><Reports /></LazyProtectedRoute>}
            />
            <Route
              path="/bank-integrations"
              element={<LazyProtectedRoute><BankIntegrations /></LazyProtectedRoute>}
            />
            <Route
              path="/invoices"
              element={<LazyProtectedRoute><Invoices /></LazyProtectedRoute>}
            />
            <Route
              path="/reforma-tributaria"
              element={<LazyProtectedRoute><ReformaTributaria /></LazyProtectedRoute>}
            />
            <Route
              path="/ai-agents"
              element={<LazyProtectedRoute><AIAgents /></LazyProtectedRoute>}
            />
            <Route
              path="/predictive-analytics"
              element={<LazyProtectedRoute><PredictiveAnalytics /></LazyProtectedRoute>}
            />
            <Route
              path="/cadastros"
              element={<LazyProtectedRoute><Cadastros /></LazyProtectedRoute>}
            />
            <Route
              path="/observability"
              element={<LazyProtectedRoute requiredRole="SUPERADMIN"><Observability /></LazyProtectedRoute>}
            />
            <Route
              path="/ai-command-center"
              element={<LazyProtectedRoute requiredRole="SUPERADMIN"><AICommandCenter /></LazyProtectedRoute>}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
            </TooltipProvider>
          </BrowserRouter>
        </OrganizationProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;
