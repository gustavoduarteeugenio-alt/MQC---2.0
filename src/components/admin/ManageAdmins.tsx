import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type AdminRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  granted_at: string;
};

export const ManageAdmins = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc("list_admins");
    if (error) { toast.error(error.message); return; }
    setAdmins((data ?? []) as AdminRow[]);
  };

  useEffect(() => { load(); }, []);

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("grant_admin_by_email", { _email: email.trim() });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) { toast.error(res?.error ?? "Falha ao promover."); return; }
    toast.success("Usuário promovido a admin.");
    setEmail("");
    load();
  };

  const revoke = async (uid: string, name: string) => {
    if (!confirm(`Remover acesso admin de ${name}?`)) return;
    const { data, error } = await supabase.rpc("revoke_admin", { _user_id: uid });
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) { toast.error(res?.error ?? "Falha ao remover."); return; }
    toast.success("Acesso removido.");
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={grant} className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <div>
          <Label className="stencil text-[10px]">Promover usuário por e-mail</Label>
          <Input
            type="email"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            O usuário precisa já ter conta cadastrada no app.
          </p>
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-gradient-flame text-white stencil">
          <UserPlus className="w-4 h-4 mr-1" /> Promover a admin
        </Button>
      </form>

      <section>
        <h2 className="font-display font-bold mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-secondary" /> Administradores ({admins.length})
        </h2>
        <div className="space-y-2">
          {admins.map((a) => {
            const isSelf = a.user_id === user?.id;
            return (
              <div key={a.user_id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm truncate">
                    {a.full_name ?? "—"} {isSelf && <span className="text-[10px] stencil text-primary">(você)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.email ?? a.user_id}</p>
                </div>
                {!isSelf && (
                  <button
                    onClick={() => revoke(a.user_id, a.full_name ?? a.email ?? "este usuário")}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                    title="Remover admin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
          {admins.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum admin encontrado.</p>
          )}
        </div>
      </section>
    </div>
  );
};
