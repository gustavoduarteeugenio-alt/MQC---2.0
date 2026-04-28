import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { BulkImport } from "@/components/admin/BulkImport";
import { ManageAdmins } from "@/components/admin/ManageAdmins";

type Subject = { id: string; name: string; slug: string };
type QRow = { id: string; statement: string; subject_id: string; correct_answer: string };

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useProfile();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [list, setList] = useState<QRow[]>([]);
  const [form, setForm] = useState({
    subject_id: "", statement: "", option_a: "", option_b: "", option_c: "", option_d: "",
    correct_answer: "A", explanation: "", difficulty: "medium",
  });

  useEffect(() => { if (!loading && !isAdmin) navigate("/"); }, [isAdmin, loading, navigate]);

  const reload = async () => {
    const { data: subs } = await supabase.from("subjects").select("id, name, slug").order("display_order");
    const { data: qs } = await supabase.from("questions").select("id, statement, subject_id, correct_answer").order("created_at", { ascending: false }).limit(100);
    setSubjects((subs ?? []) as Subject[]);
    setList((qs ?? []) as QRow[]);
  };
  useEffect(() => { reload(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject_id || !form.statement || !form.option_a || !form.explanation) {
      toast.error("Preencha matéria, enunciado, alternativas e gabarito comentado.");
      return;
    }
    const { error } = await supabase.from("questions").insert(form as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Questão cadastrada.");
    setForm({ ...form, statement: "", option_a: "", option_b: "", option_c: "", option_d: "", explanation: "" });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta questão?")) return;
    await supabase.from("questions").delete().eq("id", id);
    reload();
  };

  return (
    <div className="app-shell pb-10">
      <header className="flex items-center gap-2 px-4 pt-12 pb-3 bg-gradient-night text-white">
        <button onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="stencil text-xs text-primary flex items-center gap-1"><Shield className="w-3 h-3" /> Admin</p>
          <h1 className="font-display text-xl font-bold">Cadastro de questões</h1>
        </div>
      </header>

      <main className="px-5 py-5 space-y-5">
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="bulk">Em lote</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-4">
            <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
              <div>
                <Label className="stencil text-[10px]">Matéria</Label>
                <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="stencil text-[10px]">Enunciado</Label>
                <Textarea value={form.statement} onChange={(e) => setForm({ ...form, statement: e.target.value })} rows={3} />
              </div>
              {(["a","b","c","d"] as const).map((l) => (
                <div key={l}>
                  <Label className="stencil text-[10px]">Alternativa {l.toUpperCase()}</Label>
                  <Input value={(form as any)[`option_${l}`]} onChange={(e) => setForm({ ...form, [`option_${l}`]: e.target.value } as any)} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="stencil text-[10px]">Gabarito</Label>
                  <Select value={form.correct_answer} onValueChange={(v) => setForm({ ...form, correct_answer: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["A","B","C","D"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
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
                <Label className="stencil text-[10px]">Gabarito comentado</Label>
                <Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={3} />
              </div>
              <Button type="submit" className="w-full bg-gradient-flame text-white stencil">
                <Plus className="w-4 h-4 mr-1" /> Cadastrar questão
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="bulk" className="mt-4">
            <BulkImport subjects={subjects} onImported={reload} />
          </TabsContent>

          <TabsContent value="admins" className="mt-4">
            <ManageAdmins />
          </TabsContent>
        </Tabs>

        <section>
          <h2 className="font-display font-bold mb-2">Últimas cadastradas ({list.length})</h2>
          <div className="space-y-2">
            {list.map((q) => (
              <div key={q.id} className="bg-card border border-border rounded-xl p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2">{q.statement}</p>
                  <p className="text-[10px] stencil text-muted-foreground mt-1">Gabarito: {q.correct_answer}</p>
                </div>
                <button onClick={() => remove(q.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

    </div>
  );
};

export default Admin;
