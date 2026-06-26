import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { fetchDedupedAttempts } from "@/lib/stats";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Trophy, Target, Flame as FlameIcon, TrendingUp, Swords, AlertTriangle, ShieldCheck, BookOpen, Quote } from "lucide-react";

// Pesos do edital CBMMG (nº de questões na prova real)
const WEIGHTS: Record<string, number> = {
  "lingua-portuguesa": 10,
  "rlm": 5,
  "direitos-humanos-legislacao": 10,
  "ciencias-naturais": 10,
  "ciencias-humanas": 10,
  "protecao-defesa-civil": 5,
};

// Metas mínimas por tipo de peso
const TARGET_LIGHT = 80; // matérias de 5 questões
const TARGET_HEAVY = 70; // matérias de 10 questões

type Row = {
  subject: string;
  fullName: string;
  slug: string;
  total: number;
  correct: number;
  accuracy: number;
  weight: number;
  target: number;
  status: "ready" | "review" | "critical";
  vulnerability: number; // quanto maior, mais prioritário
};

const COMMANDER_QUOTES = [
  "O suor no treinamento poupa o sangue no campo de batalha. Cada questão resolvida hoje é um passo a menos entre você e a sua farda. Não pare até se orgulhar.",
  "O incêndio não escolhe hora para começar, e a prova não escolhe se você está cansado. A disciplina é o que te mantém de pé quando a motivação falha. Força, combatente!",
];

