import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Clock, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { accessUntilFrom } from "@/lib/access";

type Ticket = {
  id: string;
  user_id: string | null;
  email_usuario: string;
  mensagem: string;
  status_resolvido: boolean;
  created_at: string;
  resolved_at: string | null;
};

export const AccessRequests = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "resolved" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("tickets_suporte")
      .select("*")
      .order("status_resolvido", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar tickets");
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (t: Ticket) => {
    setBusy(t.id);
    try {
      const { data: prof, error: profErr } = await (supabase as any)
        .from("profiles")
        .select("user_id, email")
        .ilike("email", t.email_usuario)
        .maybeSingle();
      if (profErr || !prof) {
        toast.error("Usuário não encontrado por este e-mail. Peça para o aluno se cadastrar antes.");
        setBusy(null);
        return;
      }
      const { error: upErr } = await (supabase as any)
        .from("profiles")
        .update({ approved: true, access_until: accessUntilFrom() })
        .eq("user_id", prof.user_id);
      if (upErr) {
        toast.error("Falha ao aprovar usuário");
        setBusy(null);
        return;
      }
      await (supabase as any)
        .from("tickets_suporte")
        .update({
          status_resolvido: true,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", t.id);
      toast.success("Usuário liberado por 1 ano!");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const resolve = async (t: Ticket) => {
    setBusy(t.id);
    const { error } = await (supabase as any)
      .from("tickets_suporte")
      .update({ status_resolvido: true, resolved_at: new Date().toISOString() })
      .eq("id", t.id);
    setBusy(null);
    if (error) { toast.error("Falha ao marcar como resolvido"); return; }
    toast.success("Ticket marcado como resolvido");
    await load();
  };

  const filtered = tickets.filter((t) =>
    filter === "all" ? true : filter === "pending" ? !t.status_resolvido : t.status_resolvido
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Liberações pendentes
          </h2>
          <p className="text-xs text-muted-foreground">Pedidos de acesso vindos da tela de login</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="resolved">Resolvidos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Nenhum pedido encontrado.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl p-4 shadow-sm border-2 ${
                t.status_resolvido
                  ? "border-success/40 bg-success/5"
                  : "border-amber-400/60 bg-amber-500/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="truncate">{t.email_usuario}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full border stencil ${
                        t.status_resolvido
                          ? "bg-success/20 text-success-foreground border-success/40"
                          : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40"
                      }`}
                    >
                      {t.status_resolvido ? "Resolvido" : "Pendente"}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(t.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{t.mensagem}</p>
              {!t.status_resolvido && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => approve(t)}
                    disabled={busy === t.id}
                    className="bg-gradient-flame text-white"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    Aprovar Usuário
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolve(t)}
                    disabled={busy === t.id}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Marcar como resolvido
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
