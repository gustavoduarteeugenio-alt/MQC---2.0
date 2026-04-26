import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Flame } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center bg-gradient-night">
        <Flame className="w-10 h-10 text-primary animate-pulse-flame" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return children;
};