const Dashboard = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [overall, setOverall] = useState({ total: 0, correct: 0, streak: 0 });
  const [hasEligible, setHasEligible] = useState(false);

  const quote = useMemo(
    () => COMMANDER_QUOTES[Math.floor(Math.random() * COMMANDER_QUOTES.length)],
    []
  );

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
        const accuracy = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
        const weight = WEIGHTS[s.slug] ?? 10;
        const target = weight === 5 ? TARGET_LIGHT : TARGET_HEAVY;
        let status: Row["status"] = "ready";
        if (stat.total >= 5) {
          if (accuracy < target) status = "critical";
          else if (accuracy < target + 10) status = "review";
        }
        // Índice de vulnerabilidade: gap até a meta x peso (5q valem mais por questão)
        const gap = Math.max(0, target - accuracy);
        const weightFactor = weight === 5 ? 2 : 1; // cada erro nas leves dói mais
        const vulnerability = stat.total >= 5 ? gap * weightFactor : -1;

        return {
          subject: s.name.length > 16 ? s.name.split(" ").slice(0, 2).join(" ") : s.name,
          fullName: s.name,
          slug: s.slug,
          total: stat.total,
          correct: stat.correct,
          accuracy,
          weight,
          target,
          status,
          vulnerability,
        };
      });
      setRows(built);
      setHasEligible(built.some((r) => r.total >= 5));

      const total = (attempts ?? []).length;
      const correct = (attempts ?? []).filter((a: any) => a.is_correct).length;
      const days = new Set((attempts ?? []).map((a: any) => new Date(a.created_at).toISOString().slice(0, 10)));
      let streak = 0;
      const d = new Date();
      while (days.has(d.toISOString().slice(0, 10))) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
      setOverall({ total, correct, streak });
    })();
  }, [user]);

  const accuracy = overall.total ? Math.round((overall.correct / overall.total) * 100) : 0;

  // Maior vulnerabilidade
  const priority = useMemo(() => {
    const eligible = rows.filter((r) => r.vulnerability >= 0 && r.status !== "ready");
    if (!eligible.length) return null;
    return eligible.reduce((max, r) => (r.vulnerability > max.vulnerability ? r : max));
  }, [rows]);

  const statusColor = (s: Row["status"]) =>
    s === "critical" ? "hsl(var(--destructive))" : s === "review" ? "hsl(var(--warning))" : "hsl(var(--success))";

  const getFeedback = () => {
    if (!hasEligible) {
      return {
        icon: BookOpen,
        colorClass: "text-muted-foreground",
        bgClass: "bg-muted",
        label: "Dados insuficientes",
        text: "Responda pelo menos 5 questões em cada matéria para receber um diagnóstico técnico baseado nos pesos do edital.",
      };
    }
    if (!priority) {
      return {
        icon: ShieldCheck,
        colorClass: "text-success",
        bgClass: "bg-success/10",
        label: "Prontidão Operacional",
        text: "Todas as suas frentes estão dentro da meta de classificação. Mantenha a constância para preservar a vantagem.",
      };
    }
    const projected = Math.round((priority.accuracy / 100) * priority.weight);
    const targetCount = Math.ceil((priority.target / 100) * priority.weight);
    const Icon = priority.status === "critical" ? AlertTriangle : Swords;
    const color = priority.status === "critical" ? "text-destructive" : "text-warning";
    const bg = priority.status === "critical" ? "bg-destructive/10" : "bg-warning/10";
    return {
      icon: Icon,
      colorClass: color,
      bgClass: bg,
      label: priority.status === "critical" ? "Alerta Crítico" : "Revisar",
      text: `Seu desempenho atual em ${priority.fullName} sugere que você acertaria aproximadamente ${projected} de ${priority.weight} questões na prova real. Para garantir a classificação, sua meta deve ser de ${priority.target}% (mínimo ${targetCount}/${priority.weight}).`,
    };
  };

  const feedback = getFeedback();
  const FeedbackIcon = feedback.icon;

  return (
    <AppShell>
      <header className="bg-gradient-night text-white px-5 pt-12 pb-6">
        <p className="stencil text-xs text-primary">Quartel · Inteligência</p>
        <h1 className="text-2xl font-display font-bold">Seu progresso</h1>
        <p className="text-sm text-white/70 mt-1">Análise tática por peso do edital CBMMG.</p>
      </header>

      <main className="px-5 py-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Target} label="Acerto" value={`${accuracy}%`} />
          <Stat icon={Trophy} label="Total" value={String(overall.total)} />
          <Stat icon={FlameIcon} label="Sequência" value={`${overall.streak}d`} />
        </div>

        {/* Diagnóstico */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold">Diagnóstico Tático</h2>
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

          {priority && (
            <Link
              to={`/questao/${priority.slug}`}
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 font-display stencil text-sm shadow-card active:scale-[0.98] transition-all text-white"
              style={{ background: statusColor(priority.status) }}
            >
              <Swords className="w-4 h-4" />
              Reforçar {priority.fullName}
            </Link>
          )}

          {!hasEligible && overall.total > 0 && (
            <Link
              to="/materias"
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 font-display stencil text-sm bg-secondary text-secondary-foreground shadow-card active:scale-[0.98] transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Começar a treinar
            </Link>
          )}
        </div>

        {/* Status de Prontidão (gráfico) */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold">Status de Prontidão</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Verde: pronto · Amarelo: revisar · Vermelho: alerta crítico</p>
          {overall.total === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Responda algumas questões para ver seus dados aqui.
            </p>
          ) : (
            <div className="h-72 -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="subject" type="category" width={100}
                    tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any, _n, p: any) => [`${v}% · meta ${p.payload.target}% (${p.payload.correct}/${p.payload.total})`, p.payload.fullName]}
                  />
                  <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                    {rows.map((r, i) => (
                      <Cell key={i} fill={statusColor(r.status)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Detalhes com pesos */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-2">
          <h2 className="font-display font-bold mb-2">Detalhes por matéria</h2>
          {rows.map((r) => (
            <div key={r.slug} className="flex items-center justify-between text-sm gap-2">
              <div className="min-w-0">
                <p className="truncate">{r.fullName}</p>
                <p className="text-[10px] text-muted-foreground stencil">
                  Peso {r.weight}q · meta {r.target}%
                </p>
              </div>
              <span
                className="font-display font-semibold shrink-0"
                style={{ color: r.total >= 5 ? statusColor(r.status) : "hsl(var(--muted-foreground))" }}
              >
                {r.correct}/{r.total} · {r.accuracy}%
              </span>
            </div>
          ))}
        </div>

        {/* Palavra do Comandante */}
        <div className="relative rounded-2xl p-6 shadow-flame overflow-hidden bg-gradient-night text-white">
          <div className="absolute inset-0 opacity-20" style={{
            background: "radial-gradient(500px 200px at 100% 0%, hsl(18 95% 52%/0.7), transparent 60%)"
          }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Quote className="w-5 h-5 text-primary" />
              <p className="stencil text-xs text-primary">Palavra do Comandante</p>
            </div>
            <p className="font-display text-base leading-relaxed italic">"{quote}"</p>
          </div>
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
