import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, ChevronRight, Loader2, CheckCircle2, XCircle, Crown, Lightbulb } from "lucide-react";
import { RichText } from "@/components/RichText";
import { QuestionImage } from "@/components/QuestionImage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PER_SUBJECT = 2;
const MASTERY_TARGET = 80;
const TOKEN_KEY = "diag_client_token";
const PENDING_KEY = "diag_pending_token";

type Question = {
  id: string;
  subject_id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string | null;
  correct_answer: string;
  explanation: string;
  image_url: string | null;
  comment_image_url: string | null;
  subjects?: { id: string; name: string };
};

type SubjectResult = {
  subject_id: string;
  subject_name: string;
  total: number;
  correct: number;
  pct: number;
};

type Stage = "intro" | "quiz" | "lead" | "result";

const getToken = () => {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
};

const Diagnostico = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("intro");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState<SubjectResult[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [leadName, setLeadName] = useState("");
  const [leadInsta, setLeadInsta] = useState("");
  const [savingLead, setSavingLead] = useState(false);

  // Se já tem usuário logado, vai para Home
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate("/", { replace: true });
    });
  }, [navigate]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
        "get_diagnostic_questions",
        { _per_subject: PER_SUBJECT }
      );
      if (rpcErr) {
        console.error(rpcErr);
        toast.error("Falha ao carregar o diagnóstico.");
        return;
      }
      const list = (rpcData as any[]) ?? [];
      if (list.length < PER_SUBJECT) {
        toast.error("Banco de questões insuficiente para o diagnóstico.");
        return;
      }

      // Intercala matérias de forma determinística (sem shuffle)
      const bySubject = new Map<string, Question[]>();
      for (const q of list) {
        const mapped: Question = {
          id: q.id,
          subject_id: q.subject_id,
          statement: q.statement,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          option_e: q.option_e,
          correct_answer: "",
          explanation: "",
          image_url: q.image_url,
          comment_image_url: null,
          subjects: { id: q.subject_id, name: q.subject_name },
        };
        const arr = bySubject.get(q.subject_id) ?? [];
        arr.push(mapped);
        bySubject.set(q.subject_id, arr);
      }
      bySubject.forEach((arr) => arr.sort((a, b) => a.id.localeCompare(b.id)));
      const final: Question[] = [];
      let added = true;
      while (added) {
        added = false;
        for (const arr of bySubject.values()) {
          const next = arr.shift();
          if (next) { final.push(next); added = true; }
        }
      }

      setQuestions(final);
      setIdx(0);
      setAnswers({});
      setSelected(null);
      setConfirmed(false);

      const token = getToken();
      const { data: newId, error } = await (supabase as any).rpc(
        "create_diagnostic_session",
        { _client_token: token, _total: final.length }
      );
      if (error) console.error(error);
      else setSessionId(newId as string);

      setStage("quiz");
    } finally {
      setLoading(false);
    }
  };


  const current = questions[idx];
  const options = useMemo(() => {
    if (!current) return [];
    return ["a", "b", "c", "d", "e"]
      .map((l) => ({ letter: l, text: (current as any)[`option_${l}`] as string | null }))
      .filter((o) => o.text && (o.text as string).trim().length > 0);
  }, [current]);

  const confirm = () => {
    if (!selected || !current) return;
    const sel = selected.toUpperCase();
    setAnswers((prev) => ({ ...prev, [current.id]: sel }));
    // Avança imediatamente — sem revelar gabarito durante o diagnóstico
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      setSelected(null);
      setConfirmed(false);
      return;
    }
    // Última questão: dispara o fluxo de finalização com a resposta atual já incluída
    void finalize({ ...answers, [current.id]: sel });
  };


  const finalize = async (finalAnswers: Record<string, string>) => {
    const token = getToken();
    const answersArray = Object.entries(finalAnswers).map(([qid, ans]) => ({ qid, ans }));

    let finalRes: SubjectResult[] = [];
    let totalCorrect = 0;
    let totalQ = 0;

    if (sessionId) {
      const { data, error } = await (supabase as any).rpc("submit_diagnostic_answers", {
        _session_id: sessionId,
        _client_token: token,
        _answers: answersArray,
      });
      if (error) {
        console.error(error);
        toast.error("Falha ao salvar o diagnóstico.");
      } else if (data) {
        finalRes = ((data as any).results as SubjectResult[]) ?? [];
        totalCorrect = (data as any).correct ?? 0;
        totalQ = (data as any).total ?? 0;
        localStorage.setItem(PENDING_KEY, token);
      }
    }

    setResults(finalRes);

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase
        .from("profiles")
        .update({
          diagnostic_completed_at: new Date().toISOString(),
          diagnostic_results: { results: finalRes, correct: totalCorrect, total: totalQ } as any,
        })
        .eq("user_id", userData.user.id);
      setStage("result");
      return;
    }

    setStage("lead");
  };



  // ---------------- INTRO ----------------
  if (stage === "intro") {
    return (
      <div className="app-shell bg-gradient-night text-white flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6 py-10 text-center max-w-md mx-auto">
          <div className="inline-flex self-center items-center justify-center w-20 h-20 rounded-2xl bg-gradient-flame shadow-flame mb-6">
            <Target className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <p className="stencil text-xs text-primary">Diagnóstico oficial · CFSd CBMMG</p>
          <h1 className="text-3xl font-display font-bold mt-2 leading-tight">
            Se a prova do CFSd fosse <span className="text-primary">hoje</span>, você passaria?
          </h1>
          <p className="text-sm text-white/80 mt-3 font-medium">
            Descubra em 5 minutos seu nível real de preparo.
          </p>
          <p className="text-sm text-white/70 mt-3 leading-relaxed">
            12 questões no padrão IDECAN da banca. Ao final, você recebe seu <strong className="text-white">Índice de Prontidão</strong> e vê exatamente quais matérias podem te reprovar.
          </p>

          <ul className="mt-6 space-y-2 text-left text-sm">
            <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" /> Comece agora, sem cadastro</li>
            <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" /> Percentual de acerto matéria por matéria</li>
            <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" /> Veja se você está na zona de aprovação (≥ {MASTERY_TARGET}%)</li>
          </ul>

          <Button
            onClick={loadQuestions}
            disabled={loading}
            className="mt-8 h-14 bg-gradient-flame text-white font-display text-base stencil shadow-flame"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Quero saber se passaria <ChevronRight className="w-5 h-5 ml-1" /></>}
          </Button>

          <Link to="/auth" className="mt-4 text-xs text-white/50 hover:text-white">
            Já tenho conta · Entrar
          </Link>
        </div>
      </div>
    );
  }

  // ---------------- QUIZ ----------------
  if (stage === "quiz" && current) {
    const progress = ((idx + 1) / questions.length) * 100;
    const isLast = idx + 1 === questions.length;
    return (
      <div className="app-shell bg-background flex flex-col min-h-screen">
        <header className="bg-gradient-night text-white px-5 pt-8 pb-5">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="stencil text-primary">Diagnóstico</span>
              <span className="text-white/70">{idx + 1} / {questions.length}</span>
            </div>
            <Progress value={progress} className="h-1.5 mt-3 bg-white/10" />
            {current.subjects && (
              <p className="stencil text-[10px] text-white/60 mt-3">
                {current.subjects.name}
              </p>
            )}
          </div>
        </header>


        <main className="px-5 py-5 flex-1 max-w-xl mx-auto w-full pb-32">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
            <RichText content={current.statement} className="text-foreground text-[15px] leading-relaxed" />
            {current.image_url && <QuestionImage src={current.image_url} alt="Imagem do enunciado" />}
          </div>

          <div className="mt-4 space-y-2.5">
            {options.map((o) => {
              const letter = o.letter.toUpperCase();
              const isSel = selected?.toUpperCase() === letter;
              return (
                <button
                  key={o.letter}
                  type="button"
                  onClick={() => setSelected(o.letter)}
                  className={cn(
                    "w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-all",
                    isSel ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span className={cn(
                    "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold",
                    isSel ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  )}>
                    {letter}
                  </span>
                  <RichText content={o.text!} className="text-sm leading-snug pt-1 flex-1" />
                </button>
              );
            })}
          </div>
        </main>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-gradient-to-t from-background via-background to-transparent">
          <Button
            onClick={confirm}
            disabled={!selected}
            className="w-full h-13 py-3.5 bg-gradient-flame text-white font-display text-base stencil shadow-flame disabled:opacity-50"
          >
            {isLast ? "Ver meu resultado" : "Próxima questão →"}
          </Button>
        </div>

      </div>
    );
  }

  // ---------------- LEAD CAPTURE ----------------
  if (stage === "lead") {
    const submitLead = async (e: React.FormEvent) => {
      e.preventDefault();
      const name = leadName.trim();
      const insta = leadInsta.trim().replace(/^@/, "");
      if (name.length < 2) { toast.error("Informe seu nome."); return; }
      if (insta.length < 2) { toast.error("Informe seu @ do Instagram."); return; }
      setSavingLead(true);
      try {
        if (sessionId) {
          await supabase
            .from("diagnostic_sessions")
            .update({ lead_name: name, instagram_handle: insta } as any)
            .eq("id", sessionId);
        }
        setStage("result");
      } finally {
        setSavingLead(false);
      }
    };

    return (
      <div className="app-shell bg-gradient-night text-white flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md mx-auto w-full">
          <div className="inline-flex self-center items-center justify-center w-16 h-16 rounded-2xl bg-gradient-flame shadow-flame mb-5">
            <Target className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <p className="stencil text-xs text-primary text-center">Quase lá, recruta</p>
          <h1 className="text-2xl font-display font-bold mt-2 text-center leading-tight">
            Seu resultado está pronto.
          </h1>
          <p className="text-sm text-white/75 mt-2 text-center">
            Preencha rapidinho para liberar seu <strong className="text-white">Índice de Prontidão</strong> completo.
          </p>

          <form onSubmit={submitLead} className="mt-6 space-y-3">
            <div>
              <label className="stencil text-[10px] text-white/60">Seu nome</label>
              <input
                type="text"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                maxLength={80}
                placeholder="Ex.: João Silva"
                className="w-full mt-1 h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="stencil text-[10px] text-white/60">@ do Instagram</label>
              <div className="mt-1 flex items-center h-12 rounded-xl bg-white/10 border border-white/20 focus-within:border-primary">
                <span className="pl-4 text-white/50">@</span>
                <input
                  type="text"
                  value={leadInsta}
                  onChange={(e) => setLeadInsta(e.target.value.replace(/^@/, ""))}
                  maxLength={40}
                  placeholder="seu.perfil"
                  className="flex-1 h-full px-2 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={savingLead}
              className="w-full h-13 mt-4 py-3.5 bg-gradient-flame text-white font-display text-base stencil shadow-flame"
            >
              {savingLead ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Liberar meu resultado <ChevronRight className="w-5 h-5 ml-1" /></>}
            </Button>

            <p className="text-[11px] text-white/50 text-center mt-3">
              Usamos seus dados apenas para te enviar dicas sobre o concurso. Sem spam.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ---------------- RESULT ----------------
  const totalQuestions = results.reduce((s, r) => s + r.total, 0);
  const totalCorrect = results.reduce((s, r) => s + r.correct, 0);
  const totalWrong = totalQuestions - totalCorrect;
  const overallPct = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const weak = results.filter((r) => r.pct < MASTERY_TARGET);
  const strong = results.filter((r) => r.pct >= MASTERY_TARGET);


  const tone: "success" | "warning" | "destructive" =
    overallPct >= MASTERY_TARGET ? "success" : overallPct >= 60 ? "warning" : "destructive";

  const verdict =
    overallPct >= MASTERY_TARGET
      ? {
          label: `Prontidão: ${overallPct}% — você passaria hoje.`,
          sub: weak.length === 0
            ? "Você está dentro da meta em todas as matérias. Hora de blindar o resultado até a prova."
            : `${weak.length} matéria${weak.length > 1 ? "s" : ""} podem te derrubar. Veja quais e foque nelas agora.`,
        }
      : overallPct >= 60
      ? {
          label: `Prontidão: ${overallPct}% — você está perto, mas ainda reprovaria.`,
          sub: `${weak.length} matéria${weak.length > 1 ? "s" : ""} podem te derrubar. Veja quais e foque nelas agora.`,
        }
      : {
          label: `Prontidão: ${overallPct}% — se a prova fosse hoje, você não passaria.`,
          sub: `${weak.length} matéria${weak.length > 1 ? "s" : ""} podem te derrubar. Veja quais e foque nelas agora.`,
        };

  // tone reservado para evoluções visuais futuras
  void tone;
  void totalWrong;

  return (
    <div className="app-shell bg-background flex flex-col">
      <header className="bg-gradient-night text-white px-5 pt-10 pb-6">
        <div className="max-w-xl mx-auto">
          <p className="stencil text-xs text-primary">Seu Índice de Prontidão</p>
          <h1 className="text-2xl font-display font-bold mt-1 leading-tight">
            {verdict.label}
          </h1>
          <p className="text-sm text-white/75 mt-2">{verdict.sub}</p>
        </div>
      </header>

      <main className="px-5 py-5 max-w-xl mx-auto w-full space-y-4">
        {weak.length > 0 && (
          <section>
            <h2 className="stencil text-xs text-destructive mb-2 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Podem te reprovar · abaixo de {MASTERY_TARGET}%
            </h2>
            <div className="space-y-2">
              {weak.map((r) => <ResultRow key={r.subject_id} r={r} weak />)}
            </div>
          </section>
        )}

        {strong.length > 0 && (
          <section>
            <h2 className="stencil text-xs text-success mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Zona de aprovação
            </h2>
            <div className="space-y-2">
              {strong.map((r) => <ResultRow key={r.subject_id} r={r} />)}
            </div>
          </section>
        )}

        <div className="rounded-2xl bg-gradient-flame text-white p-5 shadow-flame mt-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-warning" />
            <p className="stencil text-[11px] opacity-90">Plano único · Até o dia da prova</p>
          </div>
          <h3 className="font-display text-2xl font-bold mt-1 leading-tight">
            Garanta sua aprovação — R$ 97
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm opacity-95">
            <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Questões ilimitadas até o dia da prova</li>
            <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> O app escolhe a próxima questão pela sua matéria mais fraca</li>
            <li className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Diagnósticos e simulados no padrão IDECAN</li>
          </ul>
          <Button
            asChild
            className="w-full h-12 mt-4 bg-white text-foreground hover:bg-white/90 font-display stencil"
          >
            <a href="https://pay.kiwify.com.br/5kq1jdL" target="_blank" rel="noopener noreferrer">
              Liberar meu treino focado <ChevronRight className="w-4 h-4 ml-1" />
            </a>
          </Button>
        </div>

        <Button
          asChild
          className="w-full h-12 bg-gradient-flame text-white font-display stencil shadow-flame"
        >
          <Link to="/auth">
            Criar conta / Entrar <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>

        <div className="text-center">
          <button
            onClick={() => { setStage("intro"); setResults([]); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Refazer diagnóstico
          </button>
        </div>
      </main>
    </div>
  );
};

const ResultRow = ({ r, weak }: { r: SubjectResult; weak?: boolean }) => (
  <div className={`rounded-xl border p-3 ${weak ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}>
    <div className="flex items-center justify-between text-sm">
      <span className="font-display font-semibold">{r.subject_name}</span>
      <span className={`stencil text-xs ${weak ? "text-destructive" : "text-success"}`}>
        {r.pct}% · {r.correct}/{r.total}
      </span>
    </div>
    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full ${weak ? "bg-destructive" : "bg-success"}`}
        style={{ width: `${r.pct}%` }}
      />
    </div>
  </div>
);

export default Diagnostico;
