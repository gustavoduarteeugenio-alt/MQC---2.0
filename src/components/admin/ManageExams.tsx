import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronDown, ChevronRight, GraduationCap, Loader2, Pencil, Plus, Trash2, ArrowUp, ArrowDown, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import { slugify, uniqueSlug } from "@/lib/slug";

type Institution = { id: string; name: string; sigla: string; slug: string };
type Contest = { id: string; institution_id: string; name: string; slug: string };
type Exam = {
  id: string; contest_id: string; name: string; slug: string;
  year: number | null; duration_minutes: number; is_published: boolean; edital_ref: string | null;
};
type Node = {
  id: string; exam_id: string; parent_id: string | null; name: string; slug: string;
  level: number; display_order: number; weight: number | null;
};

const NIVEL = ["", "Disciplina", "Tópico", "Subtópico"];

export const ManageExams = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState<string>("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [novoEdital, setNovoEdital] = useState(false);

  const exam = exams.find((e) => e.id === examId) ?? null;

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: inst }, { data: cont }, { data: ex }] = await Promise.all([
      (supabase as any).from("institutions").select("*").order("sigla"),
      (supabase as any).from("contests").select("*").order("name"),
      (supabase as any).from("exams").select("*").order("year", { ascending: false }),
    ]);
    setInstitutions((inst ?? []) as Institution[]);
    setContests((cont ?? []) as Contest[]);
    const lista = (ex ?? []) as Exam[];
    setExams(lista);
    setExamId((atual) => atual || lista[0]?.id || "");
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const carregarNos = useCallback(async () => {
    if (!examId) { setNodes([]); return; }
    const { data } = await (supabase as any)
      .from("content_nodes").select("*").eq("exam_id", examId).order("level").order("display_order");
    setNodes((data ?? []) as Node[]);
  }, [examId]);

  useEffect(() => { carregarNos(); }, [carregarNos]);

  const rotuloEdital = (e: Exam) => {
    const c = contests.find((x) => x.id === e.contest_id);
    const i = institutions.find((x) => x.id === c?.institution_id);
    return `${i?.sigla ?? "?"} · ${e.name}`;
  };

  const filhos = (parentId: string | null) =>
    nodes.filter((n) => n.parent_id === parentId).sort((a, b) => a.display_order - b.display_order);

  /** Ids do nó e de toda a sua descendência: apagar o pai leva os filhos (ON DELETE CASCADE). */
  const subarvore = useCallback((rootId: string): string[] => {
    const out = [rootId];
    const desce = (pai: string) => {
      for (const filho of nodes.filter((n) => n.parent_id === pai)) { out.push(filho.id); desce(filho.id); }
    };
    desce(rootId);
    return out;
  }, [nodes]);

  /**
   * Quantas questões ficam sem classificação se este nó for removido.
   * Conta a subárvore inteira, não só o nó: a questão é classificada na folha,
   * então apagar a disciplina desclassificaria tudo abaixo dela sem aviso.
   */
  const questoesNaSubarvore = async (nodeId: string) => {
    const { count } = await (supabase as any)
      .from("exam_questions")
      .select("id", { count: "exact", head: true })
      .in("content_node_id", subarvore(nodeId));
    return count ?? 0;
  };

  const adicionar = async (parent: Node | null) => {
    const nome = window.prompt(parent ? `Novo item dentro de "${parent.name}"` : "Nova disciplina");
    if (!nome?.trim()) return;
    const nivel = parent ? parent.level + 1 : 1;
    if (nivel > 3) { toast.error("A árvore vai até subtópico (3 níveis)."); return; }
    const irmaos = filhos(parent?.id ?? null);
    const { error } = await (supabase as any).from("content_nodes").insert({
      exam_id: examId,
      parent_id: parent?.id ?? null,
      name: nome.trim(),
      slug: uniqueSlug(nome, irmaos.map((n) => n.slug)),
      level: nivel,
      display_order: (irmaos.at(-1)?.display_order ?? 0) + 1,
    });
    if (error) { toast.error(error.message); return; }
    if (parent) setAberto((s) => new Set(s).add(parent.id));
    carregarNos();
  };

  const salvarNome = async (node: Node) => {
    const nome = rascunho.trim();
    setEditando(null);
    if (!nome || nome === node.name) return;
    const irmaos = filhos(node.parent_id).filter((n) => n.id !== node.id);
    const { error } = await (supabase as any).from("content_nodes")
      .update({ name: nome, slug: uniqueSlug(nome, irmaos.map((n) => n.slug)) }).eq("id", node.id);
    if (error) { toast.error(error.message); return; }
    carregarNos();
  };

  const salvarPeso = async (node: Node, valor: string) => {
    const peso = valor === "" ? null : Number(valor);
    if (peso !== null && (isNaN(peso) || peso < 0 || peso > 200)) { toast.error("Peso inválido."); return; }
    const { error } = await (supabase as any).from("content_nodes").update({ weight: peso }).eq("id", node.id);
    if (error) { toast.error(error.message); return; }
    carregarNos();
  };

  const mover = async (node: Node, direcao: -1 | 1) => {
    const irmaos = filhos(node.parent_id);
    const i = irmaos.findIndex((n) => n.id === node.id);
    const vizinho = irmaos[i + direcao];
    if (!vizinho) return;
    await Promise.all([
      (supabase as any).from("content_nodes").update({ display_order: vizinho.display_order }).eq("id", node.id),
      (supabase as any).from("content_nodes").update({ display_order: node.display_order }).eq("id", vizinho.id),
    ]);
    carregarNos();
  };

  const remover = async (node: Node) => {
    const descendentes = subarvore(node.id).length - 1;
    const questoes = await questoesNaSubarvore(node.id);

    const oQue = descendentes > 0
      ? `"${node.name}" e seus ${descendentes} itens`
      : `"${node.name}"`;
    const aviso = questoes > 0
      ? `Remover ${oQue}?\n\n${questoes} questão(ões) classificada(s) aqui vão ficar SEM CLASSIFICAÇÃO. ` +
        `As questões não são apagadas, mas alguém terá que reclassificar cada uma na árvore.`
      : `Remover ${oQue}?`;
    if (!confirm(aviso)) return;
    const { error } = await (supabase as any).from("content_nodes").delete().eq("id", node.id);
    if (error) { toast.error(error.message); return; }
    carregarNos();
  };

  const pesoTotal = filhos(null).reduce((soma, d) => soma + (d.weight ?? 0), 0);

  const linhaProps = {
    filhos,
    aberto,
    onToggle: (id: string) =>
      setAberto((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }),
    editando,
    rascunho,
    setRascunho,
    onEditar: (node: Node) => { setEditando(node.id); setRascunho(node.name); },
    onCancelar: () => setEditando(null),
    salvarNome,
    salvarPeso,
    mover,
    adicionar,
    remover,
  };

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <h2 className="font-display font-bold">Editais ({exams.length})</h2>
          </div>
          <Button size="sm" onClick={() => setNovoEdital(true)} className="bg-gradient-flame text-white stencil text-[11px]">
            <Plus className="w-3.5 h-3.5 mr-1" /> Novo edital
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : exams.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum edital cadastrado.</p>
        ) : (
          <Select value={examId} onValueChange={setExamId}>
            <SelectTrigger><SelectValue placeholder="Selecione o edital" /></SelectTrigger>
            <SelectContent>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {rotuloEdital(e)}{e.is_published ? "" : " · rascunho"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {exam && (
          <p className="text-[11px] text-muted-foreground">
            {exam.edital_ref ? `${exam.edital_ref} · ` : ""}{exam.duration_minutes} min de prova ·{" "}
            {pesoTotal > 0 ? `${pesoTotal} questões somadas nas disciplinas` : "pesos não informados"}
          </p>
        )}
      </div>

      {exam && (
        <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-bold text-sm">Conteúdo do edital</h3>
            <Button size="sm" variant="outline" onClick={() => adicionar(null)} className="stencil text-[11px]">
              <Plus className="w-3.5 h-3.5 mr-1" /> Disciplina
            </Button>
          </div>

          {filhos(null).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma disciplina ainda. Comece cadastrando as disciplinas do edital.
            </p>
          ) : (
            <ul className="space-y-2">
              {filhos(null).map((n) => <NodeRow key={n.id} node={n} {...linhaProps} />)}
            </ul>
          )}
        </div>
      )}

      <NovoEditalDialog
        open={novoEdital}
        onOpenChange={setNovoEdital}
        institutions={institutions}
        contests={contests}
        onCreated={async (id) => { await carregar(); setExamId(id); }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Fora do componente de propósito: definida dentro, a cada render vira um tipo
// novo, o React remonta a subárvore e o campo de renomear perde o foco.

type LinhaProps = {
  node: Node;
  filhos: (parentId: string | null) => Node[];
  aberto: Set<string>;
  onToggle: (id: string) => void;
  editando: string | null;
  rascunho: string;
  setRascunho: (v: string) => void;
  onEditar: (node: Node) => void;
  onCancelar: () => void;
  salvarNome: (node: Node) => void;
  salvarPeso: (node: Node, valor: string) => void;
  mover: (node: Node, direcao: -1 | 1) => void;
  adicionar: (parent: Node | null) => void;
  remover: (node: Node) => void;
};

const NodeRow = (props: LinhaProps) => {
  const {
    node, filhos, aberto, onToggle, editando, rascunho, setRascunho,
    onEditar, onCancelar, salvarNome, salvarPeso, mover, adicionar, remover,
  } = props;
  const sub = filhos(node.id);
  const expandido = aberto.has(node.id);

  return (
    <li>
        <div
          className={`flex items-center gap-2 rounded-xl border p-2.5 ${
            node.level === 1 ? "border-border bg-card" : "border-transparent bg-muted/40"
          }`}
        >
          <button
            onClick={() => onToggle(node.id)}
            className={`shrink-0 text-muted-foreground ${sub.length === 0 ? "invisible" : ""}`}
            aria-label={expandido ? "Recolher" : "Expandir"}
          >
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {editando === node.id ? (
            <>
              <Input value={rascunho} onChange={(e) => setRascunho(e.target.value)} className="h-8 flex-1"
                autoFocus onKeyDown={(e) => { if (e.key === "Enter") salvarNome(node); if (e.key === "Escape") onCancelar(); }} />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => salvarNome(node)}><Check className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancelar}><X className="w-4 h-4" /></Button>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <p className={`truncate ${node.level === 1 ? "font-display font-semibold text-sm" : "text-sm"}`}>{node.name}</p>
                <p className="stencil text-[9px] text-muted-foreground">{NIVEL[node.level]} · {sub.length} {sub.length === 1 ? "item" : "itens"}</p>
              </div>

              {node.level === 1 && (
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    defaultValue={node.weight ?? ""}
                    onBlur={(e) => e.target.value !== String(node.weight ?? "") && salvarPeso(node, e.target.value)}
                    className="h-8 w-14 text-center"
                    title="Questões desta disciplina na prova oficial"
                  />
                  <span className="stencil text-[9px] text-muted-foreground">na prova</span>
                </div>
              )}

              <div className="flex items-center shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mover(node, -1)} aria-label="Subir"><ArrowUp className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mover(node, 1)} aria-label="Descer"><ArrowDown className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEditar(node)} aria-label="Renomear"><Pencil className="w-3.5 h-3.5" /></Button>
                {node.level < 3 && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => adicionar(node)} aria-label="Adicionar dentro"><Plus className="w-3.5 h-3.5" /></Button>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remover(node)} aria-label="Remover"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </>
          )}
        </div>

        {expandido && sub.length > 0 && (
          <ul className="ml-5 mt-1.5 space-y-1.5 border-l border-border pl-3">
            {sub.map((n) => <NodeRow key={n.id} {...props} node={n} />)}
          </ul>
        )}
      </li>
    );
  };


