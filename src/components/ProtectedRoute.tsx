import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Navigate, useLocation } from "react-router-dom";
import { Flame } from "lucide-react";

// Routes that remain accessible without course access (account screens)
const ALLOW_WITHOUT_ACCESS = ["/sem-acesso", "/perfil"];

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: profileLoading } = useProfile();
  const location = useLocation();

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="app-shell flex items-center justify-center bg-gradient-dark">
        <Flame className="w-10 h-10 text-primary animate-pulse-brand" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  if (!hasAccess && !ALLOW_WITHOUT_ACCESS.includes(location.pathname)) {
    return <Navigate to="/sem-acesso" replace />;
  }

  return children;
};
