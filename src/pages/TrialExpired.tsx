import { Crown, Flame, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { PlanSelectionDialog } from "@/components/PlanSelectionDialog";

const TrialExpired = () => {
  const { signOut } = useAuth();
  return (
    <div className="app-shell bg-gradient-night text-white flex flex-col">
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-10 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-flame shadow-flame mb-5">
          <Flame className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
        <p className="stencil text-xs text-primary">Acesso bloqueado</p>
        <h1 className="text-3xl font-display font-bold tracking-wide mt-2">
          Período de Teste Encerrado
        </h1>
        <p className="text-sm text-white/75 mt-4 max-w-sm leading-relaxed">
          Sua jornada não pode parar agora. Recupere seu acesso à análise personalizada e ao banco
          de questões completo.
        </p>

        <div className="mt-8 w-full max-w-sm space-y-3">
          <PlanSelectionDialog>
            <Button className="w-full h-14 bg-gradient-flame hover:opacity-95 text-white font-display text-base tracking-wider shadow-flame stencil">
              <Crown className="w-5 h-5 mr-2 text-warning" />
              Tornar-se Premium
            </Button>
          </PlanSelectionDialog>
          <p className="text-[11px] text-white/50">
            Pagamento seguro processado pela Kiwify.
          </p>
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

export default TrialExpired;
