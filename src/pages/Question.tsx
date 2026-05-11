import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePremiumFeatures } from "@/hooks/usePremiumFeatures";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Lock, Flame, Lightbulb, Crown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PlanSelectionDialog } from "@/components/PlanSelectionDialog";
import { QuestionImage } from "@/components/QuestionImage";

type Letter = "A" | "B" | "C" | "D" | "E";
type Question = {
  id: string; subject_id: string; statement: string;
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
  const { isPremium, canAnswerMore, dailyCount, dailyLimit, incrementDaily, refresh } = useProfile();
  const { fullExplanations } = usePremiumFeatures();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Letter | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const startRef = useRef<number>(Date.now());

  const current = questions[index];

  useEffect(() => {
    (async () => {
      const { data: sub } = await supabase.from("subjects").select("*").eq("slug", slug!).maybeSingle();
      if (!sub) { navigate("/materias"); return; }
      setSubject(sub as Subject);
      const { data: qs } = await supabase.from("questions").select("*").eq("subject_id", sub.id).limit(50);
      // shuffle
      const shuffled = (qs ?? []).sort(() => Math.random() - 0.5);
      setQuestions(shuffled as Question[]);
      setLoading(false);
    })();
  }, [slug, navigate]);

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

  const confirm = async () => {
    if (!selected || !current || !user) return;
    if (!canAnswerMore) {
      toast.error("Você atingiu o limite diário do plano básico.");
      return;
    }
    const isCorrect = selected === current.correct_answer;
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    setConfirmed(true);
    await Promise.all([
      supabase.from("attempts").insert({
        user_id: user.id,
        question_id: current.id,
        selected_answer: selected,
        is_correct: isCorrect,
        time_seconds: elapsed,
      }),
      incrementDaily(),
    ]);
    if (isCorrect) toast.success("Resposta correta, soldado!");
    else toast.error("Resposta incorreta. Estude o gabarito.");
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      refresh();
      navigate("/dashboard");
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setConfirmed(false);
  };

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center bg-gradient-night">
        <Flame className="w-10 h-10 text-primary animate-pulse-flame" />
      </div>
    );
  }

  if (!canAnswerMore && !confirmed) {
    return (
      <div className="app-shell bg-background flex flex-col">
        <TopBar onBack={() => navigate("/materias")} title={subject?.name ?? ""} />
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full text-center shadow-flame animate-fade-in">
            <div className="w-14 h-14 mx-auto rounded-full bg-gradient-flame flex items-center justify-center shadow-flame mb-4">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h2 className="font-display text-2xl font-bold">Limite atingido</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Você já respondeu {dailyCount}/{dailyLimit} questões hoje no plano básico.
              O contador reinicia à meia-noite.
            </p>
            <PlanSelectionDialog>
              <button className="mt-5 w-full flex items-center justify-center gap-2 bg-gradient-flame text-white rounded-xl py-3 font-display stencil shadow-flame">
                <Crown className="w-4 h-4" /> Tornar-se Premium para questões ilimitadas
              </button>
            </PlanSelectionDialog>
            <button onClick={() => navigate("/materias")} className="mt-3 w-full text-xs stencil text-muted-foreground hover:text-foreground">
              Voltar para matérias
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="app-shell bg-background flex flex-col">
        <TopBar onBack={() => navigate("/materias")} title={subject?.name ?? ""} />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center text-muted-foreground">
          Ainda não há questões nesta matéria.
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell bg-background flex flex-col min-h-screen">
      <TopBar
        onBack={() => navigate("/materias")}
        title={subject?.name ?? ""}
        right={
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground stencil text-xs">
            <Clock className="w-3.5 h-3.5" /> {fmtTime}
          </div>
        }
      />

      <div className="px-5 pt-3">
        <div className="flex items-center justify-between text-xs stencil text-muted-foreground mb-2">
          <span>Questão {index + 1}/{questions.length}</span>
          {!isPremium && <span>Diário: {dailyCount}/{dailyLimit}</span>}
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-flame transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <main className="flex-1 px-5 pt-5 pb-32">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card animate-fade-in">
          <p className="text-[15px] leading-relaxed">{current.statement}</p>
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
                <span className="text-sm leading-snug pt-1">{text}</span>
              </button>
            );
          })}
        </div>

        {confirmed && (
          <div className="mt-5 bg-secondary text-secondary-foreground rounded-2xl p-5 animate-fade-in">
            <div className="flex items-center gap-2 stencil text-warning text-xs mb-2">
              <Lightbulb className="w-4 h-4" /> Gabarito {fullExplanations ? "comentado" : "(resumido)"}
            </div>
            <p className="text-sm leading-relaxed">
              <strong className="font-display">Resposta correta: {current.correct_answer}.</strong>{" "}
              {fullExplanations ? (
                current.explanation
              ) : (
                <span className="opacity-80">
                  Comentário completo do professor disponível apenas no Premium.
                </span>
              )}
            </p>
            {!fullExplanations && (
              <PlanSelectionDialog>
                <button className="mt-3 w-full flex items-center justify-center gap-1.5 bg-gradient-flame text-white rounded-xl py-2.5 font-display stencil text-xs shadow-flame">
                  <Crown className="w-4 h-4" /> Desbloquear gabarito comentado
                </button>
              </PlanSelectionDialog>
            )}
          </div>
        )}
      </main>

      {/* Botão fixo */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-gradient-to-t from-background via-background to-transparent">
        {!confirmed ? (
          <Button onClick={confirm} disabled={!selected}
            className="w-full h-13 py-3.5 bg-gradient-flame text-white font-display text-base stencil shadow-flame disabled:opacity-50">
            Confirmar resposta
          </Button>
        ) : (
          <Button onClick={next}
            className="w-full h-13 py-3.5 bg-secondary text-secondary-foreground font-display text-base stencil shadow-card">
            {index + 1 >= questions.length ? "Finalizar treino" : "Próxima questão →"}
          </Button>
        )}
      </div>
    </div>
  );
};

const TopBar = ({ onBack, title, right }: { onBack: () => void; title: string; right?: React.ReactNode }) => (
  <header className="flex items-center justify-between px-4 pt-12 pb-3 bg-card border-b border-border sticky top-0 z-30">
    <button onClick={onBack} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-muted">
      <ArrowLeft className="w-5 h-5" />
    </button>
    <h1 className="font-display font-bold truncate flex-1 text-center px-2">{title}</h1>
    <div className="min-w-[80px] flex justify-end">{right}</div>
  </header>
);

export default Question;
