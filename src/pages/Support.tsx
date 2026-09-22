import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MessageSquare, Send, Radio, Shield, User as UserIcon, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const TYPES = [
  { value: "duvida_tecnica", label: "Dúvida Técnica" },
  { value: "erro_questao", label: "Erro em Questão" },
  { value: "sugestao_melhoria", label: "Sugestão de Melhoria" },
  { value: "outros", label: "Outros" },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

const schema = z.object({
  type: z.string().min(1, "Selecione o tipo de mensagem"),
  message: z.string().trim().min(10, "Escreva ao menos 10 caracteres").max(2000, "Máximo de 2000 caracteres"),
});

type Msg = {
  id: string;
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

const statusBadge = (status: string) => {
  switch (status) {
    case "respondido": return "bg-warning/20 text-warning-foreground border-warning/40";
    case "resolvido": return "bg-success/20 text-success-foreground border-success/40";
    default: return "bg-destructive/20 text-destructive border-destructive/40";
  }
};

const Support = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myMessages, setMyMessages] = useState<Msg[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  const loadMine = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("support_messages")
      .select("id,type,message,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyMessages((data ?? []) as Msg[]);
  };

  useEffect(() => { loadMine(); }, [user]);

  const loadReplies = async (id: string) => {
    const { data } = await (supabase as any)
      .from("support_replies")
      .select("*")
      .eq("message_id", id)
      .order("created_at", { ascending: true });
    setReplies((p) => ({ ...p, [id]: (data ?? []) as Reply[] }));
  };

  const toggleOpen = (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next && !replies[next]) loadReplies(next);
  };

  useEffect(() => {
    if (!openId) return;
    const channel = supabase
      .channel(`user-replies-${openId}`)
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

  const submit = async () => {
    const parsed = schema.safeParse({ type, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!user) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from("support_messages").insert({
      user_id: user.id,
      user_email: user.email,
      type: parsed.data.type,
      message: parsed.data.message,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar. Tente novamente.");
      return;
    }
    toast.success("Mensagem enviada com sucesso!");
    setType("");
    setMessage("");
    loadMine();
  };

  const sendReply = async (msgId: string) => {
    const body = (drafts[msgId] ?? "").trim();
    if (!body || !user) return;
    setSending(msgId);
    const { error } = await (supabase as any).from("support_replies").insert({
      message_id: msgId,
      author_id: user.id,
      author_role: "user",
      body,
    });
    setSending(null);
    if (error) {
      toast.error("Não foi possível enviar a resposta");
      return;
    }
    setDrafts((p) => ({ ...p, [msgId]: "" }));
  };

  return (
    <AppShell>
      <header className="bg-gradient-dark text-white px-5 pt-12 pb-10 rounded-b-[2rem]">
        <button onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="mt-2 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-brand shadow-brand flex items-center justify-center">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="stencil text-[10px] text-primary">Canal Direto</p>
            <h1 className="font-display text-xl font-bold">Sala de Comando</h1>
          </div>
        </div>
        <p className="text-xs text-white/80 mt-3 leading-relaxed">
          Envie dúvidas, reporte erros ou sugestões e acompanhe as respostas da equipe em tempo real.
        </p>
      </header>

      <main className="px-5 -mt-6 pb-8 space-y-4 relative">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
          <div className="space-y-2">
            <label className="stencil text-[11px] text-muted-foreground">Tipo de mensagem</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="stencil text-[11px] text-muted-foreground">Mensagem</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva sua dúvida, erro encontrado ou sugestão..."
              rows={6}
              maxLength={2000}
            />
            <p className="text-[10px] text-muted-foreground text-right">{message.length}/2000</p>
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full bg-gradient-brand text-white font-display stencil">
            <Send className="w-4 h-4 mr-2" /> {submitting ? "Enviando..." : "Enviar mensagem"}
          </Button>
        </div>

        {myMessages.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-sm font-bold flex items-center gap-2 px-1">
              <MessageSquare className="w-4 h-4 text-primary" /> Minhas mensagens
            </h2>
            {myMessages.map((m) => {
              const isOpen = openId === m.id;
              const list = replies[m.id] ?? [];
              return (
                <div key={m.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary stencil">
                      {TYPE_LABELS[m.type] ?? m.type}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full border stencil ${statusBadge(m.status)}`}>
                      {m.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3" />
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => toggleOpen(m.id)}>
                    <MessageSquare className="w-3.5 h-3.5 mr-1" />
                    {isOpen ? "Fechar conversa" : `Ver conversa${list.length ? ` (${list.length})` : ""}`}
                  </Button>

                  {isOpen && (
                    <div className="mt-4 border-t border-border pt-4 space-y-3">
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {list.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3">Aguardando resposta da equipe...</p>
                        ) : (
                          list.map((r) => {
                            const isAdmin = r.author_role === "admin";
                            return (
                              <div key={r.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isAdmin ? "bg-muted text-foreground rounded-bl-sm" : "bg-primary text-primary-foreground rounded-br-sm"}`}>
                                  <div className="flex items-center gap-1.5 text-[10px] opacity-80 mb-0.5">
                                    {isAdmin ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                                    <span className="stencil">{isAdmin ? "Suporte" : "Você"}</span>
                                    <span>· {new Date(r.created_at).toLocaleString("pt-BR")}</span>
                                  </div>
                                  <p className="whitespace-pre-wrap leading-relaxed">{r.body}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {m.status !== "resolvido" && (
                        <div className="flex gap-2 items-end">
                          <Textarea
                            value={drafts[m.id] ?? ""}
                            onChange={(e) => setDrafts((p) => ({ ...p, [m.id]: e.target.value }))}
                            placeholder="Responder à equipe..."
                            rows={2}
                            maxLength={2000}
                            className="flex-1"
                          />
                          <Button
                            onClick={() => sendReply(m.id)}
                            disabled={sending === m.id || !(drafts[m.id] ?? "").trim()}
                            className="bg-gradient-brand text-white"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-muted/40 border border-border rounded-2xl p-4 text-xs text-muted-foreground flex gap-3">
          <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>Toda mensagem é registrada. As respostas da equipe aparecem aqui em tempo real.</p>
        </div>
      </main>
    </AppShell>
  );
};

export default Support;
