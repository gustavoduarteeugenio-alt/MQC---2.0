import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Search, Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { RichText } from "@/components/RichText";
import { ANSWER_LETTERS, validateAnswer } from "@/lib/questions";
import { ContentNode, subtreeIds } from "@/lib/exams";

type Exam = { id: string; name: string; slug: string; contest_id: string };
type QRow = {
  id: string;
  statement: string;
  option_a: string; option_b: string; option_c: string; option_d: string; option_e: string | null;
  correct_answer: string;
  explanation: string;
  difficulty: string;
  year: number | null;
  banca: string;
  image_url: string | null;
  comment_image_url: string | null;
  content_node_id: string | null;
  content_node_name: string | null;
  status: "draft" | "published";
};

const emptyForm = (content_node_id = "") => ({
  content_node_id,
  statement: "",
  option_a: "", option_b: "", option_c: "", option_d: "", option_e: "",
  correct_answer: "A",
  explanation: "",
  difficulty: "medium",
  year: "" as string | number,
  banca: "IDECAN",
  status: "draft" as "draft" | "published",
  image_url: "",
  comment_image_url: "",
});
type FormState = ReturnType<typeof emptyForm>;

/** Nome com o caminho na árvore: "Ciências Naturais › Química › Reações". */
const caminho = (nodes: ContentNode[], id: string | null): string => {
  const partes: string[] = [];
  let atual = nodes.find((n) => n.id === id) ?? null;
  while (atual) {
    partes.unshift(atual.name);
    atual = atual.parent_id ? nodes.find((n) => n.id === atual!.parent_id) ?? null : null;
  }
  return partes.join(" › ");
};

