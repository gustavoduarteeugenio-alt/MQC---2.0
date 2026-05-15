import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Trophy, Lightbulb, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { QuestionImage } from "@/components/QuestionImage";
import { RichText } from "@/components/RichText";

type Letter = "A" | "B" | "C" | "D" | "E";
type Q = {
  id: string; subject_id: string; statement: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  option_e: string | null; correct_answer: Letter; explanation: string;
  image_url: string | null; comment_image_url: string | null;
};
type Answer = { question_id: string; selected: Letter | null };
type AttemptRow = {
  id: string; user_id: string; mode: string; title: string | null;
  total: number; correct: number; started_at: string; finished_at: string | null;
  duration_seconds: number | null; answers: Answer[]; by_subject: any;
};

const TOTAL_SECONDS = 4 * 60 * 60;

const SimuladoRunner = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isReviewRoute = location.pathname.endsWith("/revisar");

  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(TOTAL_SECONDS);
  const [subjectsMap, setSubjectsMap] = useState<Record<string, string>>({});
  const finishedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data: a } = await (supabase.from("simulado_attempts" as any).select("*").eq("id", id!).maybeSingle()) as any;
      if (!a) { navigate("/simulados"); return; }
      const att = a as AttemptRow;
      setAttempt(att);
      setAnswers(att.answers ?? []);
      const ids = (att.answers ?? []).map((x) => x.question_id);
      if (ids.length) {
        const [{ data: qs }, { data: subs }] = await Promise.all([
          supabase.from("questions").select("*").in("id", ids),
          supabase.from("subjects").select("id, name"),
        ]);
        const map: Record<string, Q> = {};
        (qs ?? []).forEach((q: any) => { map[q.id] = q as Q; });
        setQuestions(ids.map((qid) => map[qid]).filter(Boolean));
        const sm: Record<string, string> = {};
        (subs ?? []).forEach((s: any) => { sm[s.id] = s.name; });
        setSubjectsMap(sm);
      }
      if (!att.finished_at) {
        const elapsed = Math.floor((Date.now() - new Date(att.started_at).getTime()) / 1000);
        setRemaining(Math.max(0, TOTAL_SECONDS - elapsed));
      }
      setLoading(false);
    })();
  }, [id, navigate]);

  const isFinished = !!attempt?.finished_at;
  const showResult = isFinished && !isReviewRoute;
  const reviewMode = isFinished;

  // timer (only while running)
  useEffect(() => {
    if (loading || isFinished || !attempt) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(t); finish(true); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isFinished, attempt?.id]);

  const fmt = useMemo(() => {
    const h = Math.floor(remaining / 3600).toString().padStart(2, "0");
    const m = Math.floor((remaining % 3600) / 60).toString().padStart(2, "0");
    const s = (remaining % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [remaining]);

  const current = questions[index];
  const answered = answers.filter((a) => a.selected).length;

  const select = async (letter: Letter) => {
    if (!current || reviewMode) return;
    const next = answers.map((a) => a.question_id === current.id ? { ...a, selected: letter } : a);
    setAnswers(next);
    await (supabase.from("simulado_attempts" as any).update({ answers: next } as any).eq("id", id!)) as any;
  };

  const finish = async (auto = false) => {
    if (!attempt || finishedRef.current) return;
    finishedRef.current = true;
    let correct = 0;
    const bySubject: Record<string, { name: string; correct: number; total: number }> = {};
    questions.forEach((q) => {
      const ans = answers.find((a) => a.question_id === q.id);
      const ok = ans?.selected === q.correct_answer;
      if (ok) correct++;
      const subjName = subjectsMap[q.subject_id] ?? "Outros";
      if (!bySubject[q.subject_id]) bySubject[q.subject_id] = { name: subjName, correct: 0, total: 0 };
      bySubject[q.subject_id].total++;
      if (ok) bySubject[q.subject_id].correct++;
    });
    const finished_at = new Date().toISOString();
    const duration = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
    const by_subject = Object.values(bySubject);
    if (user) {
      const rows = questions.map((q) => {
        const ans = answers.find((a) => a.question_id === q.id);
        if (!ans?.selected) return null;
        return {
          user_id: user.id,
          question_id: q.id,
          selected_answer: ans.selected as string,
          is_correct: ans.selected === q.correct_answer,
          time_seconds: 0,
        };
      }).filter(Boolean) as any[];
      if (rows.length) await supabase.from("attempts").insert(rows);
    }
    await (supabase.from("simulado_attempts" as any).update({
      finished_at, duration_seconds: duration, total: questions.length, correct, by_subject,
    } as any).eq("id", id!)) as any;
    setAttempt({ ...attempt, finished_at, duration_seconds: duration, correct, total: questions.length, by_subject });
    if (auto) toast.error("Tempo esgotado! Simulado finalizado.");
  };

  if (loading || !attempt) {
    return <div className="app-shell flex items-center justify-center bg-gradient-night text-white">Carregando...</div>;
  }

  // Tela de resultado (após finalizar e não em revisão)
  if (showResult) {
    return <ResultView attempt={attempt} navigate={navigate} />;
  }

  return (
    <div className="app-shell bg-background flex flex-col min-h-screen pb-32">
      <header className="flex items-center justify-between px-4 pt-12 pb-3 bg-card border-b border-border sticky top-0 z-30">
        <button onClick={() => navigate(isFinished ? `/simulado/${id}` : "/simulados")} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display font-bold truncate flex-1 text-center px-2 text-sm">{attempt.title}</h1>
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full stencil text-xs",
          remaining < 600 && !isFinished ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"
        )}>
          <Clock className="w-3.5 h-3.5" /> {isFinished ? "Revisão" : fmt}
        </div>
      </header>

      <div className="px-5 pt-3">
        <div className="flex items-center justify-between text-xs stencil text-muted-foreground mb-2">
          <span>Questão {index + 1}/{questions.length}</span>
          <span>{isFinished ? `${attempt.correct} acertos` : `${answered} respondidas · faltam ${questions.length - answered}`}</span>
        </div>
        <Progress value={((index + 1) / Math.max(1, questions.length)) * 100} className="h-1.5" />
      </div>

      {current && (
        <main className="flex-1 px-5 pt-5">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
            <p className="stencil text-[10px] text-muted-foreground mb-2">{subjectsMap[current.subject_id]}</p>
            <p className="text-[15px] leading-relaxed">{current.statement}</p>
            {current.image_url && <QuestionImage src={current.image_url} alt="Imagem do enunciado" />}
          </div>

          <div className="mt-4 space-y-2.5">
            {(["A","B","C","D","E"] as Letter[]).filter((l) => {
              const t = (current as any)[`option_${l.toLowerCase()}`];
              return typeof t === "string" && t.trim().length > 0;
            }).map((letter) => {
              const text = (current as any)[`option_${letter.toLowerCase()}`] as string;
              const isCorrect = letter === current.correct_answer;
              const ans = answers.find((a) => a.question_id === current.id);
              const isSelected = ans?.selected === letter;
              return (
                <button
                  key={letter}
                  disabled={reviewMode}
                  onClick={() => select(letter)}
                  className={cn(
                    "w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-all",
                    !reviewMode && isSelected && "border-primary bg-primary/5",
                    !reviewMode && !isSelected && "border-border bg-card hover:border-primary/40",
                    reviewMode && isCorrect && "border-success bg-success/10",
                    reviewMode && !isCorrect && isSelected && "border-destructive bg-destructive/10",
                    reviewMode && !isCorrect && !isSelected && "border-border bg-card opacity-60"
                  )}
                >
                  <span className={cn(
                    "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold",
                    !reviewMode && isSelected && "bg-primary text-primary-foreground",
                    !reviewMode && !isSelected && "bg-muted text-foreground",
                    reviewMode && isCorrect && "bg-success text-success-foreground",
                    reviewMode && !isCorrect && isSelected && "bg-destructive text-destructive-foreground",
                  )}>
                    {reviewMode && isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
                     reviewMode && !isCorrect && isSelected ? <XCircle className="w-4 h-4" /> : letter}
                  </span>
                  <span className="text-sm leading-snug pt-1">{text}</span>
                </button>
              );
            })}
          </div>

          {reviewMode && (
            <div className="mt-5 bg-secondary text-secondary-foreground rounded-2xl p-5">
              <div className="flex items-center gap-2 stencil text-warning text-xs mb-2">
                <Lightbulb className="w-4 h-4" /> Comentário do professor
              </div>
              <p className="text-sm leading-relaxed">
                <strong className="font-display">Resposta correta: {current.correct_answer}.</strong>{" "}
                {current.explanation}
              </p>
              {current.comment_image_url && (
                <QuestionImage src={current.comment_image_url} alt="Imagem do comentário" />
              )}
            </div>
          )}
        </main>
      )}

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-gradient-to-t from-background via-background to-transparent flex gap-2">
        <Button
          variant="outline"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="flex-1 stencil"
        >
          ← Anterior
        </Button>
        {index + 1 < questions.length ? (
          <Button
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="flex-1 bg-gradient-flame text-white font-display stencil shadow-flame"
          >
            Próxima →
          </Button>
        ) : isFinished ? (
          <Button
            onClick={() => navigate(`/simulado/${id}`)}
            className="flex-1 bg-secondary text-secondary-foreground font-display stencil"
          >
            <Trophy className="w-4 h-4 mr-1" /> Ver resultado
          </Button>
        ) : (
          <Button
            onClick={() => finish(false)}
            className="flex-1 bg-warning text-warning-foreground font-display stencil"
          >
            Finalizar
          </Button>
        )}
      </div>
    </div>
  );
};

