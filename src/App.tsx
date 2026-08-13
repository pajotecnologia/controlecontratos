import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { useEffect } from "react";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Vendedores from "./pages/Vendedores";
import Clientes from "./pages/Clientes";
import Financeiro from "./pages/Financeiro";
import Modelos from "./pages/Modelos";
import ModelosEditor from "./pages/ModelosEditor";
import Contratos from "./pages/Contratos";
import Propostas from "./pages/Propostas";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Usuarios from "./pages/Usuarios";
import ResetPassword from "./pages/ResetPassword";
import Mensagens from "./pages/Mensagens";
import Agendamentos from "./pages/Agendamentos";
import AssinarContrato from "./pages/AssinarContrato";
import AssinarProposta from "./pages/AssinarProposta";
import NotFound from "./pages/NotFound";

import { cleanLogoUrl } from "@/integrations/api/client";

const queryClient = new QueryClient();

// Define favicon and title from company settings
function CompanyBranding() {
  useEffect(() => {
    fetch("/api/public/company-info")
      .then((r) => r.json())
      .then((d) => {
        if (d?.name) document.title = d.name;
        if (d?.logo_url) {
          let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = cleanLogoUrl(d.logo_url);
        }
      })
      .catch(() => {});
  }, []);
  return null;
}

// Redirects de link curto para as rotas de assinatura
function RedirectAssinar() {
  const { token } = useParams<{ token: string }>();
  return <Navigate to={`/assinar/${token}`} replace />;
}
function RedirectAssinarProposta() {
  const { token } = useParams<{ token: string }>();
  return <Navigate to={`/assinar-proposta/${token}`} replace />;
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { session, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

const AppRoutes = () => {
  const { session, isLoading } = useAuth();

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;

  return (
    <Routes>
      <Route path="/auth" element={session ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/vendedores" element={<ProtectedRoute adminOnly><Vendedores /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute adminOnly><Clientes /></ProtectedRoute>} />
      <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
      <Route path="/modelos" element={<ProtectedRoute adminOnly><Modelos /></ProtectedRoute>} />
      <Route path="/modelos/novo" element={<ProtectedRoute adminOnly><ModelosEditor /></ProtectedRoute>} />
      <Route path="/modelos/:id/editar" element={<ProtectedRoute adminOnly><ModelosEditor /></ProtectedRoute>} />
      <Route path="/contratos" element={<ProtectedRoute adminOnly><Contratos /></ProtectedRoute>} />
      <Route path="/propostas" element={<ProtectedRoute adminOnly><Propostas /></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute adminOnly><Relatorios /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute adminOnly><Configuracoes /></ProtectedRoute>} />
      <Route path="/usuarios" element={<ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>} />
      <Route path="/mensagens" element={<ProtectedRoute adminOnly><Mensagens /></ProtectedRoute>} />
      <Route path="/agendamentos" element={<ProtectedRoute adminOnly><Agendamentos /></ProtectedRoute>} />
      <Route path="/assinar/:token" element={<AssinarContrato />} />
      <Route path="/assinar-proposta/:token" element={<AssinarProposta />} />
      <Route path="/a/:token" element={<RedirectAssinar />} />
      <Route path="/p/:token" element={<RedirectAssinarProposta />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CompanyBranding />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