export const ManageQuestions = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [filtroNo, setFiltroNo] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [contagem, setContagem] = useState<Record<string, { publicadas: number; rascunhos: number }>>({});
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("exams").select("id, name, slug, contest_id").order("year", { ascending: false });
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
      setFiltroNo("todos");
    })();
  }, [examId]);

  const reload = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    // "sem-no" são as questões que perderam a classificação, normalmente porque
    // alguém removeu um item da árvore. Não há filtro para isso no banco, então
    // varremos o edital e separamos aqui.
    const semNo = filtroNo === "sem-no";
    const nodeIds = filtroNo === "todos" || semNo ? null : subtreeIds(nodes, filtroNo);
    const [{ data, error }, { data: counts }] = await Promise.all([
      (supabase as any).rpc("admin_list_exam_questions", {
        _exam_id: examId,
        _node_ids: nodeIds,
        _search: busca.trim() || null,
        _limit: semNo ? 2000 : 200,
      }),
      (supabase as any).rpc("admin_count_questions_by_node", { _exam_id: examId }),
    ]);
    if (error) toast.error(error.message);
    const lista = (data ?? []) as QRow[];
    setQuestions(semNo ? lista.filter((q) => !q.content_node_id) : lista);
    const mapa: Record<string, { publicadas: number; rascunhos: number }> = {};
    for (const c of (counts ?? []) as any[]) {
      mapa[c.content_node_id] = { publicadas: Number(c.publicadas), rascunhos: Number(c.rascunhos) };
    }
    setContagem(mapa);
    setLoading(false);
  }, [examId, filtroNo, busca, nodes]);

  useEffect(() => { reload(); }, [reload]);

  const opcoesDeNo = useMemo(
    () =>
      [...nodes]
        .sort((a, b) => caminho(nodes, a.id).localeCompare(caminho(nodes, b.id)))
        .map((n) => ({ id: n.id, label: caminho(nodes, n.id), level: n.level })),
    [nodes],
  );

  const totalNoEdital = useMemo(
    () => Object.values(contagem).reduce((s, c) => s + c.publicadas + c.rascunhos, 0),
    [contagem],
  );

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm(filtroNo !== "todos" ? filtroNo : ""));
    setOpen(true);
  };

  const openEdit = (q: QRow) => {
    setEditingId(q.id);
    setForm({
      content_node_id: q.content_node_id ?? "",
      statement: q.statement,
      option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
      option_e: q.option_e ?? "",
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      year: q.year ?? "",
      banca: q.banca ?? "IDECAN",
      status: q.status,
      image_url: q.image_url ?? "",
      comment_image_url: q.comment_image_url ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.content_node_id) { toast.error("Classifique a questão no conteúdo do edital."); return; }
    if (!form.statement.trim() || !form.option_a.trim() || !form.option_b.trim() || !form.explanation.trim()) {
      toast.error("Preencha enunciado, alternativas A/B e gabarito comentado.");
      return;
    }
    const erroGabarito = validateAnswer(form.correct_answer, {
      a: form.option_a, b: form.option_b, c: form.option_c, d: form.option_d, e: form.option_e,
    });
    if (erroGabarito) { toast.error(erroGabarito); return; }
    const yearNum = form.year === "" ? null : Number(form.year);
    if (yearNum !== null && (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100)) {
      toast.error("Ano inválido."); return;
    }

    setSaving(true);
    try {
      const payload = {
        statement: form.statement.trim(),
        option_a: form.option_a.trim(), option_b: form.option_b.trim(),
        option_c: form.option_c.trim(), option_d: form.option_d.trim(),
        option_e: form.option_e.trim() || null,
        correct_answer: form.correct_answer,
        explanation: form.explanation.trim(),
        difficulty: form.difficulty,
        year: yearNum,
        banca: form.banca.trim() || "IDECAN",
        image_url: form.image_url.trim() || null,
        comment_image_url: form.comment_image_url.trim() || null,
      };

      if (editingId) {
        const { error } = await (supabase as any).from("questions").update(payload).eq("id", editingId);
        if (error) throw error;
        const { error: e2 } = await (supabase as any).from("exam_questions")
          .update({ content_node_id: form.content_node_id, status: form.status })
          .eq("exam_id", examId).eq("question_id", editingId);
        if (e2) throw e2;
      } else {
        const { data: nova, error } = await (supabase as any)
          .from("questions").insert(payload).select("id").single();
        if (error) throw error;
        const { error: e2 } = await (supabase as any).from("exam_questions").insert({
          exam_id: examId,
          question_id: nova.id,
          content_node_id: form.content_node_id,
          status: form.status,
        });
        if (e2) throw e2;
      }

      toast.success(editingId ? "Questão atualizada." : "Questão cadastrada.");
      setOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const alternarStatus = async (q: QRow) => {
    const novo = q.status === "published" ? "draft" : "published";
    const { error } = await (supabase as any).from("exam_questions")
      .update({ status: novo }).eq("exam_id", examId).eq("question_id", q.id);
    if (error) { toast.error(error.message); return; }
    toast.success(novo === "published" ? "Questão publicada." : "Questão voltou para rascunho.");
    reload();
  };

  /** Duplica a questão para outro edital, criando um registro independente. */
  const duplicarPara = async (q: QRow, destinoExamId: string) => {
    const { data: completa, error: e0 } = await (supabase as any)
      .rpc("admin_list_exam_questions", { _exam_id: examId, _node_ids: null, _search: null, _limit: 1000 });
    if (e0) { toast.error(e0.message); return; }
    const origem = ((completa ?? []) as QRow[]).find((x) => x.id === q.id);
    if (!origem) { toast.error("Questão não encontrada."); return; }

    const { data: nova, error } = await (supabase as any).from("questions").insert({
      statement: origem.statement,
      option_a: origem.option_a, option_b: origem.option_b, option_c: origem.option_c,
      option_d: origem.option_d, option_e: origem.option_e,
      correct_answer: origem.correct_answer, explanation: origem.explanation,
      difficulty: origem.difficulty, year: origem.year, banca: origem.banca,
      image_url: origem.image_url, comment_image_url: origem.comment_image_url,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }

    const { error: e2 } = await (supabase as any).from("exam_questions").insert({
      exam_id: destinoExamId, question_id: nova.id, content_node_id: null, status: "draft",
    });
    if (e2) { toast.error(e2.message); return; }
    toast.success("Cópia criada como rascunho no outro edital. Classifique-a por lá.");
  };

  const remove = async (q: QRow) => {
    if (!confirm("Remover esta questão deste edital? A questão em si é apagada se não estiver em outro edital.")) return;
    const { error } = await (supabase as any).from("exam_questions")
      .delete().eq("exam_id", examId).eq("question_id", q.id);
    if (error) { toast.error(error.message); return; }
    // Se não sobrou vínculo nenhum, a questão não serve a ninguém
    const { count } = await (supabase as any)
      .from("exam_questions").select("id", { count: "exact", head: true }).eq("question_id", q.id);
    if ((count ?? 0) === 0) await (supabase as any).from("questions").delete().eq("id", q.id);
    toast.success("Questão removida.");
    reload();
  };

  const examAtual = exams.find((e) => e.id === examId);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-display font-bold">
            Questões{" "}
            <span className="text-muted-foreground font-normal text-sm">
              ({totalNoEdital} no edital)
            </span>
          </h2>
          <Button size="sm" onClick={openNew} disabled={!examId || nodes.length === 0}
            className="bg-gradient-flame text-white stencil text-[11px]">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nova questão
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={examId} onValueChange={setExamId}>
            <SelectTrigger><SelectValue placeholder="Edital" /></SelectTrigger>
            <SelectContent>
              {exams.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filtroNo} onValueChange={setFiltroNo}>
            <SelectTrigger><SelectValue placeholder="Todo o conteúdo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo o conteúdo</SelectItem>
              <SelectItem value="sem-no">Sem classificação</SelectItem>
              {opcoesDeNo.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                  {contagem[o.id] ? ` (${contagem[o.id].publicadas + contagem[o.id].rascunhos})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no enunciado…" className="pl-9" />
        </div>

        {nodes.length === 0 && examId && (
          <p className="text-[11px] text-warning-foreground bg-warning/15 rounded-lg px-3 py-2">
            Este edital ainda não tem conteúdo cadastrado. Vá em <strong>Editais</strong> e monte a árvore antes de cadastrar questões.
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : questions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {filtroNo === "sem-no"
            ? "Nenhuma questão sem classificação — a árvore está em ordem."
            : `Nenhuma questão ${filtroNo === "todos" ? "neste edital" : "neste conteúdo"} ainda.`}
        </p>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="bg-card border border-border rounded-xl p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <RichText content={q.statement} className="text-sm line-clamp-2" />
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className={`text-[10px] stencil px-1.5 py-0.5 rounded ${
                    q.status === "published" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {q.status === "published" ? "Publicada" : "Rascunho"}
                  </span>
                  <span className="text-[10px] stencil bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                    Gab. {q.correct_answer}
                  </span>
                  {q.content_node_name && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">
                      {q.content_node_name}
                    </span>
                  )}
                  <span className="text-[10px] stencil bg-muted px-1.5 py-0.5 rounded">{q.banca}</span>
                  {q.year && <span className="text-[10px] stencil bg-muted px-1.5 py-0.5 rounded">{q.year}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => alternarStatus(q)} className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                  aria-label={q.status === "published" ? "Voltar para rascunho" : "Publicar"}>
                  {q.status === "published" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(q)} className="p-2 text-primary hover:bg-primary/10 rounded-lg" aria-label="Editar">
                  <Pencil className="w-4 h-4" />
                </button>
                {exams.length > 1 && (
                  <button
                    onClick={() => {
                      const outro = exams.find((e) => e.id !== examId);
                      if (outro && confirm(`Duplicar esta questão para "${outro.name}"?`)) duplicarPara(q, outro.id);
                    }}
                    className="p-2 text-muted-foreground hover:bg-muted rounded-lg"
                    aria-label="Duplicar para outro edital"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => remove(q)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg" aria-label="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar questão" : "Nova questão"}
              {examAtual ? ` · ${examAtual.name}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="stencil text-[10px]">Conteúdo do edital</Label>
              <Select value={form.content_node_id} onValueChange={(v) => setForm({ ...form, content_node_id: v })}>
                <SelectTrigger><SelectValue placeholder="Classifique na árvore" /></SelectTrigger>
                <SelectContent>
                  {opcoesDeNo.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="stencil text-[10px]">Enunciado</Label>
              <Textarea rows={4} value={form.statement} onChange={(e) => setForm({ ...form, statement: e.target.value })} />
              <ImageUploader value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} label="Imagem do enunciado" />
            </div>

            {(["a", "b", "c", "d", "e"] as const).map((letra) => (
              <div key={letra}>
                <Label className="stencil text-[10px]">
                  Alternativa {letra.toUpperCase()} {letra === "e" && <span className="text-muted-foreground">(opcional)</span>}
                </Label>
                <Input
                  value={(form as any)[`option_${letra}`]}
                  onChange={(e) => setForm({ ...form, [`option_${letra}`]: e.target.value } as FormState)}
                />
              </div>
            ))}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="stencil text-[10px]">Gabarito</Label>
                <Select value={form.correct_answer} onValueChange={(v) => setForm({ ...form, correct_answer: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANSWER_LETTERS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="stencil text-[10px]">Dificuldade</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Fácil</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="hard">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="stencil text-[10px]">Situação</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="stencil text-[10px]">Gabarito comentado</Label>
              <Textarea rows={4} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
              <ImageUploader value={form.comment_image_url} onChange={(url) => setForm({ ...form, comment_image_url: url })} label="Imagem do comentário" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="stencil text-[10px]">Banca</Label>
                <Input value={form.banca} onChange={(e) => setForm({ ...form, banca: e.target.value })} />
              </div>
              <div>
                <Label className="stencil text-[10px]">Ano</Label>
                <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={save} disabled={saving} className="bg-gradient-flame text-white stencil">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
