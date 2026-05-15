import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { RichText } from "@/components/RichText";

type Subject = { id: string; name: string; slug: string };

type QRow = {
  id: string;
  subject_id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string | null;
  correct_answer: string;
  explanation: string;
  difficulty: string;
  year: number | null;
  banca: string;
  subtopic: string | null;
  image_url: string | null;
  comment_image_url: string | null;
};

const emptyForm = (subject_id = "") => ({
  subject_id,
  statement: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  option_e: "",
  correct_answer: "A",
  explanation: "",
  difficulty: "medium",
  year: "" as string | number,
  banca: "IDECAN",
  subtopic: "",
  image_url: "" as string,
  comment_image_url: "" as string,
});

type FormState = ReturnType<typeof emptyForm>;

interface Props {
  subjects: Subject[];
  onChanged?: () => void;
}

export const ManageQuestions = ({ subjects, onChanged }: Props) => {
  const [activeSubject, setActiveSubject] = useState<string>("");
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeSubject && subjects.length) setActiveSubject(subjects[0].id);
  }, [subjects, activeSubject]);

  const reload = async (subjectId: string) => {
    if (!subjectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("questions")
      .select("id, subject_id, statement, option_a, option_b, option_c, option_d, option_e, correct_answer, explanation, difficulty, year, banca, subtopic, image_url, comment_image_url")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setQuestions((data ?? []) as QRow[]);
    setLoading(false);
  };

  useEffect(() => { reload(activeSubject); }, [activeSubject]);

  const openNew = (subjectId: string) => {
    setEditingId(null);
    setForm(emptyForm(subjectId));
    setOpen(true);
  };

  const openEdit = (q: QRow) => {
    setEditingId(q.id);
    setForm({
      subject_id: q.subject_id,
      statement: q.statement,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      option_e: q.option_e ?? "",
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      year: q.year ?? "",
      banca: q.banca ?? "IDECAN",
      subtopic: q.subtopic ?? "",
      image_url: q.image_url ?? "",
      comment_image_url: q.comment_image_url ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.subject_id || !form.statement.trim() || !form.option_a.trim() || !form.option_b.trim() || !form.explanation.trim()) {
      toast.error("Preencha matéria, enunciado, alternativas A/B e gabarito comentado.");
      return;
    }
    if (!form.banca.trim()) {
      toast.error("Informe a banca (padrão IDECAN).");
      return;
    }
    const yearNum = form.year === "" || form.year === null ? null : Number(form.year);
    if (yearNum !== null && (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100)) {
      toast.error("Ano inválido.");
      return;
    }
    setSaving(true);
    const payload = {
      subject_id: form.subject_id,
      statement: form.statement.trim(),
      option_a: form.option_a.trim(),
      option_b: form.option_b.trim(),
      option_c: form.option_c.trim(),
      option_d: form.option_d.trim(),
      option_e: form.option_e.trim() || null,
      correct_answer: form.correct_answer,
      explanation: form.explanation.trim(),
      difficulty: form.difficulty,
      year: yearNum,
      banca: form.banca.trim(),
      subtopic: form.subtopic.trim() || null,
      image_url: form.image_url?.trim() || null,
      comment_image_url: form.comment_image_url?.trim() || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("questions").update(payload as any).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("questions").insert(payload as any));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Questão atualizada." : "Questão cadastrada.");
    setOpen(false);
    reload(activeSubject);
    onChanged?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta questão?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Questão removida.");
    reload(activeSubject);
    onChanged?.();
  };

  const letters = ["A", "B", "C", "D", "E"] as const;

  return (
    <div className="space-y-3">
      <Tabs value={activeSubject} onValueChange={setActiveSubject}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-max gap-1">
            {subjects.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="text-xs whitespace-nowrap">
                {s.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {subjects.map((s) => (
          <TabsContent key={s.id} value={s.id} className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-sm">
                {s.name}{" "}
                <span className="text-muted-foreground font-normal">({questions.length})</span>
              </h3>
              <Button size="sm" onClick={() => openNew(s.id)} className="bg-gradient-flame text-white stencil">
                <Plus className="w-4 h-4 mr-1" /> Nova questão
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : questions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma questão cadastrada nesta disciplina.
              </p>
            ) : (
              <div className="space-y-2">
                {questions.map((q) => (
                  <div key={q.id} className="bg-card border border-border rounded-xl p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <RichText content={q.statement} className="text-sm line-clamp-2" />
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[10px] stencil bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                          Gab. {q.correct_answer}
                        </span>
                        <span className="text-[10px] stencil bg-muted px-1.5 py-0.5 rounded">
                          {q.banca}
                        </span>
                        {q.year && (
                          <span className="text-[10px] stencil bg-muted px-1.5 py-0.5 rounded">
                            {q.year}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => openEdit(q)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(q.id)}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                        aria-label="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar questão" : "Nova questão"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="stencil text-[10px]">Matéria</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="stencil text-[10px]">Banca *</Label>
                <Input value={form.banca} onChange={(e) => setForm({ ...form, banca: e.target.value })} placeholder="IDECAN" />
              </div>
              <div>
                <Label className="stencil text-[10px]">Ano</Label>
                <Input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  placeholder="2024"
                  min={1900}
                  max={2100}
                />
              </div>
            </div>

            <div>
              <Label className="stencil text-[10px]">Subtema (opcional)</Label>
              <Input
                value={form.subtopic}
                onChange={(e) => setForm({ ...form, subtopic: e.target.value })}
                placeholder="Ex.: Física, Química, História de MG, Legislação"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Apenas para organização interna — não é exibido para o aluno.
              </p>
            </div>
            <div>
              <Label className="stencil text-[10px]">Enunciado</Label>
              <Textarea
                value={form.statement}
                onChange={(e) => setForm({ ...form, statement: e.target.value })}
                rows={4}
              />
            </div>

            <ImageUploader
              label="Imagem do enunciado (opcional)"
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url ?? "" })}
            />

            {letters.map((l) => {
              const key = `option_${l.toLowerCase()}` as keyof FormState;
              return (
                <div key={l}>
                  <Label className="stencil text-[10px]">
                    Alternativa {l} {l === "E" && <span className="text-muted-foreground">(opcional)</span>}
                  </Label>
                  <Input
                    value={(form as any)[key] ?? ""}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value } as FormState)}
                  />
                </div>
              );
            })}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="stencil text-[10px]">Gabarito</Label>
                <Select value={form.correct_answer} onValueChange={(v) => setForm({ ...form, correct_answer: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {letters.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
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
            </div>

            <div>
              <Label className="stencil text-[10px]">Comentário do professor</Label>
              <Textarea
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                rows={3}
              />
            </div>

            <ImageUploader
              label="Imagem do comentário (opcional)"
              value={form.comment_image_url}
              onChange={(url) => setForm({ ...form, comment_image_url: url ?? "" })}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-flame text-white stencil">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "Salvar alterações" : "Cadastrar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
