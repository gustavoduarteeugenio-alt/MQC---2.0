import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Link2, Loader2, Pencil, RefreshCw, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

// Que produto da Hotmart dá acesso a quais editais. Um produto pode cobrir
// mais de um: o Método Questão Certa é vendido como produto único, e o aluno
// escolhe dentro do app o edital que vai estudar.

type Exam = { id: string; name: string };
type Mapping = {
  product_id: string;
  label: string | null;
  exam_ids: string[];
  exam_names: string[];
  compras_ativas: number;
};
type Orphan = { product_id: string; compras: number; ultima_compra: string };

export const HotmartProducts = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  const [productId, setProductId] = useState("");
  const [label, setLabel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ex }, { data: maps, error }, { data: orf }] = await Promise.all([
      (supabase as any).from("exams").select("id, name").order("year", { ascending: false }),
      (supabase as any).rpc("admin_hotmart_products"),
      (supabase as any).rpc("admin_unmapped_hotmart_products"),
    ]);
    if (error) toast.error("Erro ao carregar mapeamentos: " + error.message);
    setExams((ex ?? []) as Exam[]);
    setMappings(((maps ?? []) as any[]).map((m) => ({
      ...m,
      exam_ids: m.exam_ids ?? [],
      exam_names: m.exam_names ?? [],
      compras_ativas: Number(m.compras_ativas ?? 0),
    })));
    setOrphans((orf ?? []) as Orphan[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const limpar = () => {
    setProductId(""); setLabel(""); setSelected(new Set()); setEditando(false);
  };

  const editar = (m: Mapping) => {
    setProductId(m.product_id);
    setLabel(m.label ?? "");
    setSelected(new Set(m.exam_ids));
    setEditando(true);
  };

  const preencherDoOrfao = (o: Orphan) => {
    setProductId(o.product_id);
    setLabel("");
    setSelected(new Set());
    setEditando(false);
  };

  const alternar = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const salvar = async () => {
    const pid = productId.trim();
    if (!pid) { toast.error("Informe o ID do produto na Hotmart."); return; }
    if (selected.size === 0) { toast.error("Marque ao menos um edital."); return; }
    setSaving(true);
    const { error } = await (supabase as any).rpc("admin_set_hotmart_product", {
      _product_id: pid,
      _label: label.trim() || null,
      _exam_ids: Array.from(selected),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Produto liberando ${selected.size} edital(is).`);
    limpar();
    load();
  };

  const remover = async (m: Mapping) => {
    if (!confirm(`Desvincular o produto ${m.product_id}?\n\nAs matrículas já criadas continuam ativas; compras novas deste produto deixam de matricular.`)) return;
    const { error } = await (supabase as any).from("hotmart_products").delete().eq("product_id", m.product_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Desvinculado.");
    if (productId === m.product_id) limpar();
    load();
  };

  // Vendas que entraram antes do mapeamento existir viram matrícula aqui.
  const resync = async () => {
    setResyncing(true);
    const { data, error } = await (supabase as any).rpc("resync_hotmart_enrollments");
    setResyncing(false);
    if (error) { toast.error(error.message); return; }
    const n = Number(data ?? 0);
    toast.success(n > 0 ? `${n} matrícula(s) atualizada(s).` : "Nenhuma matrícula precisava de ajuste.");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold">Produtos da Hotmart por edital</h3>
          </div>
          <Button size="sm" variant="outline" onClick={resync} disabled={resyncing} className="stencil text-[11px]">
            {resyncing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            Reprocessar matrículas
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Um produto pode liberar mais de um edital — quem compra é matriculado em todos eles e escolhe
          no app onde estudar. Compras de produtos não listados aqui liberam o app, mas não matriculam
          em nenhum concurso.
        </p>

        <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <div>
            <Label className="stencil text-[10px]">ID do produto</Label>
            <Input
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={editando}
              placeholder="Ex: 1234567"
              className="font-mono"
            />
          </div>
          <div>
            <Label className="stencil text-[10px]">Nome (opcional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Método Questão Certa" />
          </div>
        </div>

        <div>
          <Label className="stencil text-[10px]">Editais que este produto libera</Label>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
            {exams.map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/50">
                <Checkbox checked={selected.has(e.id)} onCheckedChange={() => alternar(e.id)} />
                <span className="truncate">{e.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={salvar} disabled={saving} className="bg-gradient-flame text-white stencil">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {editando ? "Salvar alterações" : "Vincular produto"}
          </Button>
          {(editando || productId || selected.size > 0) && (
            <Button variant="outline" onClick={limpar} className="stencil">
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {orphans.length > 0 && (
        <div className="bg-warning/10 border border-warning/40 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h4 className="font-display font-bold text-sm">Compras sem edital</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Estes produtos já venderam, mas não liberam nenhum edital. Clique para preencher o ID acima,
            marque os editais e depois use "Reprocessar matrículas" para matricular quem já comprou.
          </p>
          <ul className="space-y-1">
            {orphans.map((o) => (
              <li key={o.product_id}>
                <button
                  onClick={() => preencherDoOrfao(o)}
                  className="w-full flex items-center justify-between gap-2 text-xs rounded-lg px-2 py-1.5 hover:bg-warning/10 text-left"
                >
                  <span className="font-mono font-bold">{o.product_id}</span>
                  <span className="stencil text-muted-foreground">
                    {o.compras} compra(s) · última em {new Date(o.ultima_compra).toLocaleDateString("pt-BR")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-3 shadow-card">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum produto vinculado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {mappings.map((m) => (
              <li key={m.product_id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm truncate">
                    {m.label ? (
                      <>
                        {m.label}
                        <span className="ml-2 font-normal text-muted-foreground font-mono text-xs">{m.product_id}</span>
                      </>
                    ) : (
                      <span className="font-mono">{m.product_id}</span>
                    )}
                  </p>
                  <p className="stencil text-[10px] text-muted-foreground mt-0.5">
                    {m.exam_names.join(" · ")} · {m.compras_ativas} compra(s) ativa(s)
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => editar(m)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remover(m)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
