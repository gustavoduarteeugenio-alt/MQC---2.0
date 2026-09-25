import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useExam } from "@/contexts/ExamContext";
import { Navigate, useLocation } from "react-router-dom";
import { Target } from "lucide-react";

// Telas de conta, que seguem acessíveis sem acesso ao curso
const ALLOW_WITHOUT_ACCESS = ["/sem-acesso", "/perfil"];
// Telas que fazem sentido antes de existir matrícula em um edital
const ALLOW_WITHOUT_ENROLLMENT = ["/escolher-concurso", "/sem-acesso", "/perfil"];

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: profileLoading } = useProfile();
  const { hasEnrollment, loading: examLoading } = useExam();
  const location = useLocation();

  if (authLoading || (user && (profileLoading || examLoading))) {
    return (
      <div className="app-shell flex items-center justify-center bg-gradient-dark">
        <Target className="w-10 h-10 text-primary animate-pulse-brand" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  if (!hasAccess && !ALLOW_WITHOUT_ACCESS.includes(location.pathname)) {
    return <Navigate to="/sem-acesso" replace />;
  }

  // Comprou, mas o produto não define o edital: quem escolhe é ele. Sem isto o
  // aluno entraria no app sem edital ativo e veria as telas vazias.
  if (hasAccess && !hasEnrollment && !ALLOW_WITHOUT_ENROLLMENT.includes(location.pathname)) {
    return <Navigate to="/escolher-concurso" replace />;
  }

  return children;
};
