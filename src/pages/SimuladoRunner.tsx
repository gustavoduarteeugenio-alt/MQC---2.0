import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useExam } from "@/contexts/ExamContext";
import { ContentNode, disciplineOf, fetchContentNodes } from "@/lib/exams";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Trophy, Lightbulb, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { QuestionImage } from "@/components/QuestionImage";
import { RichText } from "@/components/RichText";

type Letter = "A" | "B" | "C" | "D" | "E";
type Q = {
  id: string; content_node_id: string | null; statement: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  option_e: string | null; correct_answer: Letter; explanation: string;
  image_url: string | null; comment_image_url: string | null;
};
type Answer = { question_id: string; selected: Letter | null };
type AttemptRow = {
  id: string; user_id: string; exam_id: string | null; simulado_id: string | null;
  mode: string; title: string | null;
  total: number; correct: number; started_at: string; finished_at: string | null;
  duration_seconds: number | null; answers: Answer[]; by_subject: any;
};

const DEFAULT_SECONDS = 4 * 60 * 60;

const SimuladoRunner = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { enrollments } = useExam();
  const isReviewRoute = location.pathname.endsWith("/revisar");

  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS);
  // A árvore é a do edital DESTE simulado, que pode não ser o edital ativo
  // agora (o aluno pode ter trocado de edital depois de fazer a prova).
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  // Duração de um simulado inédito é a cadastrada nele; a de um aleatório é a
  // da prova do edital. Nunca mais um valor fixo no código.
  const [simMinutes, setSimMinutes] = useState<number | null>(null);
  const finishedRef = useRef(false);

  const totalSeconds = useMemo(() => {
    if (simMinutes) return simMinutes * 60;
    const min = enrollments.find((e) => e.exam.id === attempt?.exam_id)?.exam.duration_minutes;
    return (min ?? 240) * 60;
  }, [simMinutes, enrollments, attempt?.exam_id]);

  useEffect(() => {
    (async () => {
      const { data: a } = await (supabase as any).from("simulado_attempts").select("*").eq("id", id!).maybeSingle();
      if (!a) { navigate("/simulados"); return; }
      const att = a as AttemptRow;
      setAttempt(att);
      setAnswers(att.answers ?? []);
      if (att.exam_id) setNodes(await fetchContentNodes(att.exam_id));
      if (att.simulado_id) {
        const { data: sim } = await (supabase as any)
          .from("simulados").select("duration_minutes").eq("id", att.simulado_id).maybeSingle();
        if (sim?.duration_minutes) setSimMinutes(Number(sim.duration_minutes));
      }
      const ids = (att.answers ?? []).map((x) => x.question_id);
      if (ids.length) {
        // A classificação da questão é a do edital deste simulado: a mesma
        // questão pode estar em outro nó em outro edital.
        const [{ data: qs }, { data: links }] = await Promise.all([
          supabase.from("questions").select("id, statement, option_a, option_b, option_c, option_d, option_e, image_url").in("id", ids),
          att.exam_id
            ? (supabase as any).from("exam_questions").select("question_id, content_node_id").eq("exam_id", att.exam_id).in("question_id", ids)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        const nodeByQuestion: Record<string, string | null> = {};
        ((links ?? []) as any[]).forEach((l: any) => { nodeByQuestion[l.question_id] = l.content_node_id ?? null; });
        const map: Record<string, Q> = {};
        (qs ?? []).forEach((q: any) => {
          map[q.id] = {
            ...q,
            content_node_id: nodeByQuestion[q.id] ?? null,
            correct_answer: "" as Letter, explanation: "", comment_image_url: null,
          } as Q;
        });
        // Se o simulado já foi finalizado, buscamos os gabaritos para revisão
        if (att.finished_at) {
          const { data: reveal } = await (supabase as any).rpc("reveal_questions_answers", { _ids: ids });
          ((reveal as any[]) ?? []).forEach((r: any) => {
            if (map[r.id]) {
              map[r.id].correct_answer = (r.correct_answer ?? "").toUpperCase() as Letter;
              map[r.id].explanation = r.explanation ?? "";
              map[r.id].comment_image_url = r.comment_image_url ?? null;
            }
          });
        }
        setQuestions(ids.map((qid) => map[qid]).filter(Boolean));
      }
      setLoading(false);
    })();
  }, [id, navigate]);

  // O relógio só é ajustado quando sabemos a duração do edital.
  useEffect(() => {
    if (!attempt || attempt.finished_at) return;
    const inicio = new Date(attempt.started_at).getTime();
    const elapsed = Number.isFinite(inicio) ? Math.floor((Date.now() - inicio) / 1000) : 0;
    setRemaining(Math.max(0, totalSeconds - elapsed));
  }, [totalSeconds, attempt?.id, attempt?.finished_at, attempt?.started_at]);

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
    // Busca gabaritos de todas as questões via RPC segura
    const ids = questions.map((q) => q.id);
    const { data: reveal } = await (supabase as any).rpc("reveal_questions_answers", { _ids: ids });
    const answerMap: Record<string, { c: Letter; e: string; img: string | null }> = {};
    ((reveal as any[]) ?? []).forEach((r: any) => {
      answerMap[r.id] = {
        c: ((r.correct_answer ?? "") as string).toUpperCase() as Letter,
        e: r.explanation ?? "",
        img: r.comment_image_url ?? null,
      };
    });
    // Atualiza as questões em memória para permitir a revisão
    setQuestions((prev) => prev.map((q) => answerMap[q.id]
      ? { ...q, correct_answer: answerMap[q.id].c, explanation: answerMap[q.id].e, comment_image_url: answerMap[q.id].img }
      : q
    ));
    let correct = 0;
    // Agrupamos pela disciplina (nível 1) do edital — é a leitura que o aluno
    // reconhece no boletim e a mesma usada na estatística do treino.
    const bySubject: Record<string, { name: string; correct: number; total: number }> = {};
    questions.forEach((q) => {
      const ans = answers.find((a) => a.question_id === q.id);
      const correctLetter = answerMap[q.id]?.c;
      const ok = !!correctLetter && ans?.selected === correctLetter;
      if (ok) correct++;
      const disc = disciplineOf(nodes, q.content_node_id);
      const key = disc?.id ?? "outros";
      if (!bySubject[key]) bySubject[key] = { name: disc?.name ?? "Outros", correct: 0, total: 0 };
      bySubject[key].total++;
      if (ok) bySubject[key].correct++;
    });
    const finished_at = new Date().toISOString();
    const duration = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
    const by_subject = Object.values(bySubject);
    if (user) {
      const rows = questions.map((q) => {
        const ans = answers.find((a) => a.question_id === q.id);
        if (!ans?.selected) return null;
        const correctLetter = answerMap[q.id]?.c;
        return {
          user_id: user.id,
          question_id: q.id,
          selected_answer: ans.selected as string,
          is_correct: !!correctLetter && ans.selected === correctLetter,
          time_seconds: 0,
          exam_id: attempt.exam_id ?? null,
          content_node_id: q.content_node_id ?? null,
        };
      }).filter(Boolean) as any[];
      if (rows.length) await (supabase as any).from("attempts").insert(rows);
    }
    await (supabase as any).from("simulado_attempts").update({
      finished_at, duration_seconds: duration, total: questions.length, correct, by_subject,
    }).eq("id", id!);
    setAttempt({ ...attempt, finished_at, duration_seconds: duration, correct, total: questions.length, by_subject });
    if (auto) toast.error("Tempo esgotado! Simulado finalizado.");
  };

  if (loading || !attempt) {
    return <div className="app-shell flex items-center justify-center bg-gradient-dark text-white">Carregando...</div>;
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
            <p className="stencil text-[10px] text-muted-foreground mb-2">
              {disciplineOf(nodes, current.content_node_id)?.name ?? ""}
            </p>
            <RichText content={current.statement} className="text-[15px] leading-relaxed" />
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
                  <RichText content={text} className="text-sm leading-snug pt-1" />
                </button>
              );
            })}
          </div>

          {reviewMode && (
            <div className="mt-5 bg-secondary text-secondary-foreground rounded-2xl p-5">
              <div className="flex items-center gap-2 stencil text-warning text-xs mb-2">
                <Lightbulb className="w-4 h-4" /> Comentário do professor
              </div>
              <div className="text-sm leading-relaxed">
                <strong className="font-display">Resposta correta: {current.correct_answer}.</strong>{" "}
                <RichText content={current.explanation} />
              </div>
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
            className="flex-1 bg-gradient-brand text-white font-display stencil shadow-brand"
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
      <header className="bg-gradient-dark text-white px-5 pt-12 pb-8 rounded-b-3xl">
        <button
          onClick={() => navigate("/simulados")}
          className="w-10 h-10 -ml-2 mb-2 flex items-center justify-center rounded-full hover:bg-white/10"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
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
        <Link to={`/simulado/${attempt.id}/revisar`} className="flex items-center justify-between bg-gradient-brand text-white rounded-2xl px-5 py-4 shadow-brand">
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
