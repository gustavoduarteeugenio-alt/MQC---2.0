import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

type Subject = { id: string; name: string };
type Simulado = { id: string; name: string; description: string | null; q_count?: number };
type Question = { id: string; statement: string; subject_id: string; year: number | null };

export const ManageSimulados = ({ subjects }: { subjects: Subject[] }) => {
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Simulado | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterText, setFilterText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]));

  const load = async () => {
    setLoading(true);
    const [{ data: sims }, { data: counts }] = await Promise.all([
      (supabase.from("simulados" as any).select("id, name, description").order("created_at", { ascending: false })) as any,
      (supabase.from("simulado_questions" as any).select("simulado_id")) as any,
    ]);
    const cmap: Record<string, number> = {};
    (counts ?? []).forEach((c: any) => { cmap[c.simulado_id] = (cmap[c.simulado_id] ?? 0) + 1; });
    setSimulados(((sims ?? []) as any[]).map((s) => ({ ...s, q_count: cmap[s.id] ?? 0 })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = async () => {
    setEditing(null);
    setName(""); setDescription(""); setSelectedIds(new Set());
    await loadQuestions();
    setOpenForm(true);
  };

  const openEdit = async (s: Simulado) => {
    setEditing(s);
    setName(s.name); setDescription(s.description ?? "");
    await loadQuestions();
    const { data: links } = await (supabase.from("simulado_questions" as any).select("question_id").eq("simulado_id", s.id)) as any;
    setSelectedIds(new Set((links ?? []).map((l: any) => l.question_id)));
    setOpenForm(true);
  };

  const loadQuestions = async () => {
    const { data } = await supabase.from("questions").select("id, statement, subject_id, year").order("created_at", { ascending: false });
    setAllQuestions((data ?? []) as Question[]);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Informe um nome."); return; }
    if (selectedIds.size === 0) { toast.error("Selecione ao menos uma questão."); return; }
    setSaving(true);
    try {
      let simId = editing?.id;
      if (editing) {
        await (supabase.from("simulados" as any).update({ name, description } as any).eq("id", editing.id)) as any;
        await (supabase.from("simulado_questions" as any).delete().eq("simulado_id", editing.id)) as any;
      } else {
        const { data, error } = await (supabase.from("simulados" as any).insert({ name, description } as any).select("id").single()) as any;
        if (error) throw error;
        simId = data.id;
      }
      const ids = Array.from(selectedIds);
      const rows = ids.map((qid, i) => ({ simulado_id: simId, question_id: qid, position: i }));
      const { error: e2 } = await (supabase.from("simulado_questions" as any).insert(rows as any)) as any;
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
    const { error } = await (supabase.from("simulados" as any).delete().eq("id", s.id)) as any;
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído."); load();
  };

  const filtered = allQuestions.filter((q) => {
    if (filterSubject !== "all" && q.subject_id !== filterSubject) return false;
    if (filterText && !q.statement.toLowerCase().includes(filterText.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold">Simulados Inéditos</h3>
        </div>
        <Button size="sm" onClick={openNew} className="bg-gradient-flame text-white stencil">
          <Plus className="w-4 h-4 mr-1" /> Novo simulado
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : simulados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum simulado cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {simulados.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-card border border-border rounded-xl p-3">
              <div>
                <p className="font-display font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground stencil">{s.q_count} questões</p>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Simulado" : "Cadastrar Simulado Inédito"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto pr-1">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Simulado 01" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Questões ({selectedIds.size} selecionadas)</Label>
              </div>
              <div className="flex gap-2">
                <select
                  className="border border-border rounded-md px-2 py-1 text-sm bg-background"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  <option value="all">Todas as matérias</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Input placeholder="Buscar enunciado..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="flex-1" />
              </div>

              <div className="border border-border rounded-md max-h-[40vh] overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma questão encontrada.</p>
                ) : filtered.map((q) => (
                  <label key={q.id} className="flex items-start gap-2 p-2 border-b border-border hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selectedIds.has(q.id)} onCheckedChange={() => toggle(q.id)} className="mt-1" />
                    <div className="flex-1 text-sm">
                      <p className="line-clamp-2">{q.statement}</p>
                      <p className="text-[10px] stencil text-muted-foreground mt-0.5">
                        {subjectMap[q.subject_id] ?? "?"} {q.year ? `· ${q.year}` : ""}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
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
