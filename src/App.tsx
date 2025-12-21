import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Suppliers from "./pages/Suppliers";
import Customers from "./pages/Customers";
import Reports from "./pages/Reports";
import BankIntegrations from "./pages/BankIntegrations";
import Invoices from "./pages/Invoices";
import ResetPassword from "./pages/ResetPassword";
import CFOCockpit from "./pages/CFOCockpit";
import AccountantPortal from "./pages/AccountantPortal";
import ReformaTributaria from "./pages/ReformaTributaria";
import AIAgents from "./pages/AIAgents";
import PredictiveAnalytics from "./pages/PredictiveAnalytics";
import Cadastros from "./pages/Cadastros";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import PrivacySettings from "./pages/PrivacySettings";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import AccountingSettings from "./pages/AccountingSettings";
import AcceptInvite from "./pages/AcceptInvite";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <div className="h-12 w-12 rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accounting-settings"
              element={
                <ProtectedRoute>
                  <AccountingSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/privacy-settings"
              element={
                <ProtectedRoute>
                  <PrivacySettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cfo-cockpit"
              element={
                <ProtectedRoute>
                  <CFOCockpit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accountant-portal"
              element={
                <ProtectedRoute>
                  <AccountantPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <ProtectedRoute>
                  <Transactions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <Suppliers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bank-integrations"
              element={
                <ProtectedRoute>
                  <BankIntegrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reforma-tributaria"
              element={
                <ProtectedRoute>
                  <ReformaTributaria />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-agents"
              element={
                <ProtectedRoute>
                  <AIAgents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/predictive-analytics"
              element={
                <ProtectedRoute>
                  <PredictiveAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cadastros"
              element={
                <ProtectedRoute>
                  <Cadastros />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