const ResultView = ({ attempt, navigate }: { attempt: AttemptRow; navigate: (to: string) => void }) => {
  const pct = attempt.total > 0 ? Math.round((attempt.correct / attempt.total) * 100) : 0;
  const bySub = (attempt.by_subject ?? []) as { name: string; correct: number; total: number }[];
  return (
    <div className="app-shell bg-background min-h-screen pb-10">
      <header className="bg-gradient-night text-white px-5 pt-12 pb-8 rounded-b-3xl">
        <p className="stencil text-xs text-primary">Resultado</p>
        <h1 className="font-display text-2xl font-bold">{attempt.title}</h1>
        <div className="mt-4 bg-white/10 rounded-2xl p-4">
          <p className="stencil text-[11px] opacity-80">Acertos</p>
          <p className="font-display text-4xl font-bold">{attempt.correct}<span className="text-xl opacity-70">/{attempt.total}</span></p>
          <p className="stencil text-sm text-warning mt-1">{pct}% de aproveitamento</p>
        </div>
      </header>
      <main className="px-5 py-5 space-y-4">
        <section>
          <h2 className="font-display font-bold mb-2">Acertos por matéria</h2>
          <div className="space-y-2">
            {bySub.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {bySub.map((s) => (
              <div key={s.name} className="bg-card border border-border rounded-xl p-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-display font-semibold">{s.name}</span>
                  <span className="stencil text-xs text-muted-foreground">{s.correct}/{s.total}</span>
                </div>
                <Progress value={s.total > 0 ? (s.correct / s.total) * 100 : 0} className="h-1.5 mt-2" />
              </div>
            ))}
          </div>
        </section>
        <Link to={`/simulado/${attempt.id}/revisar`} className="flex items-center justify-between bg-gradient-flame text-white rounded-2xl px-5 py-4 shadow-flame">
          <div>
            <p className="stencil text-[11px] opacity-90">Aprenda com seus erros</p>
            <p className="font-display text-lg font-bold">Revisar questões</p>
          </div>
          <ChevronRight className="w-5 h-5" />
        </Link>
        <Button variant="outline" className="w-full stencil" onClick={() => navigate("/simulados")}>Voltar para simulados</Button>
      </main>
    </div>
  );
};

export default SimuladoRunner;
