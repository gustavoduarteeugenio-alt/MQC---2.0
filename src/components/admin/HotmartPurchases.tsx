import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Copy, Loader2, RefreshCw, Search, ShoppingBag, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { formatAccessDate } from "@/lib/access";

type Purchase = {
  transaction: string;
  email: string;
  buyer_name: string | null;
  product_id: string | null;
  status: "active" | "revoked";
  access_until: string | null;
  last_event: string;
  updated_at: string;
  has_account: boolean;
};

type WebhookEvent = {
  id: string;
  event: string;
  action: "grant" | "revoke" | "ignore";
  transaction: string | null;
  email: string | null;
  product_id: string | null;
  applied: boolean;
  received_at: string;
};

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hotmart-webhook`;

const ACTION_LABEL: Record<WebhookEvent["action"], string> = {
  grant: "Libera",
  revoke: "Retira",
  ignore: "Ignorado",
};

export const HotmartPurchases = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: p, error: pErr }, { data: e }] = await Promise.all([
      (supabase as any).rpc("list_hotmart_purchases", { _limit: 500 }),
      (supabase as any)
        .from("hotmart_webhook_events")
        .select("id, event, action, transaction, email, product_id, applied, received_at")
        .order("received_at", { ascending: false })
        .limit(30),
    ]);
    if (pErr) toast.error("Erro ao carregar compras: " + pErr.message);
    setPurchases((p ?? []) as Purchase[]);
    setEvents((e ?? []) as WebhookEvent[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter(
      (x) => x.email.includes(q) || (x.buyer_name ?? "").toLowerCase().includes(q) || x.transaction.toLowerCase().includes(q),
    );
  }, [purchases, query]);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("URL do webhook copiada");
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold">Compras Hotmart ({purchases.length})</h2>
          </div>
          <Button variant="outline" size="icon" onClick={load} aria-label="Recarregar">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Compra aprovada libera o acesso por 1 ano automaticamente; reembolso ou chargeback retira. URL a cadastrar no webhook da Hotmart (versão 2.0.0):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-[11px] bg-background border border-border rounded px-2 py-1">{WEBHOOK_URL}</code>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={copyUrl} aria-label="Copiar URL">
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por e-mail, nome ou transação…"
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma compra recebida.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((x) => {
              const hasAccount = x.has_account;
              const expired = x.status === "active" && !!x.access_until && new Date(x.access_until) <= new Date();
              return (
                <div key={x.transaction} className="border border-border rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{x.buyer_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground truncate">{x.email}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {x.transaction} · {x.last_event} · {new Date(x.updated_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Badge
                      className={x.status === "active" && !expired ? "bg-success text-success-foreground stencil text-[10px]" : "stencil text-[10px]"}
                      variant={x.status === "active" ? (expired ? "secondary" : "default") : "destructive"}
                    >
                      {x.status === "revoked" ? "Revogada" : expired ? "Expirada" : "Ativa"}
                    </Badge>
                  </div>
                  {x.status === "active" && x.access_until && (
                    <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {expired ? "Acesso expirou em " : "Acesso até "}
                      {formatAccessDate(x.access_until)}
                    </p>
                  )}
                  <p className={`mt-1.5 text-[11px] inline-flex items-center gap-1 ${hasAccount ? "text-success" : "text-muted-foreground"}`}>
                    {hasAccount ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                    {hasAccount ? "Conta criada no app" : "Ainda não criou conta com este e-mail"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <h3 className="font-display font-bold text-sm">Últimos eventos recebidos</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento recebido ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between gap-3 text-xs border-b border-border last:border-0 pb-1.5">
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {ev.event}
                    {/* O ID do produto só existe aqui: é por ele que se descobre
                        qual número cadastrar no mapeamento produto → edital. */}
                    {ev.product_id && (
                      <span className="ml-2 font-mono font-normal text-muted-foreground">
                        produto {ev.product_id}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate">{ev.email ?? "—"} · {new Date(ev.received_at).toLocaleString("pt-BR")}</p>
                </div>
                <Badge variant={ev.applied ? "default" : "secondary"} className="stencil text-[10px] shrink-0">
                  {ACTION_LABEL[ev.action]}{ev.action !== "ignore" && !ev.applied ? " · não aplicado" : ""}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
