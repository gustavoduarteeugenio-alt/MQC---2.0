import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Flame, Crown, BookOpen, Target, Zap, ChevronRight, ShieldCheck, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AppShell } from "@/components/AppShell";
import { AdBanner } from "@/components/AdBanner";
import { PlanSelectionDialog } from "@/components/PlanSelectionDialog";


type Stat = { total: number; correct: number; today: number };

const Index = () => {
  const { profile, dailyCount, dailyLimit, isPremium, loading } = useProfile();
  const [stats, setStats] = useState<Stat>({ total: 0, correct: 0, today: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const { data } = await supabase.from("attempts").select("is_correct, created_at").limit(1000);
      if (!data) return;
      const total = data.length;
      const correct = data.filter((a: any) => a.is_correct).length;
      const todayCount = data.filter((a: any) => new Date(a.created_at) >= today).length;
      setStats({ total, correct, today: todayCount });
    })();
  }, [dailyCount]);

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const limitProgress = isPremium ? 100 : Math.min(100, (dailyCount / dailyLimit) * 100);
  const firstName = profile?.full_name?.split(" ")[0] ?? "Recruta";

  return (
    <AppShell>
      {/* Cabeçalho */}
      <header className="bg-gradient-night text-white px-5 pt-12 pb-20 rounded-b-[2rem] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          background: "radial-gradient(600px 200px at 80% 0%, hsl(18 95% 52%/0.6), transparent 60%)"
        }} />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="stencil text-xs text-primary">CFSd CBMMG 2027</p>
              <h1 className="text-2xl font-display font-bold mt-1">Olá, {firstName}.</h1>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-flame flex items-center justify-center shadow-flame">
              <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
          </div>

          <div className={`mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs stencil ${isPremium ? "bg-warning text-warning-foreground" : "bg-white/10 text-white/80"}`}>
            <Crown className="w-3.5 h-3.5" /> Plano {isPremium ? "Premium" : "Básico"}
          </div>
        </div>
      </header>

      {/* Cards principais */}
      <main className="px-5 -mt-14 space-y-4 relative z-10">
        {/* Card de questões diárias */}
        <div className="bg-card rounded-2xl p-5 shadow-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="stencil text-[10px] text-muted-foreground">Meta diária</p>
              <p className="font-display text-lg font-bold">
                {dailyCount}{isPremium ? "" : ` / ${dailyLimit}`} questões hoje
              </p>
            </div>
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <Progress value={limitProgress} className="h-2" />
          {!isPremium && dailyCount >= dailyLimit && (
            <Link to="/planos" className="mt-3 flex items-center justify-between text-sm text-primary font-semibold">
              Limite atingido — vire Premium <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Target} label="Acerto geral" value={`${accuracy}%`} accent />
          <StatCard icon={BookOpen} label="Total respondidas" value={String(stats.total)} />
        </div>

        {/* CTA principal */}
        <Link to="/materias" className="block">
          <div className="bg-gradient-flame rounded-2xl p-5 shadow-flame text-white">
            <p className="stencil text-[11px] opacity-90">Próxima missão</p>
            <h3 className="font-display text-2xl font-bold mt-1">Treinar agora</h3>
            <p className="text-sm opacity-90 mt-1">Escolha uma matéria e enfrente o gabarito.</p>
            <div className="mt-3 flex items-center gap-1 stencil text-sm">
              Iniciar <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </Link>

        {/* Simulado completo — exclusivo Premium */}
        {isPremium ? (
          <Link to="/materias" className="flex items-center justify-between bg-secondary text-secondary-foreground rounded-2xl px-5 py-4 shadow-card">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-warning" />
              <div>
                <p className="stencil text-[10px] opacity-80">Exclusivo Premium</p>
                <p className="font-display font-semibold">Simulado completo IDECAN</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5" />
          </Link>
        ) : (
          <PlanSelectionDialog>
            <button className="w-full flex items-center justify-between bg-card border border-dashed border-primary/40 rounded-2xl px-5 py-4 shadow-card text-left">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-primary" />
                <div>
                  <p className="stencil text-[10px] text-muted-foreground">Bloqueado · Premium</p>
                  <p className="font-display font-semibold">Simulado completo IDECAN</p>
                </div>
              </div>
              <Crown className="w-5 h-5 text-warning" />
            </button>
          </PlanSelectionDialog>
        )}

        {/* Anúncio (apenas básico) */}
        <AdBanner />

        {/* Atalho dashboard */}
        <Link to="/dashboard" className="flex items-center justify-between bg-card border border-border rounded-2xl px-5 py-4 shadow-card">
          <div>
            <p className="stencil text-[10px] text-muted-foreground">Análise de desempenho</p>
            <p className="font-display font-semibold">Ver progresso por matéria</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </Link>
      </main>
    </AppShell>
  );
};

const StatCard = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-2xl p-4 border ${accent ? "bg-secondary text-secondary-foreground border-secondary" : "bg-card border-border"} shadow-card`}>
    <Icon className={`w-5 h-5 mb-2 ${accent ? "text-warning" : "text-primary"}`} />
    <p className={`stencil text-[10px] ${accent ? "opacity-80" : "text-muted-foreground"}`}>{label}</p>
    <p className="font-display text-xl font-bold">{value}</p>
  </div>
);

export default Index;
