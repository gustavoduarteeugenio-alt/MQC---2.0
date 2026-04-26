import { NavLink, useLocation } from "react-router-dom";
import { Home, BookOpen, BarChart3, User, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Início", icon: Home },
  { to: "/materias", label: "Matérias", icon: BookOpen },
  { to: "/dashboard", label: "Progresso", icon: BarChart3 },
  { to: "/planos", label: "Premium", icon: Crown },
  { to: "/perfil", label: "Perfil", icon: User },
];

export const BottomNav = () => {
  const location = useLocation();
  // Esconde em telas de questão para foco
  if (location.pathname.startsWith("/questao")) return null;
  if (location.pathname.startsWith("/auth")) return null;
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur border-t border-border z-40">
      <ul className="grid grid-cols-5 px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] stencil transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn("p-1.5 rounded-lg transition-all", isActive && "bg-primary/10")}>
                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
