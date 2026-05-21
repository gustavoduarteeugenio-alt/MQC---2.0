import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Trophy, Medal, Award, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Row = {
  rank_position: number;
  user_id: string;
  display_name: string;
  correct_count: number;
  is_anonymous: boolean;
};

type Mine = { rank_position: number; correct_count: number; total_users: number } | null;

const TOP_LIMIT = 20;

const Ranking = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [mine, setMine] = useState<Mine>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
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
      setLoading(false);
    })();
  }, [user?.id]);

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

  return (
    <AppShell>
      <header className="bg-gradient-night text-white px-5 pt-12 pb-6">
        <p className="stencil text-xs text-primary">Quartel · Ranking</p>
        <h1 className="text-2xl font-display font-bold">Top combatentes</h1>
        <p className="text-sm text-white/70 mt-1">
          Classificação pelo total de acertos no Modo Treinamento.
        </p>
      </header>

      <main className="px-5 py-5 space-y-4">
        {/* Sua posição */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-primary" />
            <p className="stencil text-[10px] text-muted-foreground">Sua posição</p>
          </div>
          {loading ? (
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

        {/* Top */}
        <div className="bg-card border border-border rounded-2xl p-3 shadow-card">
          <div className="flex items-center justify-between px-2 pt-1 pb-3">
            <h2 className="font-display font-bold">Top {TOP_LIMIT}</h2>
            <span className="stencil text-[10px] text-muted-foreground">Acertos</span>
          </div>

          {loading ? (
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
                        {isMe && (
                          <span className="ml-2 stencil text-[9px] text-primary">VOCÊ</span>
                        )}
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

        {/* Sua posição (rodapé fixo dentro do scroll) */}
        {mine && !loading && (
          <div className="bg-gradient-night text-white rounded-2xl p-4 shadow-flame">
            <p className="stencil text-[10px] text-white/70">Sua Posição</p>
            <p className="font-display font-bold text-base">
              {mine.rank_position}º lugar — {mine.correct_count} acertos
            </p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          Você pode ocultar seu nome completo no ranking pelo Perfil (LGPD).
        </p>
      </main>
    </AppShell>
  );
};

export default Ranking;
