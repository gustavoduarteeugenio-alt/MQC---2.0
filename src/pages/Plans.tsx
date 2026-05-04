import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Crown, Check, X, Flame, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { PlanSelectionDialog } from "@/components/PlanSelectionDialog";

const Plans = () => {
  const { user } = useAuth();
  const { profile, isPremium, refresh } = useProfile();
  const [loading, setLoading] = useState(false);

  const activate = async () => {
    if (!user) return;
    setLoading(true);
    // Demonstração — em produção, integrar com gateway de pagamento.
    const until = new Date();
    until.setMonth(until.getMonth() + 1);
    const { error } = await supabase.from("profiles")
      .update({ plan: "premium", premium_until: until.toISOString() })
      .eq("user_id", user.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Plano Premium ativado por 30 dias (demo).");
    refresh();
  };

  const cancel = async () => {
    if (!user) return;
    setLoading(true);
    await supabase.from("profiles").update({ plan: "basic", premium_until: null }).eq("user_id", user.id);
    setLoading(false);
    toast.success("Voltou para o plano básico.");
    refresh();
  };

  return (
    <AppShell>
      <header className="bg-gradient-night text-white px-5 pt-12 pb-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          background: "radial-gradient(500px 200px at 50% 0%, hsl(38 100% 60%/0.6), transparent 60%)"
        }} />
        <div className="relative text-center">
          <Crown className="w-10 h-10 mx-auto text-warning" />
          <h1 className="text-2xl font-display font-bold mt-2">Vire Premium</h1>
          <p className="text-sm text-white/70 mt-1">Treine sem limites e domine o edital.</p>
        </div>
      </header>

      <main className="px-5 py-5 space-y-4">
        {/* Premium */}
        <article className="relative bg-gradient-flame rounded-2xl p-6 text-white shadow-flame overflow-hidden">
          <div className="absolute top-3 right-3 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-[10px] stencil flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Recomendado
          </div>
          <p className="stencil text-xs opacity-90">Plano Premium</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl font-display font-bold">R$ 29,90</span>
            <span className="text-sm opacity-80">/mês</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {["Questões ilimitadas todos os dias", "Sem anúncios", "Simulados completos no estilo IDECAN", "Gabarito comentado em todas as questões", "Estatísticas avançadas por matéria"].map((t) => (
              <li key={t} className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" /> {t}</li>
            ))}
          </ul>
          {isPremium ? (
            <Button onClick={cancel} disabled={loading} variant="secondary" className="w-full mt-5 font-display stencil bg-white text-primary hover:bg-white/90">
              Cancelar premium
            </Button>
          ) : (
            <PlanSelectionDialog>
              <Button className="w-full mt-5 bg-white text-primary hover:bg-white/90 font-display stencil">
                Assinar agora
              </Button>
            </PlanSelectionDialog>
          )}
          <p className="text-[10px] opacity-80 mt-2 text-center">Demo · Pagamento será integrado em breve.</p>
        </article>

        {/* Básico */}
        <article className="bg-card border border-border rounded-2xl p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stencil text-xs text-muted-foreground">Plano Básico</p>
              <p className="font-display text-2xl font-bold">Grátis</p>
            </div>
            <Flame className="w-7 h-7 text-primary" />
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-success shrink-0" /> 10 questões por dia</li>
            <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 text-success shrink-0" /> Acesso a todas as matérias</li>
            <li className="flex items-start gap-2"><X className="w-4 h-4 mt-0.5 text-destructive shrink-0" /> Com anúncios</li>
            <li className="flex items-start gap-2"><X className="w-4 h-4 mt-0.5 text-destructive shrink-0" /> Sem simulados completos</li>
          </ul>
        </article>
      </main>
    </AppShell>
  );
};

export default Plans;
