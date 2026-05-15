import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Navigate, useLocation } from "react-router-dom";
import { Flame } from "lucide-react";

// Routes that remain accessible after trial expires (paywall + account)
const ALLOW_AFTER_TRIAL = ["/trial-expirado", "/planos", "/perfil"];

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: profileLoading } = useProfile();
  const location = useLocation();

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="app-shell flex items-center justify-center bg-gradient-night">
        <Flame className="w-10 h-10 text-primary animate-pulse-flame" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  if (!hasAccess && !ALLOW_AFTER_TRIAL.includes(location.pathname)) {
    return <Navigate to="/trial-expirado" replace />;
  }

  return children;
};
