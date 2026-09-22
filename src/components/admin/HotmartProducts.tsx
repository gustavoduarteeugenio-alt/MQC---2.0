import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Link2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Que produto da Hotmart dá acesso a qual edital. Sem esta ligação a compra
// libera o app mas não matricula ninguém em concurso nenhum.

type Exam = { id: string; name: string };
type Mapping = { product_id: string; label: string | null; exam_id: string; exam_name: string; compras_ativas: number };
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
  const [examId, setExamId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ex }, { data: maps, error }, { data: orf }] = await Promise.all([
      (supabase as any).from("exams").select("id, name").order("year", { ascending: false }),
      (supabase as any).rpc("admin_hotmart_products"),
      (supabase as any).rpc("admin_unmapped_hotmart_products"),
    ]);
    if (error) toast.error("Erro ao carregar mapeamentos: " + error.message);
    setExams((ex ?? []) as Exam[]);
    setMappings((maps ?? []) as Mapping[]);
    setOrphans((orf ?? []) as Orphan[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const salvar = async () => {
    const pid = productId.trim();
    if (!pid) { toast.error("Informe o ID do produto na Hotmart."); return; }
    if (!examId) { toast.error("Escolha o edital."); return; }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("hotmart_products")
      .upsert({ product_id: pid, exam_id: examId, label: label.trim() || null }, { onConflict: "product_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Produto vinculado ao edital.");
    setProductId(""); setLabel("");
    load();
  };

  const remover = async (m: Mapping) => {
    if (!confirm(`Desvincular o produto ${m.product_id} de ${m.exam_name}?\n\nAs matrículas já criadas continuam; compras novas deste produto deixam de matricular.`)) return;
    const { error } = await (supabase as any).from("hotmart_products").delete().eq("product_id", m.product_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Desvinculado.");
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
          O ID do produto está na Hotmart, na página do produto. Compras de produtos não listados aqui
          liberam o app, mas não matriculam o aluno em nenhum concurso.
        </p>

        <div className="grid gap-2 sm:grid-cols-[160px_1fr_1fr_auto] items-end">
          <div>
            <Label className="stencil text-[10px]">ID do produto</Label>
            <Input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Ex: 1234567" />
          </div>
          <div>
            <Label className="stencil text-[10px]">Nome (opcional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Como você chama esse produto" />
          </div>
          <div>
            <Label className="stencil text-[10px]">Edital</Label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>
                {exams.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={salvar} disabled={saving} className="bg-gradient-flame text-white stencil">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Vincular
          </Button>
        </div>
      </div>

      {orphans.length > 0 && (
        <div className="bg-warning/10 border border-warning/40 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h4 className="font-display font-bold text-sm">Compras sem edital</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Estes produtos já venderam, mas não apontam para nenhum edital. Vincule acima e clique em
            "Reprocessar matrículas" para matricular quem já comprou.
          </p>
          <ul className="space-y-1">
            {orphans.map((o) => (
              <li key={o.product_id} className="flex items-center justify-between text-xs">
                <span className="font-mono">{o.product_id}</span>
                <span className="stencil text-muted-foreground">
                  {o.compras} compra(s) · última em {new Date(o.ultima_compra).toLocaleDateString("pt-BR")}
                </span>
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
                    {m.exam_name} · {m.compras_ativas} compra(s) ativa(s)
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remover(m)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
