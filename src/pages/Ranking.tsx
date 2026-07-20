import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Trophy, Medal, Award, Crown, Clock, Target, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = {
  rank_position: number;
  user_id: string;
  display_name: string;
  correct_count: number;
  is_anonymous: boolean;
};

type Mine = { rank_position: number; correct_count: number; total_users: number } | null;

type SimuladoOption = { id: string; name: string; question_count: number };

type SimRow = {
  rank_position: number;
  user_id: string;
  display_name: string;
  is_anonymous: boolean;
  correct: number;
  total: number;
  duration_seconds: number | null;
};

type MineSim = {
  rank_position: number;
  total_users: number;
  correct: number;
  total: number;
  duration_seconds: number | null;
} | null;

const TOP_LIMIT = 20;
const SIM_LIMIT = 100;

const fmtDuration = (s: number | null | undefined) => {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}h ${pad(m)}m ${pad(sec)}s` : `${pad(m)}m ${pad(sec)}s`;
};

const podiumIcon = (pos: number) => {
  if (pos === 1) return <Crown className="w-5 h-5" style={{ color: "#FFD24A" }} />;
  if (pos === 2) return <Medal className="w-5 h-5" style={{ color: "#C0C8D1" }} />;
  if (pos === 3) return <Award className="w-5 h-5" style={{ color: "#CD7F32" }} />;
  return null;
};

const podiumBg = (pos: number) => {
  if (pos === 1) return "bg-[hsl(45_95%_55%/0.12)] border-[hsl(45_95%_55%/0.4)]";
  if (pos === 2) return "bg-muted/60 border-border";
  if (pos === 3) return "bg-[hsl(28_60%_45%/0.12)] border-[hsl(28_60%_45%/0.35)]";
  return "bg-card border-border";
};

const Ranking = () => {
  const { user } = useAuth();

  // Treinamento
  const [rows, setRows] = useState<Row[]>([]);
  const [mine, setMine] = useState<Mine>(null);
  const [loadingGeral, setLoadingGeral] = useState(true);

  // Simulados
  const [simulados, setSimulados] = useState<SimuladoOption[]>([]);
  const [selectedSim, setSelectedSim] = useState<string>("");
  const [simRows, setSimRows] = useState<SimRow[]>([]);
  const [mineSim, setMineSim] = useState<MineSim>(null);
  const [loadingSims, setLoadingSims] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingGeral(true);
      const [{ data: top }, { data: my }] = await Promise.all([
        supabase.rpc("get_training_ranking", { _limit: TOP_LIMIT }),
        supabase.rpc("get_my_training_rank"),
      ]);
      setRows(((top as any[]) ?? []).map((r) => ({
        rank_position: Number(r.rank_position),
        user_id: r.user_id,
        display_name: r.display_name,
        correct_count: Number(r.correct_count),
        is_anonymous: r.is_anonymous,
      })));
      const m = (my as any[])?.[0];
      setMine(m ? { rank_position: Number(m.rank_position), correct_count: Number(m.correct_count), total_users: Number(m.total_users) } : null);
      setLoadingGeral(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      setLoadingSims(true);
      const { data } = await (supabase as any).rpc("list_published_simulados");
      const list: SimuladoOption[] = ((data as any[]) ?? []).map((s) => ({
        id: s.id, name: s.name, question_count: Number(s.question_count),
      }));
      setSimulados(list);
      if (list.length > 0 && !selectedSim) setSelectedSim(list[0].id);
      setLoadingSims(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSim) return;
    (async () => {
      setLoadingRanking(true);
      const [{ data: rk }, { data: my }] = await Promise.all([
        (supabase as any).rpc("get_simulado_ranking", { _simulado_id: selectedSim, _limit: SIM_LIMIT }),
        (supabase as any).rpc("get_my_simulado_rank", { _simulado_id: selectedSim }),
      ]);
      setSimRows(((rk as any[]) ?? []).map((r) => ({
        rank_position: Number(r.rank_position),
        user_id: r.user_id,
        display_name: r.display_name,
        is_anonymous: r.is_anonymous,
        correct: Number(r.correct),
        total: Number(r.total),
        duration_seconds: r.duration_seconds != null ? Number(r.duration_seconds) : null,
      })));
      const m = (my as any[])?.[0];
      setMineSim(m ? {
        rank_position: Number(m.rank_position),
        total_users: Number(m.total_users),
        correct: Number(m.correct),
        total: Number(m.total),
        duration_seconds: m.duration_seconds != null ? Number(m.duration_seconds) : null,
      } : null);
      setLoadingRanking(false);
    })();
  }, [selectedSim, user?.id]);

  const selectedSimObj = useMemo(
    () => simulados.find((s) => s.id === selectedSim),
    [simulados, selectedSim]
  );

  return (
    <AppShell>
      <header className="bg-gradient-night text-white px-5 pt-12 pb-6">
        <p className="stencil text-xs text-primary">Quartel · Ranking</p>
        <h1 className="text-2xl font-display font-bold">Top combatentes</h1>
        <p className="text-sm text-white/70 mt-1">
          Classificação por desempenho no Modo Treinamento e nos Simulados Inéditos.
        </p>
      </header>

      <main className="px-5 py-5 space-y-4">
        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="geral" className="stencil text-xs">Geral (Treinamento)</TabsTrigger>
            <TabsTrigger value="simulados" className="stencil text-xs">Simulados Inéditos</TabsTrigger>
          </TabsList>

          {/* ================= TAB TREINAMENTO ================= */}
          <TabsContent value="geral" className="space-y-4 mt-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-primary" />
                <p className="stencil text-[10px] text-muted-foreground">Sua posição</p>
              </div>
              {loadingGeral ? (
                <Skeleton className="h-7 w-48" />
              ) : mine ? (
                <p className="font-display text-lg font-bold">
                  {mine.rank_position}º lugar
                  <span className="text-muted-foreground font-normal text-sm">
                    {" "}· {mine.correct_count} acertos · de {mine.total_users} candidatos
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Responda algumas questões para entrar no ranking.
                </p>
              )}
            </div>

            <div className="bg-card border border-border rounded-2xl p-3 shadow-card">
              <div className="flex items-center justify-between px-2 pt-1 pb-3">
                <h2 className="font-display font-bold">Top {TOP_LIMIT}</h2>
                <span className="stencil text-[10px] text-muted-foreground">Acertos</span>
              </div>

              {loadingGeral ? (
                <div className="space-y-2 px-1 pb-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Sem dados suficientes ainda. Seja o primeiro!
                </p>
              ) : (
                <ul className="space-y-2 px-1 pb-1">
                  {rows.map((r) => {
                    const isMe = r.user_id === user?.id;
                    return (
                      <li
                        key={r.user_id}
                        className={[
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                          podiumBg(r.rank_position),
                          isMe ? "ring-2 ring-primary" : "",
                        ].join(" ")}
                      >
                        <div className="w-9 h-9 rounded-lg bg-background/60 flex items-center justify-center font-display font-bold text-sm shrink-0">
                          {r.rank_position <= 3 ? podiumIcon(r.rank_position) : `${r.rank_position}º`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-semibold text-sm truncate">
                            {r.display_name}
                            {isMe && <span className="ml-2 stencil text-[9px] text-primary">VOCÊ</span>}
                          </p>
                          {r.rank_position <= 3 && (
                            <p className="stencil text-[9px] text-muted-foreground">
                              {r.rank_position === 1 ? "Ouro" : r.rank_position === 2 ? "Prata" : "Bronze"}
                            </p>
                          )}
                        </div>
                        <div className="font-display font-bold text-base shrink-0 text-primary">
                          {r.correct_count}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* ================= TAB SIMULADOS ================= */}
          <TabsContent value="simulados" className="space-y-4 mt-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
              <p className="stencil text-[10px] text-muted-foreground mb-2">Escolha o simulado</p>
              {loadingSims ? (
                <Skeleton className="h-10 w-full" />
              ) : simulados.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum simulado publicado ainda.
                </p>
              ) : (
                <Select value={selectedSim} onValueChange={setSelectedSim}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um simulado" />
                  </SelectTrigger>
                  <SelectContent>
                    {simulados.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedSim && !loadingRanking && !mineSim && (
              <div className="bg-warning/10 border border-warning/40 rounded-2xl p-4">
                <p className="font-display font-bold text-sm mb-1">
                  Você ainda não realizou este simulado
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Realize o simulado para figurar no ranking oficial. Vale apenas a 1ª tentativa.
                </p>
                <Link
                  to="/simulados"
                  className="inline-flex items-center gap-1 bg-gradient-flame text-white px-4 py-2 rounded-xl stencil text-xs shadow-flame"
                >
                  Realizar simulado agora <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {mineSim && !loadingRanking && (
              <div className="bg-gradient-night text-white rounded-2xl p-4 shadow-flame">
                <p className="stencil text-[10px] text-white/70">Sua posição oficial</p>
                <p className="font-display font-bold text-base">
                  {mineSim.rank_position}º lugar
                  <span className="opacity-70 font-normal text-sm">
                    {" "}· de {mineSim.total_users}
                  </span>
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-primary" />
                    {mineSim.correct}/{mineSim.total}{" "}
                    {mineSim.total > 0 && (
                      <span className="opacity-70">· {Math.round((mineSim.correct / mineSim.total) * 100)}%</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    {fmtDuration(mineSim.duration_seconds)}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl p-3 shadow-card">
              <div className="flex items-center justify-between px-2 pt-1 pb-3">
                <h2 className="font-display font-bold text-sm">
                  Classificação oficial
                  {selectedSimObj && (
                    <span className="block stencil text-[10px] text-muted-foreground font-normal mt-0.5">
                      {selectedSimObj.name}
                    </span>
                  )}
                </h2>
                <span className="stencil text-[10px] text-muted-foreground">Nota · Tempo</span>
              </div>

              {loadingRanking ? (
                <div className="space-y-2 px-1 pb-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : simRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Ninguém finalizou este simulado ainda. Seja o primeiro!
                </p>
              ) : (
                <ul className="space-y-2 px-1 pb-1">
                  {simRows.map((r) => {
                    const isMe = r.user_id === user?.id;
                    const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
                    return (
                      <li
                        key={r.user_id}
                        className={[
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                          podiumBg(r.rank_position),
                          isMe ? "ring-2 ring-primary" : "",
                        ].join(" ")}
                      >
                        <div className="w-9 h-9 rounded-lg bg-background/60 flex items-center justify-center font-display font-bold text-sm shrink-0">
                          {r.rank_position <= 3 ? podiumIcon(r.rank_position) : `${r.rank_position}º`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-semibold text-sm truncate">
                            {r.display_name}
                            {isMe && <span className="ml-2 stencil text-[9px] text-primary">VOCÊ</span>}
                          </p>
                          <p className="stencil text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" /> {fmtDuration(r.duration_seconds)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display font-bold text-base text-primary leading-none">
                            {r.correct}/{r.total}
                          </div>
                          <div className="stencil text-[10px] text-muted-foreground mt-0.5">
                            {pct}%
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Apenas a 1ª tentativa vale para o ranking oficial. Desempate: mais acertos · menor tempo · matérias de peso · quem finalizou primeiro.
            </p>
          </TabsContent>
        </Tabs>
      </main>
    </AppShell>
  );
};

export default Ranking;
