import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Crown, ShieldOff, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

type UserRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan: "basic" | "premium";
  premium_until: string | null;
};

export const ManageUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, plan, premium_until")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar usuários: " + error.message);
    } else {
      setUsers((data ?? []) as UserRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
    );
  }, [users, query]);

  const togglePlan = async (u: UserRow) => {
    setUpdatingId(u.user_id);
    const newPlan = u.plan === "premium" ? "basic" : "premium";
    const premium_until =
      newPlan === "premium"
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const { error } = await supabase
      .from("profiles")
      .update({ plan: newPlan, premium_until })
      .eq("user_id", u.user_id);

    setUpdatingId(null);

    if (error) {
      toast.error("Falha ao atualizar plano: " + error.message);
      return;
    }
    toast.success(
      newPlan === "premium"
        ? `${u.email ?? "Usuário"} agora é Premium ✅`
        : `Premium removido de ${u.email ?? "usuário"}`
    );
    setUsers((prev) =>
      prev.map((x) =>
        x.user_id === u.user_id ? { ...x, plan: newPlan, premium_until } : x
      )
    );
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold">Usuários ({users.length})</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por e-mail ou nome…"
          className="pl-9"
        />
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
            const isPremium = u.plan === "premium";
            const busy = updatingId === u.user_id;
            return (
              <div
                key={u.user_id}
                className="border border-border rounded-xl p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {u.full_name || "Sem nome"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.email ?? "—"}
                  </p>
                  <div className="mt-1">
                    {isPremium ? (
                      <Badge className="bg-primary text-primary-foreground stencil text-[10px]">
                        <Crown className="w-3 h-3 mr-1" /> Premium
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="stencil text-[10px]">
                        Básico
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => togglePlan(u)}
                  className={
                    isPremium
                      ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground stencil"
                      : "bg-green-700 hover:bg-green-800 text-white stencil"
                  }
                >
                  {busy ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isPremium ? (
                    <>
                      <ShieldOff className="w-3 h-3 mr-1" /> Remover Premium
                    </>
                  ) : (
                    <>
                      <Crown className="w-3 h-3 mr-1" /> Tornar Premium
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
