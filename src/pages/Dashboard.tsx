import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Trophy, Target, Flame as FlameIcon, TrendingUp, Swords, AlertTriangle, ShieldCheck, BookOpen } from "lucide-react";

type Row = {
  subject: string;
  slug: string;
  total: number;
  correct: number;
  accuracy: number;
};

type Weakest = {
  subject: string;
  slug: string;
  accuracy: number;
} | null;

const Dashboard = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [overall, setOverall] = useState({ total: 0, correct: 0, streak: 0 });
  const [weakest, setWeakest] = useState<Weakest>(null);
  const [answeredEnough, setAnsweredEnough] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: subs } = await supabase.from("subjects").select("id, name, slug").order("display_order");
      const { data: attempts } = await supabase
        .from("attempts")
        .select("question_id, is_correct, created_at, questions(subject_id)")
        .eq("user_id", user.id)
        .limit(2000);

      const bySubject: Record<string, { total: number; correct: number }> = {};
      (attempts ?? []).forEach((a: any) => {
        const sid = a.questions?.subject_id;
        if (!sid) return;
        bySubject[sid] = bySubject[sid] ?? { total: 0, correct: 0 };
        bySubject[sid].total++;
        if (a.is_correct) bySubject[sid].correct++;
      });

      const built: Row[] = (subs ?? []).map((s: any) => {
        const stat = bySubject[s.id] ?? { total: 0, correct: 0 };
        return {
          subject: s.name.length > 14 ? s.name.split(" ")[0] : s.name,
          slug: s.slug,
          total: stat.total,
          correct: stat.correct,
          accuracy: stat.total ? Math.round((stat.correct / stat.total) * 100) : 0,
        };
      });
      setRows(built);

      const total = (attempts ?? []).length;
      const correct = (attempts ?? []).filter((a: any) => a.is_correct).length;

      // streak
      const days = new Set((attempts ?? []).map((a: any) => new Date(a.created_at).toISOString().slice(0, 10)));
      let streak = 0;
      const d = new Date();
      while (days.has(d.toISOString().slice(0, 10))) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
      setOverall({ total, correct, streak });

      // weakest subject (min 5 questions)
      const eligible = built.filter((r) => r.total >= 5);
      setAnsweredEnough(eligible.length > 0);
      if (eligible.length > 0) {
        const w = eligible.reduce((min, r) => (r.accuracy < min.accuracy ? r : min));
        setWeakest({ subject: w.subject, slug: w.slug, accuracy: w.accuracy });
      } else {
        setWeakest(null);
      }
    })();
  }, [user]);

  const accuracy = overall.total ? Math.round((overall.correct / overall.total) * 100) : 0;

  // feedback logic
  const getFeedback = () => {
    if (!answeredEnough) {
      return {
        icon: BookOpen,
        colorClass: "text-muted-foreground",
        bgClass: "bg-muted",
        text: "Responda pelo menos 5 questões em cada matéria para receber um diagnóstico completo.",
        label: "Dados insuficientes",
      };
    }
    if (!weakest) {
      return {
        icon: ShieldCheck,
        colorClass: "text-success",
        bgClass: "bg-success/10",
        text: "Bom progresso! Suas frentes de combate estão equilibradas. Continue a rotina para manter a constância.",
        label: "Desempenho equilibrado",
      };
    }
    if (weakest.accuracy < 60) {
      return {
        icon: AlertTriangle,
        colorClass: "text-destructive",
        bgClass: "bg-destructive/10",
        text: `Atenção, Combatente! Seu desempenho em ${weakest.subject} está abaixo do esperado (${weakest.accuracy}%). Recomendamos reforçar a teoria e resolver mais questões deste tópico.`,
        label: "Foco necessário",
      };
    }
    if (weakest.accuracy < 70) {
      return {
        icon: Swords,
        colorClass: "text-warning",
        bgClass: "bg-warning/10",
        text: `Seu desempenho em ${weakest.subject} (${weakest.accuracy}%) precisa de atenção. Um reforço extra vai te colocar na zona de aprovação.`,
        label: "Atenção recomendada",
      };
    }
    return {
      icon: ShieldCheck,
      colorClass: "text-success",
      bgClass: "bg-success/10",
      text: "Bom progresso! Suas frentes de combate estão equilibradas. Continue a rotina para manter a constância.",
      label: "Desempenho equilibrado",
    };
  };

  const feedback = getFeedback();
  const FeedbackIcon = feedback.icon;

  return (
    <AppShell>
      <header className="bg-gradient-night text-white px-5 pt-12 pb-6">
        <p className="stencil text-xs text-primary">Quartel · Inteligência</p>
        <h1 className="text-2xl font-display font-bold">Seu progresso</h1>
        <p className="text-sm text-white/70 mt-1">Acompanhe sua evolução por matéria.</p>
      </header>

      <main className="px-5 py-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Target} label="Acerto" value={`${accuracy}%`} />
          <Stat icon={Trophy} label="Total" value={String(overall.total)} />
          <Stat icon={FlameIcon} label="Sequência" value={`${overall.streak}d`} />
        </div>

        {/* Diagnóstico de Estudos */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold">Diagnóstico de Estudos</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="stencil text-[9px] text-muted-foreground">Total respondidas</p>
              <p className="font-display text-xl font-bold">{overall.total}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="stencil text-[9px] text-muted-foreground">Média geral</p>
              <p className={`font-display text-xl font-bold ${accuracy >= 70 ? "text-success" : accuracy >= 60 ? "text-warning" : "text-destructive"}`}>
                {accuracy}%
              </p>
            </div>
          </div>

          {/* Mentor */}
          <div className={`rounded-xl p-4 ${feedback.bgClass} border border-border/50`}>
            <div className="flex items-start gap-3">
              <div className={`shrink-0 mt-0.5 ${feedback.colorClass}`}>
                <FeedbackIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-display font-semibold stencil uppercase mb-1">{feedback.label}</p>
                <p className="text-sm leading-relaxed text-foreground">{feedback.text}</p>
              </div>
            </div>
          </div>

          {/* Atalho */}
          {weakest && answeredEnough && (
            <Link
              to={`/questao/${weakest.slug}`}
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 font-display stencil text-sm shadow-card active:scale-[0.98] transition-all"
              style={{
                background:
                  weakest.accuracy < 60
                    ? "hsl(var(--destructive))"
                    : weakest.accuracy < 70
                    ? "hsl(var(--warning))"
                    : "hsl(var(--success))",
                color:
                  weakest.accuracy < 70 ? "hsl(var(--destructive-foreground))" : "hsl(var(--success-foreground))",
              }}
            >
              <Swords className="w-4 h-4" />
              Reforçar {weakest.subject}
            </Link>
          )}

          {!answeredEnough && overall.total > 0 && (
            <Link
              to="/materias"
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 font-display stencil text-sm bg-secondary text-secondary-foreground shadow-card active:scale-[0.98] transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Começar a treinar
            </Link>
          )}
        </div>

        {/* Gráfico por matéria */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold">Acerto por matéria</h2>
          </div>
          {overall.total === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Responda algumas questões para ver seus dados aqui.
            </p>
          ) : (
            <div className="h-72 -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="subject" type="category" width={90}
                    tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any, _n, p: any) => [`${v}% (${p.payload.correct}/${p.payload.total})`, "Acerto"]}
                  />
                  <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                    {rows.map((r, i) => (
                      <Cell key={i} fill={r.accuracy >= 70 ? "hsl(var(--success))" : r.accuracy >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Detalhes */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-2">
          <h2 className="font-display font-bold mb-2">Detalhes</h2>
          {rows.map((r) => (
            <div key={r.subject} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.subject}</span>
              <span className="font-display font-semibold">{r.correct}/{r.total} · {r.accuracy}%</span>
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
};

const Stat = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="bg-card border border-border rounded-2xl p-3 shadow-card">
    <Icon className="w-4 h-4 text-primary mb-1.5" />
    <p className="stencil text-[9px] text-muted-foreground">{label}</p>
    <p className="font-display text-lg font-bold leading-tight">{value}</p>
  </div>
);

export default Dashboard;
