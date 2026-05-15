import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Crown, ShieldOff, Loader2, Users, Calendar, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PlanType = "basic" | "premium" | "monthly" | "quarterly";

type UserRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan: PlanType;
  premium_until: string | null;
  premium_since: string | null;
  origem: string | null;
  trial_started_at: string | null;
};

const PLAN_LABEL: Record<PlanType, string> = {
  basic: "Básico",
  premium: "Premium",
  monthly: "Mensal",
  quarterly: "Trimestral",
};

const ORIGEM_OPTIONS = ["Instagram", "Indicação de Amigo", "Grupos de Estudo", "Google"];
const NOT_INFORMED = "Não Informado";

export const ManageUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, plan, premium_until, premium_since, origem" as any)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar usuários: " + error.message);
    } else {
      setUsers(((data ?? []) as any) as UserRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const originStats = useMemo(() => {
    const stats: Record<string, number> = { [NOT_INFORMED]: 0 };
    ORIGEM_OPTIONS.forEach((o) => (stats[o] = 0));
    users.forEach((u) => {
      const key = u.origem && u.origem.trim() ? u.origem : NOT_INFORMED;
      stats[key] = (stats[key] ?? 0) + 1;
    });
    return stats;
  }, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (originFilter !== "all") {
        const orig = u.origem && u.origem.trim() ? u.origem : NOT_INFORMED;
        if (orig !== originFilter) return false;
      }
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, query, originFilter]);

  const setPlan = async (u: UserRow, newPlan: PlanType, days: number | null) => {
    setUpdatingId(u.user_id);
    const now = new Date();
    const premium_since = newPlan === "basic" ? null : now.toISOString();
    const premium_until =
      newPlan === "basic" || days === null
        ? null
        : new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("profiles")
      .update({ plan: newPlan, premium_until, premium_since } as any)
      .eq("user_id", u.user_id);

    setUpdatingId(null);

    if (error) {
      toast.error("Falha ao atualizar plano: " + error.message);
      return;
    }
    toast.success(
      newPlan === "basic"
        ? `Premium removido de ${u.email ?? "usuário"}`
        : `${u.email ?? "Usuário"} agora é ${PLAN_LABEL[newPlan]} ✅`
    );
    setUsers((prev) =>
      prev.map((x) =>
        x.user_id === u.user_id ? { ...x, plan: newPlan, premium_until, premium_since } : x
      )
    );
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold">Usuários ({users.length})</h2>
      </div>

      {/* Resumo por origem */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {[...ORIGEM_OPTIONS, NOT_INFORMED].map((o) => (
          <button
            key={o}
            onClick={() => setOriginFilter(originFilter === o ? "all" : o)}
            className={`text-left rounded-xl border p-2.5 transition-colors ${
              originFilter === o
                ? "bg-primary/10 border-primary"
                : "bg-card border-border hover:bg-muted/40"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground stencil truncate">{o}</p>
            <p className="font-display font-bold text-lg">{originStats[o] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por e-mail ou nome…"
            className="pl-9"
          />
        </div>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Filtrar por origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {ORIGEM_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
            <SelectItem value={NOT_INFORMED}>{NOT_INFORMED}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum usuário encontrado.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const isPremium = u.plan !== "basic";
            const busy = updatingId === u.user_id;
            const origemLabel = u.origem && u.origem.trim() ? u.origem : NOT_INFORMED;
            return (
              <div
                key={u.user_id}
                className="border border-border rounded-xl p-3 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {u.full_name || "Sem nome"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email ?? "—"}
                    </p>
                    <p className="text-[11px] mt-0.5">
                      <span className="text-muted-foreground">Origem: </span>
                      <span className={`font-semibold ${origemLabel === NOT_INFORMED ? "text-muted-foreground italic" : "text-foreground"}`}>
                        {origemLabel}
                      </span>
                    </p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {isPremium ? (
                        <Badge className="bg-primary text-primary-foreground stencil text-[10px]">
                          <Crown className="w-3 h-3 mr-1" /> {PLAN_LABEL[u.plan]}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="stencil text-[10px]">
                          Básico
                        </Badge>
                      )}
                      {u.premium_until && (
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          até {new Date(u.premium_until).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => setPlan(u, "monthly", 30)}
                    className="bg-secondary hover:bg-secondary/90 text-secondary-foreground stencil text-[11px]"
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Crown className="w-3 h-3 mr-1" /> Tornar Mensal</>}
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => setPlan(u, "quarterly", 90)}
                    className="bg-warning hover:bg-warning/90 text-warning-foreground stencil text-[11px]"
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Crown className="w-3 h-3 mr-1" /> Tornar Trimestral</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !isPremium}
                    onClick={() => setPlan(u, "basic", null)}
                    className="stencil text-[11px]"
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ShieldOff className="w-3 h-3 mr-1" /> Restringir p/ Básico</>}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
