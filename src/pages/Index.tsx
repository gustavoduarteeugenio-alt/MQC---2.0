import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Flame, Crown, Target, BookOpen, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";

type SubjectStat = { name: string; total: number; correct: number; accuracy: number };

const MIN_ATTEMPTS = 3; // mínimo de questões pra entrar no ranking

const Index = () => {
  const { user } = useAuth();
  const { profile, isPremium } = useProfile();
  const [stats, setStats] = useState({ total: 0, correct: 0 });
  const [best, setBest] = useState<SubjectStat | null>(null);
  const [worst, setWorst] = useState<SubjectStat | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("attempts")
        .select("is_correct, questions(subject_id, subjects(name))")
        .eq("user_id", user.id)
        .limit(2000);

      if (!data) return;

      const total = data.length;
      const correct = data.filter((a: any) => a.is_correct).length;
      setStats({ total, correct });

      const bySubject: Record<string, SubjectStat> = {};
      data.forEach((a: any) => {
        const name = a.questions?.subjects?.name;
        if (!name) return;
        bySubject[name] = bySubject[name] ?? { name, total: 0, correct: 0, accuracy: 0 };
        bySubject[name].total++;
        if (a.is_correct) bySubject[name].correct++;
      });

      const ranked = Object.values(bySubject)
        .map((s) => ({ ...s, accuracy: Math.round((s.correct / s.total) * 100) }))
        .filter((s) => s.total >= MIN_ATTEMPTS);

      if (ranked.length === 0) { setBest(null); setWorst(null); return; }
      const sorted = [...ranked].sort((a, b) => b.accuracy - a.accuracy);
      setBest(sorted[0]);
      setWorst(sorted[sorted.length - 1]);
    })();
  }, [user]);

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const firstName = profile?.full_name?.split(" ")[0] ?? "Recruta";

  return (
    <AppShell>
      {/* Cabeçalho */}
      <header className="bg-gradient-night text-white px-6 pt-12 pb-24 rounded-b-[2.5rem] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-25"
          style={{ background: "radial-gradient(700px 240px at 85% 0%, hsl(18 95% 52%/0.55), transparent 60%)" }}
        />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="stencil text-[11px] text-primary tracking-widest">CFSd CBMMG 2027</p>
              <h1 className="text-[28px] leading-tight font-display font-bold mt-1.5">
                Olá, {firstName}.
              </h1>
              <p className="text-sm text-white/60 mt-1">Hora de treinar.</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-flame flex items-center justify-center shadow-flame">
              <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
          </div>

          <div
            className={`mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] stencil tracking-wide ${
              isPremium ? "bg-warning text-warning-foreground" : "bg-white/10 text-white/80"
            }`}
          >
            <Crown className="w-3.5 h-3.5" /> Plano {isPremium ? "Premium" : "Básico"}
          </div>
        </div>
      </header>

      <main className="px-5 -mt-16 pb-6 space-y-4 relative z-10">
        {/* Métricas principais */}
        <section className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={Target}
            label="Acerto geral"
            value={stats.total > 0 ? `${accuracy}%` : "—"}
            highlight
          />
          <MetricCard
            icon={BookOpen}
            label="Total respondidas"
            value={String(stats.total)}
          />
        </section>

        <section className="grid grid-cols-1 gap-3">
          <SubjectCard
            icon={TrendingUp}
            label="Melhor matéria"
            subject={best}
            tone="success"
          />
          <SubjectCard
            icon={TrendingDown}
            label="Pior matéria"
            subject={worst}
            tone="danger"
          />
        </section>

        {/* CTA principal */}
        <Link to="/materias" className="block group">
          <div className="bg-gradient-flame rounded-3xl p-6 shadow-flame text-white relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="stencil text-[11px] opacity-90 tracking-widest">Próxima missão</p>
                <h3 className="font-display text-2xl font-bold mt-1.5">Treinar agora</h3>
                <p className="text-sm opacity-90 mt-1">Escolha uma matéria e enfrente o gabarito.</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center group-hover:translate-x-1 transition">
                <ChevronRight className="w-6 h-6" />
              </div>
            </div>
          </div>
        </Link>
      </main>
    </AppShell>
  );
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  highlight,
}: { icon: any; label: string; value: string; highlight?: boolean }) => (
  <div
    className={`rounded-2xl p-5 border shadow-card ${
      highlight
        ? "bg-secondary text-secondary-foreground border-secondary"
        : "bg-card border-border text-foreground"
    }`}
  >
    <Icon className={`w-5 h-5 mb-3 ${highlight ? "text-warning" : "text-primary"}`} />
    <p className={`stencil text-[10px] tracking-widest ${highlight ? "opacity-70" : "text-muted-foreground"}`}>
      {label}
    </p>
    <p className="font-display text-2xl font-bold mt-0.5">{value}</p>
  </div>
);

const SubjectCard = ({
  icon: Icon,
  label,
  subject,
  tone,
}: { icon: any; label: string; subject: SubjectStat | null; tone: "success" | "danger" }) => {
  const toneStyles =
    tone === "success"
      ? "bg-success/10 text-success border-success/30"
      : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-card flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${toneStyles}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="stencil text-[10px] text-muted-foreground tracking-widest">{label}</p>
        <p className="font-display font-bold text-base truncate text-foreground">
          {subject ? subject.name : "—"}
        </p>
      </div>
      {subject && (
        <div className="text-right">
          <p className="font-display text-xl font-bold text-foreground">{subject.accuracy}%</p>
          <p className="text-[10px] text-muted-foreground">{subject.total} questões</p>
        </div>
      )}
    </div>
  );
};

export default Index;
