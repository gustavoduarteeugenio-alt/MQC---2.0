import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Clock, CheckCircle2, MessageSquare, RefreshCw, Send, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type SupportMessage = {
  id: string;
  user_id: string;
  user_email: string | null;
  type: string;
  message: string;
  status: string;
  created_at: string;
};

type Reply = {
  id: string;
  message_id: string;
  author_id: string;
  author_role: "admin" | "user";
  body: string;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  duvida_tecnica: "Dúvida Técnica",
  erro_questao: "Erro em Questão",
  sugestao_melhoria: "Sugestão de Melhoria",
  outros: "Outros",
};

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "respondido", label: "Respondido" },
  { value: "resolvido", label: "Resolvido" },
];

const statusBadge = (status: string) => {
  switch (status) {
    case "respondido": return "bg-warning/20 text-warning-foreground border-warning/40";
    case "resolvido": return "bg-success/20 text-success-foreground border-success/40";
    default: return "bg-destructive/20 text-destructive border-destructive/40";
  }
};

export const SupportMessages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("support_messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar mensagens");
    setMessages((data ?? []) as SupportMessage[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadReplies = async (messageId: string) => {
    const { data, error } = await (supabase as any)
      .from("support_replies")
      .select("*")
      .eq("message_id", messageId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar respostas");
      return;
    }
    setReplies((prev) => ({ ...prev, [messageId]: (data ?? []) as Reply[] }));
  };

  const toggleOpen = (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next && !replies[next]) loadReplies(next);
  };

  // Realtime subscription for open message
  useEffect(() => {
    if (!openId) return;
    const channel = supabase
      .channel(`support-replies-${openId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_replies", filter: `message_id=eq.${openId}` },
        (payload) => {
          const r = payload.new as Reply;
          setReplies((prev) => {
            const list = prev[openId] ?? [];
            if (list.some((x) => x.id === r.id)) return prev;
            return { ...prev, [openId]: [...list, r] };
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [openId]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("support_messages").update({ status }).eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar o status");
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    toast.success("Status atualizado");
  };

  const sendReply = async (m: SupportMessage) => {
    const body = (drafts[m.id] ?? "").trim();
    if (body.length < 1) return;
    if (!user) return;
    setSending(m.id);
    const { error } = await (supabase as any).from("support_replies").insert({
      message_id: m.id,
      author_id: user.id,
      author_role: "admin",
      body,
    });
    if (error) {
      setSending(null);
      toast.error("Não foi possível enviar a resposta");
      return;
    }
    setDrafts((prev) => ({ ...prev, [m.id]: "" }));
    if (m.status === "pendente") {
      await updateStatus(m.id, "respondido");
    }
    setSending(null);
  };

  const filtered = filter === "all" ? messages : messages.filter((m) => m.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" /> Mensagens de Suporte
          </h2>
          <p className="text-xs text-muted-foreground">Atendimento ao combatente</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="respondido">Respondidos</SelectItem>
              <SelectItem value="resolvido">Resolvidos</SelectItem>
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
        <div className="text-center py-10 text-sm text-muted-foreground">Nenhuma mensagem encontrada.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const isOpen = openId === m.id;
            const msgReplies = replies[m.id] ?? [];
            return (
              <div key={m.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{m.user_email ?? m.user_id}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary stencil">
                        {TYPE_LABELS[m.type] ?? m.type}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] rounded-full border stencil ${statusBadge(m.status)}`}>
                        {m.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(m.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <Select value={m.status} onValueChange={(v) => updateStatus(m.id, v)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{m.message}</p>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => toggleOpen(m.id)}>
                    <MessageSquare className="w-3.5 h-3.5 mr-1" />
                    {isOpen ? "Fechar conversa" : `Conversar${msgReplies.length ? ` (${msgReplies.length})` : ""}`}
                  </Button>
                  {m.status !== "resolvido" && (
                    <Button size="sm" onClick={() => updateStatus(m.id, "resolvido")} className="bg-success text-success-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Resolvido
                    </Button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-4 border-t border-border pt-4 space-y-3">
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {msgReplies.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">Nenhuma resposta ainda. Inicie a conversa abaixo.</p>
                      ) : (
                        msgReplies.map((r) => {
                          const isAdmin = r.author_role === "admin";
                          return (
                            <div key={r.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isAdmin ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                                <div className="flex items-center gap-1.5 text-[10px] opacity-80 mb-0.5">
                                  {isAdmin ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                  <span className="stencil">{isAdmin ? "Suporte" : "Aluno"}</span>
                                  <span>· {new Date(r.created_at).toLocaleString("pt-BR")}</span>
                                </div>
                                <p className="whitespace-pre-wrap leading-relaxed">{r.body}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="flex gap-2 items-end">
                      <Textarea
                        value={drafts[m.id] ?? ""}
                        onChange={(e) => setDrafts((p) => ({ ...p, [m.id]: e.target.value }))}
                        placeholder="Escreva uma resposta ao aluno..."
                        rows={2}
                        maxLength={2000}
                        className="flex-1"
                      />
                      <Button
                        onClick={() => sendReply(m)}
                        disabled={sending === m.id || !(drafts[m.id] ?? "").trim()}
                        className="bg-gradient-brand text-white"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
