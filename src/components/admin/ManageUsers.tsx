import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Users, CheckCircle2, XCircle, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { accessUntilFrom, formatAccessDate, hasActiveAccess, isAccessExpired } from "@/lib/access";

type UserRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  origem: string | null;
  approved: boolean;
  access_until: string | null;
};

const ORIGEM_OPTIONS = ["Instagram", "Indicação de Amigo", "Grupos de Estudo", "Google"];
const NOT_INFORMED = "Não Informado";

export const ManageUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, origem, approved, access_until" as any)
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

  // Liberar concede 1 ano a partir de agora (também renova quem já expirou); revogar só desliga.
  const toggleApproval = async (u: UserRow) => {
    setUpdatingId(u.user_id);
    const grant = !hasActiveAccess(u);
    const until = grant ? accessUntilFrom() : null;
    const patch: Partial<UserRow> = grant ? { approved: true, access_until: until } : { approved: false };
    const { error } = await supabase
      .from("profiles")
      .update(patch as any)
      .eq("user_id", u.user_id);
    setUpdatingId(null);
    if (error) {
      toast.error("Falha ao atualizar acesso: " + error.message);
      return;
    }
    toast.success(
      grant
        ? `${u.email ?? "Usuário"} liberado até ${formatAccessDate(until!)}.`
        : `Acesso revogado para ${u.email ?? "usuário"}.`,
    );
    setUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? { ...x, ...patch } : x)));
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
                      {isAccessExpired(u) ? (
                        <Badge variant="secondary" className="stencil text-[10px]">
                          <CalendarClock className="w-3 h-3 mr-1" /> Expirou em {formatAccessDate(u.access_until!)}
                        </Badge>
                      ) : u.approved ? (
                        <Badge className="bg-success text-success-foreground stencil text-[10px]">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {u.access_until ? `Liberado até ${formatAccessDate(u.access_until)}` : "Liberado · sem prazo"}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="stencil text-[10px]">
                          <XCircle className="w-3 h-3 mr-1" /> Aguardando liberação
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => toggleApproval(u)}
                    className={hasActiveAccess(u)
                      ? "bg-muted hover:bg-muted/80 text-foreground stencil text-[11px]"
                      : "bg-success hover:bg-success/90 text-success-foreground stencil text-[11px]"}
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : hasActiveAccess(u) ? <><XCircle className="w-3 h-3 mr-1" /> Revogar acesso</> : <><CheckCircle2 className="w-3 h-3 mr-1" /> Liberar por 1 ano</>}
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
