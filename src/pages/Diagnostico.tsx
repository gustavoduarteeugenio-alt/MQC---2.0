import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Target, ChevronRight, Loader2, CheckCircle2, XCircle, Lock, Crown } from "lucide-react";
import { RichText } from "@/components/RichText";
import { toast } from "sonner";

const TOTAL_QUESTIONS = 12;
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
  subjects?: { id: string; name: string };
};

type SubjectResult = {
  subject_id: string;
  subject_name: string;
  total: number;
  correct: number;
  pct: number;
};

type Stage = "intro" | "quiz" | "result";

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
  const [results, setResults] = useState<SubjectResult[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Se já tem usuário logado, vai para Home
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate("/", { replace: true });
    });
  }, [navigate]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const { data: subs } = await supabase
        .from("subjects")
        .select("id, name, display_order")
        .order("display_order", { ascending: true });

      if (!subs?.length) {
        toast.error("Nenhuma matéria cadastrada.");
        return;
      }

      // ~2 questões por matéria até atingir TOTAL_QUESTIONS
      const perSubject = Math.max(1, Math.ceil(TOTAL_QUESTIONS / subs.length));
      const picks: Question[] = [];
      for (const s of subs) {
        const { data: qs } = await supabase
          .from("questions")
          .select("id, subject_id, statement, option_a, option_b, option_c, option_d, option_e, correct_answer, subjects:subject_id(id,name)")
          .eq("subject_id", s.id)
          .limit(20);
        if (!qs?.length) continue;
        // sorteia
        const shuffled = [...qs].sort(() => Math.random() - 0.5);
        picks.push(...(shuffled.slice(0, perSubject) as any));
      }

      const final = picks.sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS);
      if (final.length < 5) {
        toast.error("Banco de questões insuficiente para o diagnóstico.");
        return;
      }
      setQuestions(final);
      setIdx(0);
      setAnswers({});
      setSelected(null);

      // cria sessão
      const token = getToken();
      const { data: ses, error } = await supabase
        .from("diagnostic_sessions")
        .insert({ client_token: token, total: final.length })
        .select("id")
        .single();
      if (error) console.error(error);
      else setSessionId(ses.id);

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
      .filter((o) => o.text);
  }, [current]);

  const confirm = async () => {
    if (!selected || !current) return;
    const next = { ...answers, [current.id]: selected };
    setAnswers(next);

    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      setSelected(null);
      return;
    }

    // calcula resultado
    const bySub = new Map<string, SubjectResult>();
    for (const q of questions) {
      const sub = q.subjects;
      if (!sub) continue;
      const cur = bySub.get(sub.id) ?? { subject_id: sub.id, subject_name: sub.name, total: 0, correct: 0, pct: 0 };
      cur.total += 1;
      if (next[q.id] === q.correct_answer) cur.correct += 1;
      bySub.set(sub.id, cur);
    }
    const finalRes: SubjectResult[] = Array.from(bySub.values())
      .map((r) => ({ ...r, pct: Math.round((r.correct / r.total) * 100) }))
      .sort((a, b) => a.pct - b.pct);

    setResults(finalRes);

    // persiste
    const totalCorrect = finalRes.reduce((s, r) => s + r.correct, 0);
    if (sessionId) {
      await supabase
        .from("diagnostic_sessions")
        .update({
          answers: Object.entries(next).map(([qid, ans]) => ({ qid, ans })) as any,
          results: finalRes as any,
          correct: totalCorrect,
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      // marca como pendente para vincular após signup
      localStorage.setItem(PENDING_KEY, getToken());
    }

    setStage("result");
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
            {TOTAL_QUESTIONS} questões no padrão IDECAN da banca. Ao final, você recebe seu <strong className="text-white">Índice de Prontidão</strong> e vê exatamente quais matérias podem te reprovar.
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
    return (
      <div className="app-shell bg-background flex flex-col">
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

        <main className="px-5 py-5 flex-1 max-w-xl mx-auto w-full">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
            <RichText content={current.statement} className="text-foreground text-[15px] leading-relaxed" />
          </div>

          <div className="mt-4 space-y-2">
            {options.map((o) => {
              const isSel = selected === o.letter;
              return (
                <button
                  key={o.letter}
                  type="button"
                  onClick={() => setSelected(o.letter)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition flex gap-3 items-start ${
                    isSel
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-full grid place-items-center font-display text-sm font-bold ${
                    isSel ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}>
                    {o.letter.toUpperCase()}
                  </span>
                  <RichText content={o.text!} className="text-foreground text-sm leading-relaxed flex-1 pt-1" />
                </button>
              );
            })}
          </div>

          <Button
            onClick={confirm}
            disabled={!selected}
            className="w-full h-12 mt-5 bg-gradient-flame text-white font-display stencil"
          >
            {idx + 1 === questions.length ? "Ver meu resultado" : "Confirmar"} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </main>
      </div>
    );
  }

  // ---------------- RESULT ----------------
  const overall = results.reduce((s, r) => s + r.pct, 0) / Math.max(1, results.length);
  const weak = results.filter((r) => r.pct < MASTERY_TARGET);
  const strong = results.filter((r) => r.pct >= MASTERY_TARGET);

  const overallPct = Math.round(overall);
  const verdict =
    overallPct >= MASTERY_TARGET
      ? { label: `Prontidão: ${overallPct}% — você passaria hoje.`, sub: "Você está dentro da meta. Hora de blindar o resultado até a prova." }
      : overallPct >= 60
      ? { label: `Prontidão: ${overallPct}% — você está perto, mas ainda reprovaria.`, sub: `${weak.length} matéria${weak.length > 1 ? "s" : ""} podem te derrubar. Veja quais e foque nelas agora.` }
      : { label: `Prontidão: ${overallPct}% — se a prova fosse hoje, você não passaria.`, sub: `${weak.length} matéria${weak.length > 1 ? "s" : ""} estão abaixo da meta. Você precisa virar o jogo na reta final.` };

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
          <h3 className="font-display text-2xl font-bold mt-1">Garanta sua aprovação — R$ 97</h3>
          <ul className="text-sm mt-3 space-y-1.5 opacity-95">
            <li>✓ Questões ilimitadas até o dia da prova</li>
            <li>✓ O app escolhe a próxima questão pela sua matéria mais fraca</li>
            <li>✓ Meta de {MASTERY_TARGET}% por matéria</li>
            <li>✓ IDECAN real + Estilo IDECAN</li>
          </ul>
          <Button
            onClick={() => navigate("/auth?signup=1&from=diag")}
            className="w-full h-12 mt-4 bg-white text-foreground hover:bg-white/90 font-display stencil"
          >
            Liberar meu treino focado <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
          <p className="text-[11px] text-white/70 mt-2 text-center">
            Pagamento seguro pela Kiwify
          </p>
        </div>


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
