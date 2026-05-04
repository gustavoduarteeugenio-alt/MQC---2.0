import { Megaphone, Crown } from "lucide-react";
import { usePremiumFeatures } from "@/hooks/usePremiumFeatures";
import { PlanSelectionDialog } from "./PlanSelectionDialog";

/**
 * Banner de anúncio exibido apenas para usuários do plano básico.
 * Para Premium, retorna null automaticamente.
 */
export const AdBanner = ({ className = "" }: { className?: string }) => {
  const { showAds } = usePremiumFeatures();
  if (!showAds) return null;

  return (
    <PlanSelectionDialog>
      <button
        type="button"
        className={`w-full text-left bg-secondary text-secondary-foreground border border-border rounded-2xl p-4 shadow-card flex items-center gap-3 active:scale-[0.99] transition-transform ${className}`}
      >
        <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
          <Megaphone className="w-5 h-5 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="stencil text-[10px] opacity-80">Patrocínio · Anúncio</p>
          <p className="font-display font-bold text-sm leading-tight">
            Remova anúncios e libere tudo
          </p>
          <p className="text-[11px] opacity-80 mt-0.5">
            Toque para virar Premium
          </p>
        </div>
        <Crown className="w-5 h-5 text-warning shrink-0" />
      </button>
    </PlanSelectionDialog>
  );
};
