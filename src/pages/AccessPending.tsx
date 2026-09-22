import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Loader2, LogOut, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AccessFields, formatAccessDate, hasActiveAccess } from "@/lib/access";
import { toast } from "sonner";

// Usuário logado sem acesso: sem compra aprovada, compra reembolsada ou prazo de 1 ano vencido.
const AccessPending = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, accessExpired } = useProfile();
  const [checking, setChecking] = useState(false);

  const checkAgain = async () => {
    if (!user) return;
    setChecking(true);
    const { data } = await supabase
      .from("profiles")
      .select("approved, access_until" as any)
      .eq("user_id", user.id)
      .maybeSingle();
    setChecking(false);
    if (hasActiveAccess(data as AccessFields | null)) {
      // Recarrega para que as rotas protegidas leiam o perfil atualizado
      window.location.assign("/");
      return;
    }
    toast.error("Ainda não encontramos uma compra ativa para este e-mail.");
  };

  // Leva para o card de suporte da tela de login, que abre um ticket de liberação
  const contactSupport = async () => {
    if (user?.email) localStorage.setItem("pending_approval_email", user.email);
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="app-shell bg-gradient-dark text-white flex flex-col">
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-10 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-brand shadow-brand mb-5">
          <Flame className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
        {accessExpired && profile?.access_until ? (
          <>
            <p className="stencil text-xs text-primary">Acesso encerrado</p>
            <h1 className="text-3xl font-display font-bold tracking-wide mt-2">
              Seu prazo de 1 ano terminou
            </h1>
            <p className="text-sm text-white/75 mt-4 max-w-sm leading-relaxed">
              Seu acesso ao app foi até {formatAccessDate(profile.access_until)}. Renove a matrícula do curso na Hotmart
              com o e-mail <span className="text-white font-semibold">{user?.email}</span> e o acesso é liberado automaticamente.
            </p>
          </>
        ) : (
          <>
            <p className="stencil text-xs text-primary">Acesso não liberado</p>
            <h1 className="text-3xl font-display font-bold tracking-wide mt-2">
              Aguardando sua matrícula
            </h1>
            <p className="text-sm text-white/75 mt-4 max-w-sm leading-relaxed">
              O acesso ao app é liberado automaticamente quando a compra do curso é aprovada na Hotmart.
              Use o mesmo e-mail da compra: <span className="text-white font-semibold">{user?.email}</span>
            </p>
          </>
        )}

        <div className="mt-8 w-full max-w-sm space-y-3">
          <Button
            onClick={checkAgain}
            disabled={checking}
            className="w-full h-12 bg-gradient-brand hover:opacity-95 text-white font-display tracking-wider shadow-brand stencil"
          >
            {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-2" /> Verificar novamente</>}
          </Button>
          <Button
            variant="outline"
            onClick={contactSupport}
            className="w-full h-11 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white stencil"
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Comprei com outro e-mail
          </Button>
        </div>
      </div>

      <footer className="px-6 pb-6 flex justify-center">
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition"
        >
          <LogOut className="w-3.5 h-3.5" /> Sair da conta
        </button>
      </footer>
    </div>
  );
};

export default AccessPending;
