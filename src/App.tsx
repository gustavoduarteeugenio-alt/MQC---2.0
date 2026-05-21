import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/inicio" : "/diagnostico"} replace />;
};
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import Subjects from "./pages/Subjects.tsx";
import Question from "./pages/Question.tsx";
import TrainingSummary from "./pages/TrainingSummary.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Plans from "./pages/Plans.tsx";
import Profile from "./pages/Profile.tsx";
import Admin from "./pages/Admin.tsx";
import Simulados from "./pages/Simulados.tsx";
import SimuladoRunner from "./pages/SimuladoRunner.tsx";
import TrialExpired from "./pages/TrialExpired.tsx";
import Support from "./pages/Support.tsx";
import Diagnostico from "./pages/Diagnostico.tsx";
import SelecionarPlano from "./pages/SelecionarPlano.tsx";
import Ranking from "./pages/Ranking.tsx";
import NotFound from "./pages/NotFound.tsx";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/diagnostico" element={<Diagnostico />} />
            <Route path="/recuperar-senha" element={<ForgotPassword />} />
            <Route path="/trial-expirado" element={<ProtectedRoute><TrialExpired /></ProtectedRoute>} />
            <Route path="/selecionar-plano" element={<ProtectedRoute><SelecionarPlano /></ProtectedRoute>} />
            <Route path="/" element={<RootRedirect />} />
            <Route path="/inicio" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/materias" element={<ProtectedRoute><Subjects /></ProtectedRoute>} />
            <Route path="/questao/:slug" element={<ProtectedRoute><Question /></ProtectedRoute>} />
            <Route path="/treino/resumo" element={<ProtectedRoute><TrainingSummary /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/planos" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/suporte" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="/simulados" element={<ProtectedRoute><Simulados /></ProtectedRoute>} />
            <Route path="/simulado/:id" element={<ProtectedRoute><SimuladoRunner /></ProtectedRoute>} />
            <Route path="/simulado/:id/revisar" element={<ProtectedRoute><SimuladoRunner /></ProtectedRoute>} />
            <Route path="/ranking" element={<ProtectedRoute><Ranking /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
