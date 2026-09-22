import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useExam } from "@/contexts/ExamContext";
import { disciplinesOf, examLabel, subtreeIds } from "@/lib/exams";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList, Shuffle, ChevronRight, Trophy } from "lucide-react";
import { toast } from "sonner";

type Simulado = { id: string; name: string; description: string | null; q_count?: number };
type Attempt = {
  id: string; mode: string; title: string | null; total: number; correct: number;
  started_at: string; finished_at: string | null;
};

const Simulados = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { exam, nodes, loading: examLoading } = useExam();
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // A prova do edital: disciplinas de nível 1 com peso (nº de questões na prova).
  const grade = useMemo(
    () => disciplinesOf(nodes).filter((d) => (d.weight ?? 0) > 0),
    [nodes],
  );
  const totalQuestoes = useMemo(
    () => grade.reduce((sum, d) => sum + (d.weight ?? 0), 0),
    [grade],
  );

  const load = useCallback(async () => {
    if (!exam) { setSimulados([]); setHistory([]); setLoading(false); return; }
    setLoading(true);
    const [{ data: sims }, { data: hist }] = await Promise.all([
      (supabase as any).rpc("list_published_simulados", { _exam_id: exam.id }),
      (supabase as any).from("simulado_attempts")
        .select("id, mode, title, total, correct, started_at, finished_at")
        .eq("exam_id", exam.id)
        .order("started_at", { ascending: false })
        .limit(20),
    ]);
    setSimulados(((sims ?? []) as any[]).map((s) => ({ ...s, q_count: Number(s.question_count ?? 0) })));
    setHistory((hist ?? []) as any);
    setLoading(false);
  }, [exam]);

  useEffect(() => { if (!examLoading) load(); }, [load, examLoading]);

  const startFixed = async (sim: Simulado) => {
    if (!user || !exam) return;
    if ((sim.q_count ?? 0) === 0) { toast.error("Simulado sem questões."); return; }
    const { data: links } = await (supabase as any).from("simulado_questions")
      .select("question_id, position")
      .eq("simulado_id", sim.id)
      .order("position", { ascending: true });
    const ids = ((links ?? []) as any[]).map((l: any) => l.question_id);
    const { data: attempt, error } = await (supabase as any).from("simulado_attempts").insert({
      user_id: user.id,
      exam_id: exam.id,
      simulado_id: sim.id,
      mode: "fixed",
      title: sim.name,
      total: ids.length,
      answers: ids.map((qid: string) => ({ question_id: qid, selected: null })),
    }).select("id").single();
    if (error) { toast.error("Erro ao iniciar simulado."); return; }
    navigate(`/simulado/${attempt.id}`);
  };

  const generateRandom = async () => {
    if (!user || !exam) return;
    setGenerating(true);
    try {
      const allIds: string[] = [];
      const breakdown: { label: string; question_ids: string[] }[] = [];

      // A grade vem do edital: cada disciplina entra com o peso que tem na prova
      for (const disciplina of grade) {
        const escopo = subtreeIds(nodes, disciplina.id);
        const { data: vinculos } = await (supabase as any)
          .from("exam_questions")
          .select("question_id")
          .eq("exam_id", exam.id)
          .eq("status", "published")
          .in("content_node_id", escopo);

        const pool = ((vinculos ?? []) as any[]).map((v) => v.question_id);
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const picked = pool.slice(0, disciplina.weight!);
        if (picked.length < disciplina.weight!) {
          toast.error(`Sem questões suficientes em ${disciplina.name} (${picked.length}/${disciplina.weight}).`);
          setGenerating(false);
          return;
        }
        breakdown.push({ label: disciplina.name, question_ids: picked });
        allIds.push(...picked);
      }

      const { data: attempt, error } = await (supabase as any).from("simulado_attempts").insert({
        user_id: user.id,
        exam_id: exam.id,
        mode: "random",
        title: `Simulado Aleatório (${allIds.length})`,
        total: allIds.length,
        answers: allIds.map((qid) => ({ question_id: qid, selected: null })),
        by_subject: breakdown,
      }).select("id").single();
      if (error) throw error;
      navigate(`/simulado/${attempt.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar simulado.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell>
      <header className="flex items-center gap-2 px-4 pt-12 pb-4 bg-gradient-dark text-white rounded-b-3xl">
        <button onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="stencil text-xs text-primary">{exam ? examLabel(exam) : "Simulados"}</p>
          <h1 className="font-display text-xl font-bold">Simulados</h1>
        </div>
      </header>

      <main className="px-5 py-5 space-y-5">
        {/* Gerar aleatório */}
        <section className="bg-gradient-brand rounded-2xl p-5 text-white shadow-brand">
          <div className="flex items-center gap-2 stencil text-[11px] opacity-90">
            <Shuffle className="w-4 h-4" /> Aleatório
          </div>
          <h2 className="font-display text-2xl font-bold mt-1">
            Gerar Simulado{totalQuestoes > 0 ? ` (${totalQuestoes} questões)` : ""}
          </h2>
          <p className="text-sm opacity-90 mt-1">
            Distribuição do edital{exam ? ` · ${Math.round(exam.duration_minutes / 60)} horas de duração` : ""}.
          </p>
          {grade.length === 0 ? (
            <p className="mt-3 text-xs opacity-90">
              Este edital ainda não tem pesos por disciplina cadastrados.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs opacity-90">
              {grade.map((d) => (
                <li key={d.id}>• {d.weight} {d.name}</li>
              ))}
            </ul>
          )}
          <Button
            onClick={generateRandom}
            disabled={generating || grade.length === 0 || !exam}
            className="mt-4 w-full bg-white text-foreground hover:bg-white/90 font-display stencil"
          >
            {generating ? "Sorteando questões..." : "Gerar agora"}
          </Button>
        </section>

        {/* Inéditos */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <h2 className="font-display text-lg font-bold">Simulados Inéditos</h2>
          </div>
          {loading ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Carregando...</p>
          ) : simulados.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhum simulado cadastrado ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {simulados.map((s) => (
                <button
                  key={s.id}
                  onClick={() => startFixed(s)}
                  className="w-full text-left flex items-center gap-3 bg-card border border-border rounded-2xl p-4 shadow-card hover:border-primary/50 transition-all disabled:opacity-50"
                >
                  <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold leading-tight">{s.name}</p>
                    <p className="text-xs text-muted-foreground stencil mt-0.5">{s.q_count} questões</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Histórico */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-primary" />
            <h2 className="font-display text-lg font-bold">Histórico</h2>
          </div>
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Você ainda não fez nenhum simulado.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const pct = h.total > 0 ? Math.round((h.correct / h.total) * 100) : 0;
                return (
                  <Link key={h.id} to={`/simulado/${h.id}`} className="flex items-center justify-between bg-card border border-border rounded-xl p-3 shadow-card">
                    <div>
                      <p className="font-display text-sm font-semibold">{h.title ?? "Simulado"}</p>
                      <p className="text-[11px] stencil text-muted-foreground">
                        {new Date(h.started_at).toLocaleDateString("pt-BR")} · {h.finished_at ? `${h.correct}/${h.total} acertos · ${pct}%` : "Em andamento"}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
};

export default Simulados;
