import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, XCircle, Flame, Lightbulb, LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { QuestionImage } from "@/components/QuestionImage";
import { RichText } from "@/components/RichText";
import { useExam } from "@/contexts/ExamContext";
import { nodeBySlug, subtreeIds } from "@/lib/exams";

type Letter = "A" | "B" | "C" | "D" | "E";
type Question = {
  id: string; subject_id: string; content_node_id?: string | null; statement: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  option_e: string | null;
  correct_answer: Letter; explanation: string;
  image_url: string | null; comment_image_url: string | null;
};
type Subject = { id: string; name: string; slug: string };

const Question = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { incrementDaily, refresh } = useProfile();
  const { exam, nodes, loading: examLoading } = useExam();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Letter | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [sessionBySubject, setSessionBySubject] = useState<Record<string, { id: string; name: string; slug: string; correct: number; wrong: number }>>({});
  const sessionStartRef = useRef<number>(Date.now());
  const startRef = useRef<number>(Date.now());

  const current = questions[index];

  useEffect(() => {
    if (examLoading) return;
    (async () => {
      setLoading(true);
      // O nó vem da árvore do edital ativo; treinar um tópico inclui seus subtópicos
      const node = exam ? nodeBySlug(nodes, slug!) : null;
      if (!exam || !node) { navigate("/materias"); return; }
      setSubject({ id: node.id, name: node.name, slug: node.slug });
      const escopo = subtreeIds(nodes, node.id);

      // 1) Questões publicadas do edital dentro desse escopo (paginado: teto do PostgREST)
      const vinculos: { question_id: string; content_node_id: string | null }[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data: page } = await (supabase as any)
          .from("exam_questions")
          .select("question_id, content_node_id")
          .eq("exam_id", exam.id)
          .eq("status", "published")
          .in("content_node_id", escopo)
          .range(from, from + PAGE - 1);
        const rows = page ?? [];
        vinculos.push(...rows);
        if (rows.length < PAGE) break;
      }
      const noDaQuestao = new Map(vinculos.map((v) => [v.question_id, v.content_node_id]));
      const allIds = vinculos.map((v) => v.question_id);

      // 2) Exclui as já respondidas pelo aluno NESTE edital
      let candidateIds = allIds;
      if (user && allIds.length > 0) {
        const done = new Set<string>();
        for (let from = 0; ; from += PAGE) {
          const { data: page } = await (supabase as any)
            .from("attempts")
            .select("question_id")
            .eq("user_id", user.id)
            .eq("exam_id", exam.id)
            .range(from, from + PAGE - 1);
          const rows = page ?? [];
          rows.forEach((r: any) => done.add(r.question_id));
          if (rows.length < PAGE) break;
        }
        const fresh = allIds.filter((id) => !done.has(id));
        // Se sobraram inéditas, usa só elas; senão libera repetição (modo revisão)
        if (fresh.length > 0) candidateIds = fresh;
      }

      // 3) Sorteio Fisher–Yates e escolhe até 10 ids únicos
      const BLOCK_SIZE = 10;
      const arr = [...candidateIds];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      const pickIds = Array.from(new Set(arr)).slice(0, BLOCK_SIZE);

      // 4) Busca as colunas seguras somente para os ids sorteados
      let picked: any[] = [];
      if (pickIds.length > 0) {
        const { data } = await supabase
          .from("questions")
          .select("id, subject_id, statement, option_a, option_b, option_c, option_d, option_e, image_url")
          .in("id", pickIds);
        const byId = new Map((data ?? []).map((q: any) => [q.id, q]));
        picked = pickIds
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((q: any) => ({ ...q, content_node_id: noDaQuestao.get(q.id) ?? node.id }));
      }

      setQuestions(picked as Question[]);
      setIndex(0);
      setSelected(null);
      setConfirmed(false);
      setLoading(false);
    })();
  }, [slug, navigate, user, exam, nodes, examLoading]);

  useEffect(() => {
    startRef.current = Date.now();
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [index]);

  const fmtTime = useMemo(() => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [seconds]);

  const sessionTotals = useMemo(() => {
    const list = Object.values(sessionBySubject);
    const totalCorrect = list.reduce((acc, s) => acc + s.correct, 0);
    const totalWrong = list.reduce((acc, s) => acc + s.wrong, 0);
    return { totalCorrect, totalWrong, totalAnswered: totalCorrect + totalWrong };
  }, [sessionBySubject]);

  const endTraining = () => {
    const bySubject = Object.values(sessionBySubject).map((s) => ({
      ...s,
      accuracy: s.correct + s.wrong > 0
        ? Math.round((s.correct / (s.correct + s.wrong)) * 100)
        : 0,
    }));
    const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
    refresh();
    navigate("/treino/resumo", {
      state: {
        bySubject,
        totalCorrect: sessionTotals.totalCorrect,
        totalWrong: sessionTotals.totalWrong,
        durationSeconds,
      },
    });
  };

  const confirm = async () => {
    if (!selected || !current || !user) return;
    // Busca o gabarito de forma segura (RPC SECURITY DEFINER)
    const { data: reveal } = await (supabase as any).rpc("reveal_question_answer", { _qid: current.id });
    const correct = ((reveal?.correct_answer as string) ?? "").toUpperCase() as Letter;
    const explanation = (reveal?.explanation as string) ?? "";
    const commentImg = (reveal?.comment_image_url as string | null) ?? null;
    // Atualiza a questão atual com os campos sensíveis somente após a resposta
    setQuestions((prev) => prev.map((q, i) => i === index ? { ...q, correct_answer: correct, explanation, comment_image_url: commentImg } : q));
    const isCorrect = selected === correct;
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    setConfirmed(true);
    setCorrectStreak((s) => (isCorrect ? s + 1 : 0));
    if (subject) {
      setSessionBySubject((prev) => {
        const cur = prev[subject.id] ?? { id: subject.id, name: subject.name, slug: subject.slug, correct: 0, wrong: 0 };
        return {
          ...prev,
          [subject.id]: {
            ...cur,
            correct: cur.correct + (isCorrect ? 1 : 0),
            wrong: cur.wrong + (isCorrect ? 0 : 1),
          },
        };
      });
    }
    await Promise.all([
      // exam_id e content_node_id gravados na resposta: sem eles não existe
      // estatística por edital nem por assunto, e não há como recalcular depois
      (supabase as any).from("attempts").insert({
        user_id: user.id,
        question_id: current.id,
        selected_answer: selected,
        is_correct: isCorrect,
        time_seconds: elapsed,
        exam_id: exam?.id ?? null,
        content_node_id: (current as any).content_node_id ?? null,
      }),
      incrementDaily(),
    ]);
    if (isCorrect) toast.success("Resposta correta, soldado!");
    else toast.error("Resposta incorreta. Estude o gabarito.");
  };

  const next = async () => {
    if (!user || !subject || !current) {
      refresh();
      navigate("/dashboard");
      return;
    }
    // Mantém o aluno estritamente na matéria selecionada
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(null);
      setConfirmed(false);
      return;
    }

    // Bloco de 10 questões concluído → encerra treino e volta ao dashboard
    refresh();
    toast.success("Bloco concluído! Você respondeu as 10 questões desta matéria.");
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center bg-gradient-night">
        <Flame className="w-10 h-10 text-primary animate-pulse-flame" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="app-shell bg-background flex flex-col">
        <TopBar title={subject?.name ?? ""} />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center text-muted-foreground">
          Ainda não há questões nesta matéria.
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell bg-background flex flex-col min-h-screen">
      <TopBar
        title={subject?.name ?? ""}
        right={
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground stencil text-xs">
            <Clock className="w-3.5 h-3.5" /> {fmtTime}
          </div>
        }
      />

      <div className="px-5 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 py-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="stencil text-[11px] text-muted-foreground tracking-widest">Acertos</span>
            <span className="font-display font-bold text-success">{sessionTotals.totalCorrect}</span>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 py-2">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="stencil text-[11px] text-muted-foreground tracking-widest">Erros</span>
            <span className="font-display font-bold text-destructive">{sessionTotals.totalWrong}</span>
          </div>
        </div>
      </div>

      {/* pb acompanha a barra fixa: com o gabarito aberto ela tem dois botões e fica mais alta */}
      <main className={cn("flex-1 px-5 pt-5", confirmed ? "pb-48" : "pb-32")}>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card animate-fade-in">
          <RichText content={current.statement} className="text-[15px] leading-relaxed" />
          {current.image_url && <QuestionImage src={current.image_url} alt="Imagem do enunciado" />}
        </div>

        <div className="mt-4 space-y-2.5">
          {(["A", "B", "C", "D", "E"] as const).filter((l) => {
            const t = (current as any)[`option_${l.toLowerCase()}`];
            return typeof t === "string" && t.trim().length > 0;
          }).map((letter) => {
            const text = (current as any)[`option_${letter.toLowerCase()}`] as string;
            const isCorrect = letter === current.correct_answer;
            const isSelected = selected === letter;
            const showResult = confirmed;
            return (
              <button
                key={letter}
                disabled={confirmed}
                onClick={() => setSelected(letter)}
                className={cn(
                  "w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-all",
                  !showResult && isSelected && "border-primary bg-primary/5",
                  !showResult && !isSelected && "border-border bg-card hover:border-primary/40",
                  showResult && isCorrect && "border-success bg-success/10",
                  showResult && !isCorrect && isSelected && "border-destructive bg-destructive/10",
                  showResult && !isCorrect && !isSelected && "border-border bg-card opacity-60"
                )}
              >
                <span className={cn(
                  "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold",
                  !showResult && isSelected && "bg-primary text-primary-foreground",
                  !showResult && !isSelected && "bg-muted text-foreground",
                  showResult && isCorrect && "bg-success text-success-foreground",
                  showResult && !isCorrect && isSelected && "bg-destructive text-destructive-foreground",
                )}>
                  {showResult && isCorrect ? <CheckCircle2 className="w-4 h-4" /> :
                   showResult && !isCorrect && isSelected ? <XCircle className="w-4 h-4" /> : letter}
                </span>
                <RichText content={text} className="text-sm leading-snug pt-1" />
              </button>
            );
          })}
        </div>

        {confirmed && (
          <div className="mt-5 bg-secondary text-secondary-foreground rounded-2xl p-5 animate-fade-in">
            <div className="flex items-center gap-2 stencil text-warning text-xs mb-2">
              <Lightbulb className="w-4 h-4" /> Gabarito comentado
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

      {/* Botões fixos */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-gradient-to-t from-background via-background to-transparent space-y-2.5">
        {!confirmed ? (
          <Button onClick={confirm} disabled={!selected}
            className="w-full h-13 py-3.5 bg-gradient-flame text-white font-display text-base stencil shadow-flame disabled:opacity-50">
            Confirmar resposta
          </Button>
        ) : (
          <Button onClick={next}
            className="w-full h-13 py-3.5 bg-secondary text-secondary-foreground font-display text-base stencil shadow-card">
            Próxima questão →
          </Button>
        )}
        {sessionTotals.totalAnswered > 0 && (
          <Button
            onClick={endTraining}
            variant="outline"
            className="w-full h-12 py-3 border-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive font-display text-sm stencil"
          >
            <LogOut className="w-4 h-4 mr-2" /> Encerrar treino
          </Button>
        )}
      </div>
    </div>
  );
};

const TopBar = ({ title, right }: { title: string; right?: React.ReactNode }) => (
  <header className="flex items-center justify-between px-4 pt-12 pb-3 bg-card border-b border-border sticky top-0 z-30">
    <div className="min-w-[80px]" />
    <h1 className="font-display font-bold truncate flex-1 text-center px-2">{title}</h1>
    <div className="min-w-[80px] flex justify-end">{right}</div>
  </header>
);

export default Question;
