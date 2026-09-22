import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Loader2, ClipboardList, Target } from "lucide-react";
import { toast } from "sonner";
import { ContentNode, disciplineOf, disciplinesOf } from "@/lib/exams";
import { SimuladoBulkImport } from "./SimuladoBulkImport";

type Exam = { id: string; name: string; duration_minutes: number };
type Simulado = { id: string; name: string; description: string | null; duration_minutes?: number; q_count?: number };
/** Questão do edital: o vínculo traz a classificação que vale ali. */
type Question = { id: string; statement: string; year: number | null; content_node_id: string | null; status: string };

export const ManageSimulados = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Simulado | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<number>(240);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [filterDisciplina, setFilterDisciplina] = useState<string>("all");
  const [filterText, setFilterText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const exam = useMemo(() => exams.find((e) => e.id === examId) ?? null, [exams, examId]);
  const disciplinas = useMemo(() => disciplinesOf(nodes), [nodes]);
  // O alvo do simulado é a própria prova do edital: peso de cada disciplina.
  const alvoPorDisciplina = useMemo(() => {
    const map: Record<string, number> = {};
    disciplinas.forEach((d) => { if (d.weight) map[d.id] = d.weight; });
    return map;
  }, [disciplinas]);
  const alvoTotal = useMemo(
    () => Object.values(alvoPorDisciplina).reduce((a, b) => a + b, 0),
    [alvoPorDisciplina],
  );

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("exams").select("id, name, duration_minutes").order("year", { ascending: false });
      const lista = (data ?? []) as Exam[];
      setExams(lista);
      setExamId((atual) => atual || lista[0]?.id || "");
    })();
  }, []);

  useEffect(() => {
    if (!examId) { setNodes([]); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("content_nodes").select("*").eq("exam_id", examId).order("level").order("display_order");
      setNodes((data ?? []) as ContentNode[]);
      setFilterDisciplina("all");
    })();
  }, [examId]);

  const load = useCallback(async () => {
    if (!examId) { setSimulados([]); return; }
    setLoading(true);
    const [{ data: sims }, { data: counts }] = await Promise.all([
      (supabase as any).from("simulados")
        .select("id, name, description, duration_minutes")
        .eq("exam_id", examId)
        .order("created_at", { ascending: false }),
      (supabase as any).from("simulado_questions").select("simulado_id"),
    ]);
    const cmap: Record<string, number> = {};
    ((counts ?? []) as any[]).forEach((c: any) => { cmap[c.simulado_id] = (cmap[c.simulado_id] ?? 0) + 1; });
    setSimulados(((sims ?? []) as any[]).map((s) => ({ ...s, q_count: cmap[s.id] ?? 0 })));
    setLoading(false);
  }, [examId]);

  useEffect(() => { load(); }, [load]);

  /** Banco do edital: só questões vinculadas a ele, com a classificação dele. */
  const loadQuestions = async () => {
    if (!examId) { setAllQuestions([]); return; }
    const { data } = await (supabase as any).rpc("admin_list_exam_questions", {
      _exam_id: examId, _node_ids: null, _search: null, _limit: 2000,
    });
    setAllQuestions(((data ?? []) as any[]).map((r) => ({
      id: r.id,
      statement: r.statement,
      year: r.year ?? null,
      content_node_id: r.content_node_id ?? null,
      status: r.status,
    })));
  };

  const openNew = async () => {
    if (!exam) { toast.error("Selecione um edital."); return; }
    setEditing(null);
    setName(""); setDescription(""); setDuration(exam.duration_minutes ?? 240); setSelectedIds(new Set());
    setFilterDisciplina("all"); setFilterText("");
    await loadQuestions();
    setOpenForm(true);
  };

  const openEdit = async (s: Simulado) => {
    setEditing(s);
    setName(s.name); setDescription(s.description ?? ""); setDuration(s.duration_minutes ?? 240);
    setFilterDisciplina("all"); setFilterText("");
    await loadQuestions();
    const { data: links } = await (supabase as any)
      .from("simulado_questions").select("question_id").eq("simulado_id", s.id);
    setSelectedIds(new Set(((links ?? []) as any[]).map((l: any) => l.question_id)));
    setOpenForm(true);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const save = async () => {
    if (!examId) { toast.error("Selecione um edital."); return; }
    if (!name.trim()) { toast.error("Informe um nome."); return; }
    if (selectedIds.size === 0) { toast.error("Selecione ao menos uma questão."); return; }
    if (!duration || duration < 1) { toast.error("Informe uma duração válida."); return; }
    setSaving(true);
    try {
      let simId = editing?.id;
      const payload = { name, description, duration_minutes: duration, exam_id: examId };
      if (editing) {
        await (supabase as any).from("simulados").update(payload).eq("id", editing.id);
        await (supabase as any).from("simulado_questions").delete().eq("simulado_id", editing.id);
      } else {
        const { data, error } = await (supabase as any).from("simulados").insert(payload).select("id").single();
        if (error) throw error;
        simId = data.id;
      }
      const ids = Array.from(selectedIds);
      const rows = ids.map((qid, i) => ({ simulado_id: simId, question_id: qid, position: i }));
      const { error: e2 } = await (supabase as any).from("simulado_questions").insert(rows);
      if (e2) throw e2;
      toast.success(editing ? "Simulado atualizado." : "Simulado criado.");
      setOpenForm(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Simulado) => {
    if (!confirm(`Excluir "${s.name}"?`)) return;
    const { error } = await (supabase as any).from("simulados").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído."); load();
  };

  const filtered = allQuestions.filter((q) => {
    if (filterDisciplina !== "all" && disciplineOf(nodes, q.content_node_id)?.id !== filterDisciplina) return false;
    if (filterText && !q.statement.toLowerCase().includes(filterText.toLowerCase())) return false;
    return true;
  });

  // Contagem por disciplina das questões selecionadas
  const selectedPorDisciplina = useMemo(() => {
    const map: Record<string, number> = {};
    allQuestions.forEach((q) => {
      if (!selectedIds.has(q.id)) return;
      const d = disciplineOf(nodes, q.content_node_id);
      const key = d?.id ?? "outros";
      map[key] = (map[key] ?? 0) + 1;
    });
    return map;
  }, [selectedIds, allQuestions, nodes]);

  const total = selectedIds.size;
  const overTarget = alvoTotal > 0 && total > alvoTotal;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold">Gestão de Simulados</h3>
        </div>
        <Button size="sm" onClick={openNew} disabled={!examId} className="bg-gradient-flame text-white stencil">
          <Plus className="w-4 h-4 mr-1" /> Novo simulado
        </Button>
      </div>

      <div>
        <Label className="text-xs">Edital</Label>
        <Select value={examId} onValueChange={setExamId}>
          <SelectTrigger><SelectValue placeholder="Edital" /></SelectTrigger>
          <SelectContent>
            {exams.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <SimuladoBulkImport examId={examId} nodes={nodes} onImported={load} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : simulados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum simulado cadastrado neste edital.</p>
      ) : (
        <div className="space-y-2">
          {simulados.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-card border border-border rounded-xl p-3">
              <div>
                <p className="font-display font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground stencil">
                  {s.q_count} questões · {s.duration_minutes ?? 240} min
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(s)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Simulado" : "Cadastrar Simulado Inédito"}
              {exam && <span className="block text-xs font-normal text-muted-foreground mt-0.5">{exam.name}</span>}
            </DialogTitle>
          </DialogHeader>

          {/* Contador fixo */}
          <div className={`sticky top-0 z-10 -mx-6 px-6 py-2 border-b border-border flex items-center gap-2 ${overTarget ? "bg-destructive/10" : "bg-primary/5"}`}>
            <Target className={`w-4 h-4 ${overTarget ? "text-destructive" : "text-primary"}`} />
            <span className="font-display font-bold text-sm">
              Selecionadas: <span className={overTarget ? "text-destructive" : "text-primary"}>{total}</span>
              {alvoTotal > 0 ? ` / ${alvoTotal} questões` : " questões"}
            </span>
            {overTarget && <span className="text-xs text-destructive ml-2">acima da prova</span>}
          </div>

          <div className="grid md:grid-cols-[1fr_240px] gap-4 overflow-y-auto pr-1 pt-2">
            {/* Coluna principal */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <Label>Nome do Simulado</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Simulado Zero 01" />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>

              <div className="space-y-2">
                <Label>Banco de questões do edital</Label>
                <div className="flex gap-2">
                  <select
                    className="border border-border rounded-md px-2 py-1 text-sm bg-background"
                    value={filterDisciplina}
                    onChange={(e) => setFilterDisciplina(e.target.value)}
                  >
                    <option value="all">Todas as disciplinas</option>
                    {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <Input placeholder="Buscar enunciado..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="flex-1" />
                </div>

                <div className="border border-border rounded-md max-h-[45vh] overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma questão encontrada.</p>
                  ) : filtered.map((q) => (
                    <label key={q.id} className="flex items-start gap-2 p-2 border-b border-border hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={selectedIds.has(q.id)} onCheckedChange={() => toggle(q.id)} className="mt-1" />
                      <div className="flex-1 text-sm">
                        <p className="line-clamp-2">{q.statement}</p>
                        <p className="text-[10px] stencil text-muted-foreground mt-0.5">
                          {disciplineOf(nodes, q.content_node_id)?.name ?? "Sem classificação"}
                          {q.year ? ` · ${q.year}` : ""}
                          {q.status !== "published" ? " · rascunho" : ""}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Resumo: quanto cada disciplina pesa na prova */}
            <aside className="bg-muted/30 border border-border rounded-xl p-3 h-fit md:sticky md:top-12">
              <p className="font-display font-bold text-sm mb-2">Resumo por disciplina</p>
              <ul className="space-y-1.5">
                {disciplinas.map((d) => {
                  const alvo = alvoPorDisciplina[d.id];
                  const got = selectedPorDisciplina[d.id] ?? 0;
                  const ok = alvo ? got === alvo : false;
                  const over = alvo ? got > alvo : false;
                  return (
                    <li key={d.id} className="flex items-center justify-between text-xs">
                      <span className="truncate pr-2">{d.name}</span>
                      <span className={`stencil font-bold ${over ? "text-destructive" : ok ? "text-primary" : "text-muted-foreground"}`}>
                        {got}{alvo ? ` / ${alvo}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs">
                <span className="font-display font-bold">Total</span>
                <span className={`stencil font-bold ${overTarget ? "text-destructive" : "text-primary"}`}>
                  {total}{alvoTotal > 0 ? ` / ${alvoTotal}` : ""}
                </span>
              </div>
            </aside>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-flame text-white stencil">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? "Salvar alterações" : "Cadastrar simulado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
