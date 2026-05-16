import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Target, Trophy, Clock, Home, Flame, ChevronRight } from "lucide-react";

type SubjectSession = {
  id: string;
  name: string;
  slug: string;
  correct: number;
  wrong: number;
  accuracy: number;
};

type SummaryState = {
  durationSeconds: number;
  totalCorrect: number;
  totalWrong: number;
  bySubject: SubjectSession[];
};

const fmtDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  return `${m}min ${sec.toString().padStart(2, "0")}s`;
};

const TrainingSummary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as SummaryState | null;

  useEffect(() => {
    if (!state || !state.bySubject) navigate("/", { replace: true });
  }, [state, navigate]);

  const data = useMemo(() => {
    if (!state) return null;
    const total = state.totalCorrect + state.totalWrong;
    const acc = total > 0 ? Math.round((state.totalCorrect / total) * 100) : 0;
    const sorted = [...state.bySubject].sort((a, b) => a.accuracy - b.accuracy);
    const focus = sorted[0] ?? null;
    const best = sorted[sorted.length - 1] ?? null;
    const sameSubject = focus && best && focus.id === best.id;
    return { total, acc, sorted, focus, best, sameSubject };
  }, [state]);

  if (!state || !data) return null;

  const { total, acc, sorted, focus, best, sameSubject } = data;

  const feedback =
    acc >= 80
      ? "Excelente, soldado! Mantenha o ritmo."
      : acc >= 50
      ? `Bom desempenho. Foque em ${focus?.name ?? "sua matéria fraca"} para subir o índice.`
      : `Hora de reforçar a base. Comece por ${focus?.name ?? "sua matéria mais difícil"}.`;

  return (
    <AppShell>
      <header className="bg-gradient-night text-white px-6 pt-12 pb-24 rounded-b-[2.5rem] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-25"
          style={{ background: "radial-gradient(700px 240px at 85% 0%, hsl(18 95% 52%/0.55), transparent 60%)" }}
        />
        <div className="relative">
          <p className="stencil text-[11px] text-primary tracking-widest">Treino encerrado</p>
          <h1 className="text-[28px] leading-tight font-display font-bold mt-1.5">
            Resumo da missão
          </h1>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] stencil tracking-wide bg-white/10 text-white/80">
            <Clock className="w-3.5 h-3.5" /> {fmtDuration(state.durationSeconds)}
          </div>
        </div>
      </header>

      <main className="px-5 -mt-16 pb-8 space-y-4 relative z-10">
        {/* Card principal de acerto */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-flame">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-flame flex items-center justify-center shadow-flame">
              <Flame className="w-6 h-6 text-white" strokeWidth={2.4} />
            </div>
            <div>
              <p className="stencil text-[10px] text-muted-foreground tracking-widest">Acerto geral</p>
              <p className="font-display text-3xl font-bold text-foreground leading-none mt-0.5">
                {acc}%
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-center">
              <p className="stencil text-[10px] text-muted-foreground tracking-widest">Acertos</p>
              <p className="font-display text-xl font-bold text-success">{state.totalCorrect}</p>
            </div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center">
              <p className="stencil text-[10px] text-muted-foreground tracking-widest">Erros</p>
              <p className="font-display text-xl font-bold text-destructive">{state.totalWrong}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Você respondeu <strong className="text-foreground">{total}</strong> questões nessa sessão.
          </p>
        </div>

        {/* Foco / mandando bem */}
        {sameSubject && focus ? (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-card flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl border bg-primary/10 border-primary/30 text-primary flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="stencil text-[10px] text-muted-foreground tracking-widest">Matéria treinada</p>
              <p className="font-display font-bold text-base truncate">{focus.name}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-bold">{focus.accuracy}%</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {focus && (
              <div className="bg-card border border-border rounded-2xl p-4 shadow-card flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl border bg-destructive/10 border-destructive/30 text-destructive flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="stencil text-[10px] text-muted-foreground tracking-widest">Foco agora</p>
                  <p className="font-display font-bold text-base truncate">{focus.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold text-destructive">{focus.accuracy}%</p>
                </div>
              </div>
            )}
            {best && (
              <div className="bg-card border border-border rounded-2xl p-4 shadow-card flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl border bg-success/10 border-success/30 text-success flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="stencil text-[10px] text-muted-foreground tracking-widest">Mandando bem</p>
                  <p className="font-display font-bold text-base truncate">{best.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold text-success">{best.accuracy}%</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lista completa */}
        {sorted.length > 1 && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
            <p className="stencil text-[10px] text-muted-foreground tracking-widest mb-3">
              Desempenho por matéria
            </p>
            <ul className="space-y-2">
              {sorted.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="font-display truncate pr-3">{s.name}</span>
                  <span className="stencil text-xs text-muted-foreground tabular-nums">
                    {s.correct}/{s.correct + s.wrong}
                    <span className="ml-2 text-foreground font-display">{s.accuracy}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Feedback */}
        <div className="bg-secondary text-secondary-foreground rounded-2xl p-5">
          <p className="text-sm leading-relaxed">{feedback}</p>
        </div>

        {/* CTAs */}
        <div className="space-y-3 pt-1">
          {focus && (
            <button
              onClick={() => navigate(`/questao/${focus.slug}`)}
              className="w-full group bg-gradient-flame rounded-2xl p-5 shadow-flame text-white text-left flex items-center justify-between"
            >
              <div>
                <p className="stencil text-[11px] opacity-90 tracking-widest">Próxima missão</p>
                <h3 className="font-display text-lg font-bold mt-0.5">Treinar {focus.name}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center group-hover:translate-x-1 transition">
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>
          )}
          <button
            onClick={() => navigate("/")}
            className="w-full bg-card border border-border rounded-2xl p-4 shadow-card flex items-center justify-center gap-2 font-display stencil text-sm"
          >
            <Home className="w-4 h-4" /> Voltar para o início
          </button>
        </div>
      </main>
    </AppShell>
  );
};

export default TrainingSummary;
