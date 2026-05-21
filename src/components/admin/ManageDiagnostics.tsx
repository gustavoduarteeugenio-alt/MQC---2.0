import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Download, Users, CheckCircle2, Activity, Instagram, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Overview = {
  total_sessions: number;
  completed_sessions: number;
  leads_count: number;
  last_24h: number;
  last_7d: number;
  avg_score: number;
};

type SessionRow = {
  id: string;
  created_at: string;
  completed_at: string | null;
  lead_name: string | null;
  instagram_handle: string | null;
  profile_name: string | null;
  profile_email: string | null;
  user_id: string | null;
  correct: number;
  total: number;
  total_count: number;
};

type Filter = "all" | "completed" | "leads" | "anonymous";

const PAGE_SIZE = 20;

export const ManageDiagnostics = () => {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [ov, list] = await Promise.all([
        (supabase as any).rpc("get_diagnostic_overview"),
        (supabase as any).rpc("list_diagnostic_sessions", {
          _limit: PAGE_SIZE,
          _offset: page * PAGE_SIZE,
          _filter: filter,
        }),
      ]);
      if (ov.error) throw ov.error;
      if (list.error) throw list.error;
      setOverview(ov.data as Overview);
      const data = (list.data ?? []) as SessionRow[];
      setRows(data);
      setTotalCount(data[0]?.total_count ? Number(data[0].total_count) : 0);
    } catch (e: any) {
      toast.error("Falha ao carregar diagnósticos: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter, page]);

  const exportCsv = async () => {
    try {
      const { data, error } = await (supabase as any).rpc("list_diagnostic_sessions", {
        _limit: 5000,
        _offset: 0,
        _filter: filter,
      });
      if (error) throw error;
      const list = (data ?? []) as SessionRow[];
      const header = ["data", "concluido_em", "nome_lead", "instagram", "nome_perfil", "email_perfil", "acertos", "total"];
      const csv = [
        header.join(","),
        ...list.map(r => [
          new Date(r.created_at).toISOString(),
          r.completed_at ? new Date(r.completed_at).toISOString() : "",
          r.lead_name ?? "",
          r.instagram_handle ?? "",
          r.profile_name ?? "",
          r.profile_email ?? "",
          r.correct,
          r.total,
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diagnosticos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("Falha ao exportar: " + (e.message || ""));
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Diagnósticos</h2>
        <p className="text-sm text-muted-foreground">Quem fez, quantos completaram e leads capturados.</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard icon={Activity} label="Total iniciados" value={overview?.total_sessions ?? "—"} />
        <MetricCard icon={CheckCircle2} label="Completados" value={overview?.completed_sessions ?? "—"} />
        <MetricCard icon={Instagram} label="Leads capturados" value={overview?.leads_count ?? "—"} />
        <MetricCard icon={Activity} label="Últimas 24h" value={overview?.last_24h ?? "—"} />
        <MetricCard icon={Activity} label="Últimos 7 dias" value={overview?.last_7d ?? "—"} />
        <MetricCard icon={Users} label="Média de acerto" value={overview ? `${overview.avg_score}%` : "—"} />
      </div>

      {/* Filters + export */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { id: "all", label: "Todos" },
          { id: "completed", label: "Completados" },
          { id: "leads", label: "Com lead" },
          { id: "anonymous", label: "Anônimos" },
        ] as { id: Filter; label: string }[]).map(f => (
          <button
            key={f.id}
            onClick={() => { setPage(0); setFilter(f.id); }}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhum diagnóstico encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Identificação</th>
                  <th className="text-left p-3">Instagram</th>
                  <th className="text-left p-3">Resultado</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const name = r.lead_name?.trim() || r.profile_name || (r.user_id ? "Usuário cadastrado" : "Visitante anônimo");
                  const email = r.profile_email;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 whitespace-nowrap text-muted-foreground text-xs">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{name}</div>
                        {email && <div className="text-xs text-muted-foreground">{email}</div>}
                      </td>
                      <td className="p-3 text-xs">
                        {r.instagram_handle ? (
                          <a
                            href={`https://instagram.com/${r.instagram_handle.replace(/^@/, "")}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            @{r.instagram_handle.replace(/^@/, "")}
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-xs">
                        {r.total > 0 ? `${r.correct}/${r.total} (${Math.round((r.correct / r.total) * 100)}%)` : "—"}
                      </td>
                      <td className="p-3">
                        {r.completed_at ? (
                          <span className="inline-flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="w-3 h-3" /> Concluído
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Em andamento</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {page + 1} de {totalPages} · {totalCount} registros</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
    <div className="text-2xl font-display font-bold mt-1">{value}</div>
  </Card>
);
