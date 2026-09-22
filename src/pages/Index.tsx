import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Target, BookOpen, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getDisciplineStats, pickNextSubject } from "@/lib/training";
import { accuracyOf, fetchExamAttempts, tallyByNode } from "@/lib/stats";
import { useExam } from "@/contexts/ExamContext";
import { disciplinesOf, examLabel } from "@/lib/exams";
import { ExamSwitcher } from "@/components/ExamSwitcher";
import { toast } from "sonner";

type SubjectStat = { name: string; total: number; correct: number; accuracy: number };
type FocusStat = SubjectStat & { slug: string | null };

const MIN_ATTEMPTS = 3; // mínimo de questões pra entrar no ranking
const TARGET_ACCURACY = 80; // meta do método

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { exam, nodes, loading: examLoading } = useExam();
  const [stats, setStats] = useState({ total: 0, correct: 0 });
  const [best, setBest] = useState<SubjectStat | null>(null);
  const [worst, setWorst] = useState<SubjectStat | null>(null);
  const [focus, setFocus] = useState<FocusStat[]>([]);
  const [training, setTraining] = useState(false);

  const handleTrainNow = async () => {
    if (!user || training) return;
    setTraining(true);
    try {
      if (!exam) { navigate("/materias"); return; }
      const subjectStats = await getDisciplineStats(user.id, exam.id, nodes);
      const next = pickNextSubject({ stats: subjectStats });
      if (!next) {
        toast.error("Nenhuma matéria disponível ainda.");
        navigate("/materias");
        return;
      }
      navigate(`/questao/${next.slug}`);
    } finally {
      setTraining(false);
    }
  };

  const load = useCallback(async () => {
    if (!user || !exam) return;
    const data = await fetchExamAttempts(user.id, exam.id);

    const total = data.length;
    const correct = data.filter((a) => a.is_correct).length;
    setStats({ total, correct });

    // Desempenho por disciplina do edital ativo
    const { byDiscipline } = tallyByNode(data, nodes);
    const ranked: FocusStat[] = disciplinesOf(nodes)
      .map((d) => {
        const tally = byDiscipline[d.id];
        return {
          name: d.name,
          slug: d.slug,
          total: tally?.total ?? 0,
          correct: tally?.correct ?? 0,
          accuracy: accuracyOf(tally),
        };
      })
      .filter((s) => s.total >= MIN_ATTEMPTS);

    if (ranked.length === 0) { setBest(null); setWorst(null); setFocus([]); return; }
    const sorted = [...ranked].sort((a, b) => b.accuracy - a.accuracy);
    setBest(sorted[0]);
    setWorst(sorted[sorted.length - 1]);
    // Abaixo da meta de 80%, da pior para a melhor — é onde o treino rende mais
    setFocus(sorted.filter((s) => s.accuracy < TARGET_ACCURACY).reverse().slice(0, 3));
  }, [user, exam, nodes]);

  useEffect(() => { if (!examLoading) load(); }, [load, examLoading]);

  // Atualiza ao voltar para a aba (após terminar um bloco de treino)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const firstName = profile?.full_name?.split(" ")[0] ?? "Recruta";

  return (
    <AppShell>
      {/* Cabeçalho */}
      <header className="bg-gradient-dark text-white px-6 pt-12 pb-24 rounded-b-[2.5rem] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-25"
          style={{ background: "radial-gradient(700px 240px at 85% 0%, hsl(18 95% 52%/0.55), transparent 60%)" }}
        />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="stencil text-[11px] text-primary tracking-widest">
                {exam ? examLabel(exam) : ""}
              </p>
              <h1 className="text-[28px] leading-tight font-display font-bold mt-1.5">
                Olá, {firstName}.
              </h1>
              <p className="text-sm text-white/60 mt-1">Hora de treinar.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-brand">
                <Target className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <ExamSwitcher />
            </div>
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
        <button onClick={handleTrainNow} disabled={training} className="block w-full text-left group disabled:opacity-70">
          <div className="bg-gradient-brand rounded-3xl p-6 shadow-brand text-white relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="stencil text-[11px] opacity-90 tracking-widest">Próxima missão</p>
                <h3 className="font-display text-2xl font-bold mt-1.5">Treinar agora</h3>
                <p className="text-sm opacity-90 mt-1">Vamos direto pra matéria que mais precisa de você.</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center group-hover:translate-x-1 transition">
                <ChevronRight className="w-6 h-6" />
              </div>
            </div>
          </div>
        </button>

        {/* Matérias abaixo da meta, com atalho direto pra treinar cada uma */}
        {focus.length > 0 && (
          <section className="bg-card border border-border rounded-2xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="stencil text-[11px] tracking-widest text-muted-foreground">
                Onde focar · meta {TARGET_ACCURACY}%
              </h2>
            </div>
            <ul className="space-y-2.5">
              {focus.map((s) => (
                <li key={s.name}>
                  <button
                    onClick={() => s.slug && navigate(`/questao/${s.slug}`)}
                    disabled={!s.slug}
                    className="w-full text-left flex items-center gap-3 disabled:opacity-60"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-display text-sm font-semibold truncate">{s.name}</p>
                        <span className="stencil text-xs text-muted-foreground shrink-0">{s.accuracy}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-brand"
                          style={{ width: `${Math.max(s.accuracy, 4)}%` }}
                        />
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
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
