import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Users, CheckCircle2, XCircle, CalendarClock, GraduationCap, X } from "lucide-react";
import { toast } from "sonner";
import { accessUntilFrom, formatAccessDate, hasActiveAccess, isAccessExpired } from "@/lib/access";
import { examLabelCurto } from "@/lib/exams";

type UserRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  origem: string | null;
  approved: boolean;
  access_until: string | null;
};

type Exam = { id: string; name: string; sigla: string };
type Matricula = { user_id: string; exam_id: string };

const ORIGEM_OPTIONS = ["Instagram", "Indicação de Amigo", "Grupos de Estudo", "Google"];
const NOT_INFORMED = "Não Informado";

export const ManageUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  // Edital escolhido para cada usuário. Sem escolha não há liberação: era
  // justamente a liberação sem edital que deixava a aluna presa em
  // "Aguardando sua matrícula", parecendo falha de login.
  const [escolha, setEscolha] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: perfis, error }, { data: ex }, { data: ens }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, email, origem, approved, access_until" as any)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("exams")
        .select("id, name, contests(institutions(sigla))")
        .order("name"),
      (supabase as any).from("enrollments").select("user_id, exam_id"),
    ]);
    if (error) {
      toast.error("Erro ao carregar usuários: " + error.message);
    } else {
      setUsers(((perfis ?? []) as any) as UserRow[]);
    }
    setExams(
      ((ex ?? []) as any[]).map((e) => ({
        id: e.id,
        name: e.name,
        sigla: e.contests?.institutions?.sigla ?? "",
      })),
    );
    setMatriculas(((ens ?? []) as any) as Matricula[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const rotulo = useCallback(
    (examId: string) => {
      const e = exams.find((x) => x.id === examId);
      if (!e) return "edital removido";
      return examLabelCurto({
        id: e.id, slug: "", name: e.name, year: null, duration_minutes: 240,
        contest_name: "", institution_name: "", institution_sigla: e.sigla,
      });
    },
    [exams],
  );

  const editaisDe = useCallback(
    (userId: string) => matriculas.filter((m) => m.user_id === userId).map((m) => m.exam_id),
    [matriculas],
  );

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

  /** Matricula no edital, com o mesmo prazo do acesso. */
  const matricular = async (u: UserRow, examId: string, until: string | null) => {
    const { error } = await (supabase as any).from("enrollments").insert({
      user_id: u.user_id,
      exam_id: examId,
      source: "manual",
      access_until: until,
    });
    if (error) {
      // 23505 = já existe. Qualquer outro erro o admin precisa ver: sem
      // matrícula, o acesso liberado não leva a lugar nenhum.
      if (error.code !== "23505") throw error;
      return false;
    }
    setMatriculas((prev) => [...prev, { user_id: u.user_id, exam_id: examId }]);
    return true;
  };

  // Liberar concede 1 ano a partir de agora (também renova quem já expirou) e
  // matricula no edital escolhido; revogar só desliga o acesso.
  const toggleApproval = async (u: UserRow) => {
    const grant = !hasActiveAccess(u);
    const examId = escolha[u.user_id];
    if (grant && !examId) {
      toast.error("Escolha o concurso antes de liberar.");
      return;
    }
    setUpdatingId(u.user_id);
    try {
      const until = grant ? accessUntilFrom() : null;
      const patch: Partial<UserRow> = grant ? { approved: true, access_until: until } : { approved: false };
      const { error } = await supabase.from("profiles").update(patch as any).eq("user_id", u.user_id);
      if (error) throw error;

      if (grant) await matricular(u, examId, until);

      setUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? { ...x, ...patch } : x)));
      toast.success(
        grant
          ? `${u.email ?? "Usuário"} liberado em ${rotulo(examId)} até ${formatAccessDate(until!)}.`
          : `Acesso revogado para ${u.email ?? "usuário"}. As matrículas continuam — reative quando quiser.`,
      );
    } catch (e: any) {
      toast.error("Falha ao atualizar acesso: " + (e.message ?? e));
    } finally {
      setUpdatingId(null);
    }
  };

  /** Acrescenta um edital a quem já está liberado. */
  const adicionarEdital = async (u: UserRow) => {
    const examId = escolha[u.user_id];
    if (!examId) {
      toast.error("Escolha o concurso antes de matricular.");
      return;
    }
    setUpdatingId(u.user_id);
    try {
      const novo = await matricular(u, examId, u.access_until);
      toast[novo ? "success" : "info"](
        novo
          ? `${u.email ?? "Usuário"} matriculado em ${rotulo(examId)}.`
          : `${u.email ?? "Usuário"} já estava em ${rotulo(examId)}.`,
      );
    } catch (e: any) {
      toast.error("Falha ao matricular: " + (e.message ?? e));
    } finally {
      setUpdatingId(null);
    }
  };

  const removerEdital = async (u: UserRow, examId: string) => {
    if (!confirm(`Tirar ${u.email ?? "este usuário"} de ${rotulo(examId)}? O histórico de respostas é mantido.`)) return;
    setUpdatingId(u.user_id);
    const { error } = await (supabase as any)
      .from("enrollments").delete().eq("user_id", u.user_id).eq("exam_id", examId);
    setUpdatingId(null);
    if (error) { toast.error("Falha ao remover: " + error.message); return; }
    setMatriculas((prev) => prev.filter((m) => !(m.user_id === u.user_id && m.exam_id === examId)));
    toast.success(`Removido de ${rotulo(examId)}.`);
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
            const liberado = hasActiveAccess(u);
            const meusEditais = editaisDe(u.user_id);
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

                      {/* Em qual concurso ele estuda. Sem nenhum, o acesso não leva a lugar nenhum. */}
                      {meusEditais.length === 0 ? (
                        <Badge variant="outline" className="stencil text-[10px] border-destructive/50 text-destructive">
                          <GraduationCap className="w-3 h-3 mr-1" /> Sem concurso
                        </Badge>
                      ) : (
                        meusEditais.map((examId) => (
                          <Badge key={examId} variant="outline" className="stencil text-[10px] gap-1">
                            <GraduationCap className="w-3 h-3" /> {rotulo(examId)}
                            <button
                              onClick={() => removerEdital(u, examId)}
                              disabled={busy}
                              aria-label={`Tirar de ${rotulo(examId)}`}
                              className="hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={escolha[u.user_id] ?? ""}
                    onValueChange={(v) => setEscolha((p) => ({ ...p, [u.user_id]: v }))}
                  >
                    <SelectTrigger className="h-8 w-full sm:w-52 text-xs">
                      <SelectValue placeholder="Concurso…" />
                    </SelectTrigger>
                    <SelectContent>
                      {exams.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{rotulo(e.id)} · {e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => toggleApproval(u)}
                    className={liberado
                      ? "bg-muted hover:bg-muted/80 text-foreground stencil text-[11px]"
                      : "bg-success hover:bg-success/90 text-success-foreground stencil text-[11px]"}
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : liberado ? <><XCircle className="w-3 h-3 mr-1" /> Revogar acesso</> : <><CheckCircle2 className="w-3 h-3 mr-1" /> Liberar por 1 ano</>}
                  </Button>

                  {/* Quem já está liberado precisa de um jeito de ganhar outro edital
                      — e de ganhar o primeiro, no caso de quem foi liberado antes
                      de o painel pedir o concurso. */}
                  {liberado && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => adicionarEdital(u)}
                      className="stencil text-[11px]"
                    >
                      <GraduationCap className="w-3 h-3 mr-1" /> Matricular
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
