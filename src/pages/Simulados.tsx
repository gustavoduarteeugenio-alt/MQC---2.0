import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList, Shuffle, Clock, Lock, Crown, ChevronRight, Trophy } from "lucide-react";
import { toast } from "sonner";
import { PlanSelectionDialog } from "@/components/PlanSelectionDialog";

// Distribuição: total 50 (10+5+10+10+10+5)
const RANDOM_DISTRIBUTION: { label: string; slugs: string[]; count: number }[] = [
  { label: "Língua Portuguesa", slugs: ["portugues"], count: 10 },
  { label: "Raciocínio Lógico/Matemático", slugs: ["rlm"], count: 5 },
  { label: "Direitos Humanos e Legislação", slugs: ["direitos-humanos", "legislacao", "direito"], count: 10 },
  { label: "Ciências Naturais", slugs: ["quimica", "biologia", "fisica"], count: 10 },
  { label: "Ciências Humanas (História e Geografia de MG)", slugs: ["historia-mg", "geografia-mg"], count: 10 },
  { label: "Proteção e Defesa Civil", slugs: ["defesa-civil"], count: 5 },
];

type Simulado = { id: string; name: string; description: string | null; q_count?: number };
type Attempt = {
  id: string; mode: string; title: string | null; total: number; correct: number;
  started_at: string; finished_at: string | null;
};

const Simulados = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useProfile();
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: sims }, { data: counts }, { data: hist }] = await Promise.all([
      (supabase.from("simulados" as any).select("id, name, description").order("created_at", { ascending: false })) as any,
      (supabase.from("simulado_questions" as any).select("simulado_id")) as any,
      (supabase.from("simulado_attempts" as any).select("id, mode, title, total, correct, started_at, finished_at").order("started_at", { ascending: false }).limit(20)) as any,
    ]);
    const cmap: Record<string, number> = {};
    (counts ?? []).forEach((c: any) => { cmap[c.simulado_id] = (cmap[c.simulado_id] ?? 0) + 1; });
    setSimulados(((sims ?? []) as any[]).map((s) => ({ ...s, q_count: cmap[s.id] ?? 0 })));
    setHistory((hist ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startFixed = async (sim: Simulado) => {
    if (!isPremium) { toast.error("Disponível apenas no Premium."); return; }
    if (!user) return;
    if ((sim.q_count ?? 0) === 0) { toast.error("Simulado sem questões."); return; }
    const { data: links } = await (supabase.from("simulado_questions" as any)
      .select("question_id, position")
      .eq("simulado_id", sim.id)
      .order("position", { ascending: true })) as any;
    const ids = (links ?? []).map((l: any) => l.question_id);
    const { data: attempt, error } = await (supabase.from("simulado_attempts" as any).insert({
      user_id: user.id,
      simulado_id: sim.id,
      mode: "fixed",
      title: sim.name,
      total: ids.length,
      answers: ids.map((qid: string) => ({ question_id: qid, selected: null })),
    } as any).select("id").single()) as any;
    if (error) { toast.error("Erro ao iniciar simulado."); return; }
    navigate(`/simulado/${attempt.id}`);
  };

  const generateRandom = async () => {
    if (!isPremium) { toast.error("Disponível apenas no Premium."); return; }
    if (!user) return;
    setGenerating(true);
    try {
      const { data: subs } = await supabase.from("subjects").select("id, slug");
      const bySlug: Record<string, string> = {};
      (subs ?? []).forEach((s: any) => { bySlug[s.slug] = s.id; });

      const allIds: string[] = [];
      const breakdown: { label: string; question_ids: string[] }[] = [];
      for (const group of RANDOM_DISTRIBUTION) {
        const subjectIds = group.slugs.map((sl) => bySlug[sl]).filter(Boolean);
        if (subjectIds.length === 0) continue;
        const { data: qs } = await supabase
          .from("questions")
          .select("id")
          .in("subject_id", subjectIds);
        const pool = (qs ?? []).map((q: any) => q.id);
        // shuffle
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        const picked = pool.slice(0, group.count);
        if (picked.length < group.count) {
          toast.error(`Sem questões suficientes em ${group.label} (${picked.length}/${group.count}).`);
          setGenerating(false);
          return;
        }
        breakdown.push({ label: group.label, question_ids: picked });
        allIds.push(...picked);
      }

      const { data: attempt, error } = await (supabase.from("simulado_attempts" as any).insert({
        user_id: user.id,
        mode: "random",
        title: "Simulado Aleatório (50)",
        total: allIds.length,
        answers: allIds.map((qid) => ({ question_id: qid, selected: null })),
        by_subject: breakdown,
      } as any).select("id").single()) as any;
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
      <header className="flex items-center gap-2 px-4 pt-12 pb-4 bg-gradient-night text-white rounded-b-3xl">
        <button onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="stencil text-xs text-primary">CFSd CBMMG · IDECAN</p>
          <h1 className="font-display text-xl font-bold">Simulados</h1>
        </div>
      </header>

      <main className="px-5 py-5 space-y-5">
        {!isPremium && (
          <PlanSelectionDialog>
            <button className="w-full flex items-center justify-between bg-card border border-dashed border-primary/40 rounded-2xl px-5 py-4 shadow-card text-left">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-primary" />
                <div>
                  <p className="stencil text-[10px] text-muted-foreground">Bloqueado · Premium</p>
                  <p className="font-display font-semibold">Simulados são exclusivos do Premium</p>
                </div>
              </div>
              <Crown className="w-5 h-5 text-warning" />
            </button>
          </PlanSelectionDialog>
        )}

        {/* Gerar aleatório */}
        <section className="bg-gradient-flame rounded-2xl p-5 text-white shadow-flame">
          <div className="flex items-center gap-2 stencil text-[11px] opacity-90">
            <Shuffle className="w-4 h-4" /> Aleatório
          </div>
          <h2 className="font-display text-2xl font-bold mt-1">Gerar Simulado (50 questões)</h2>
          <p className="text-sm opacity-90 mt-1">Distribuição oficial · 4 horas de duração.</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs opacity-90">
            {RANDOM_DISTRIBUTION.map((d) => (
              <li key={d.label}>• {d.count} {d.label}</li>
            ))}
          </ul>
          <Button
            onClick={generateRandom}
            disabled={!isPremium || generating}
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
                  disabled={!isPremium}
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
