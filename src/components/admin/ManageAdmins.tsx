import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, UserPlus, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type StaffRole = "admin" | "admin_didatico";

type StaffRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: StaffRole;
  granted_at: string;
};

export const ManageAdmins = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("admin");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc("list_staff" as any);
    if (error) { toast.error(error.message); return; }
    setStaff((data ?? []) as StaffRow[]);
  };

  useEffect(() => { load(); }, []);

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("grant_role_by_email" as any, { _email: email.trim(), _role: role });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) { toast.error(res?.error ?? "Falha ao promover."); return; }
    toast.success("Acesso concedido.");
    setEmail("");
    load();
  };

  const revoke = async (uid: string, r: StaffRole, name: string) => {
    if (!confirm(`Remover acesso ${r === "admin" ? "admin total" : "admin didático"} de ${name}?`)) return;
    const { data, error } = await supabase.rpc("revoke_role" as any, { _user_id: uid, _role: r });
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
        </div>
        <div>
          <Label className="stencil text-[10px]">Tipo de acesso</Label>
          <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin Total</SelectItem>
              <SelectItem value="admin_didatico">Admin Didático (somente questões)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Admin Didático só vê e edita questões — não acessa usuários, simulados nem promove Premium.
          </p>
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-gradient-flame text-white stencil">
          <UserPlus className="w-4 h-4 mr-1" /> Conceder acesso
        </Button>
      </form>

      <section>
        <h2 className="font-display font-bold mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-secondary" /> Equipe ({staff.length})
        </h2>
        <div className="space-y-2">
          {staff.map((a) => {
            const isSelf = a.user_id === user?.id;
            return (
              <div key={a.user_id + a.role} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm truncate">
                    {a.full_name ?? "—"} {isSelf && <span className="text-[10px] stencil text-primary">(você)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.email ?? a.user_id}</p>
                </div>
                <Badge variant={a.role === "admin" ? "default" : "secondary"} className="stencil text-[10px]">
                  {a.role === "admin" ? <><Shield className="w-3 h-3 mr-1" /> Total</> : <><BookOpen className="w-3 h-3 mr-1" /> Didático</>}
                </Badge>
                {!(isSelf && a.role === "admin") && (
                  <button
                    onClick={() => revoke(a.user_id, a.role, a.full_name ?? a.email ?? "este usuário")}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                    title="Remover acesso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
          {staff.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum admin encontrado.</p>
          )}
        </div>
      </section>
    </div>
  );
};