// ---------------------------------------------------------------------------

const NovoEditalDialog = ({
  open, onOpenChange, institutions, contests, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  institutions: Institution[];
  contests: Contest[];
  onCreated: (examId: string) => void;
}) => {
  const [institutionId, setInstitutionId] = useState("");
  const [novaInstituicao, setNovaInstituicao] = useState({ name: "", sigla: "" });
  const [contestId, setContestId] = useState("");
  const [novoConcurso, setNovoConcurso] = useState("");
  const [form, setForm] = useState({ name: "", year: "", duration: "240", edital_ref: "" });
  const [salvando, setSalvando] = useState(false);

  const criandoInstituicao = institutionId === "+nova";
  const criandoConcurso = contestId === "+novo";
  const concursosDaInstituicao = contests.filter((c) => c.institution_id === institutionId);

  const salvar = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome do edital."); return; }
    setSalvando(true);
    try {
      let instId = institutionId;
      if (criandoInstituicao) {
        const { name, sigla } = novaInstituicao;
        if (!name.trim() || !sigla.trim()) { toast.error("Informe nome e sigla da instituição."); return; }
        const { data, error } = await (supabase as any).from("institutions")
          .insert({ name: name.trim(), sigla: sigla.trim().toUpperCase(), slug: slugify(sigla) })
          .select("id").single();
        if (error) throw error;
        instId = data.id;
      }
      if (!instId) { toast.error("Selecione a instituição."); return; }

      let ctId = contestId;
      if (criandoConcurso || !ctId) {
        const nome = novoConcurso.trim() || "Curso de Formação de Soldados";
        const { data, error } = await (supabase as any).from("contests")
          .insert({ institution_id: instId, name: nome, slug: slugify(nome) })
          .select("id").single();
        if (error) throw error;
        ctId = data.id;
      }

      const ano = form.year ? Number(form.year) : null;
      const { data: exam, error } = await (supabase as any).from("exams").insert({
        contest_id: ctId,
        name: form.name.trim(),
        slug: slugify(`${novaInstituicao.sigla || institutions.find((i) => i.id === instId)?.sigla || ""}-${form.name}`),
        year: ano,
        duration_minutes: Number(form.duration) || 240,
        edital_ref: form.edital_ref.trim() || null,
        is_published: false,
      }).select("id").single();
      if (error) throw error;

      toast.success("Edital criado. Cadastre as disciplinas para começar.");
      onOpenChange(false);
      setForm({ name: "", year: "", duration: "240", edital_ref: "" });
      onCreated(exam.id);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao criar o edital.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo edital</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="stencil text-[10px]">Instituição</Label>
            <Select value={institutionId} onValueChange={(v) => { setInstitutionId(v); setContestId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.sigla} — {i.name}</SelectItem>)}
                <SelectItem value="+nova">+ Nova instituição</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {criandoInstituicao && (
            <div className="grid grid-cols-3 gap-2">
              <Input className="col-span-2" placeholder="Nome da instituição"
                value={novaInstituicao.name} onChange={(e) => setNovaInstituicao((s) => ({ ...s, name: e.target.value }))} />
              <Input placeholder="Sigla" value={novaInstituicao.sigla}
                onChange={(e) => setNovaInstituicao((s) => ({ ...s, sigla: e.target.value }))} />
            </div>
          )}

          {!criandoInstituicao && institutionId && (
            <div>
              <Label className="stencil text-[10px]">Concurso</Label>
              <Select value={contestId} onValueChange={setContestId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {concursosDaInstituicao.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  <SelectItem value="+novo">+ Novo concurso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(criandoConcurso || criandoInstituicao) && (
            <Input placeholder="Nome do concurso (ex.: Curso de Formação de Soldados)"
              value={novoConcurso} onChange={(e) => setNovoConcurso(e.target.value)} />
          )}

          <div>
            <Label className="stencil text-[10px]">Nome do edital</Label>
            <Input placeholder="Ex.: CFSd BM 2027" value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="stencil text-[10px]">Ano</Label>
              <Input placeholder="2027" value={form.year} onChange={(e) => setForm((s) => ({ ...s, year: e.target.value }))} />
            </div>
            <div>
              <Label className="stencil text-[10px]">Duração (min)</Label>
              <Input value={form.duration} onChange={(e) => setForm((s) => ({ ...s, duration: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label className="stencil text-[10px]">Referência do edital</Label>
            <Input placeholder="Ex.: Edital nº 10/2026" value={form.edital_ref}
              onChange={(e) => setForm((s) => ({ ...s, edital_ref: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={salvando} className="bg-gradient-flame text-white stencil">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar edital"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
