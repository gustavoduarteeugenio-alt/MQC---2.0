import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Download, Copy, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { normalizeAnswer, validateAnswer } from "@/lib/questions";
import { ContentNode } from "@/lib/exams";

type Exam = { id: string; name: string; year: number | null };
type RawRow = Record<string, any>;

type ParsedRow = {
  rowNumber: number;
  content_node_id: string;
  content_path: string;
  statement: string;
  option_a: string; option_b: string; option_c: string; option_d: string; option_e: string | null;
  correct_answer: string;
  explanation: string;
  difficulty: string;
  year: number | null;
  banca: string;
};
type RowError = { rowNumber: number; campo: string; problema: string };

const REQUIRED = ["conteudo", "enunciado", "alternativa_a", "alternativa_b", "gabarito", "comentario"];

const norm = (s: string) =>
  s?.toString().trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");

const normalizeKeys = (row: RawRow): RawRow => {
  const out: RawRow = {};
  for (const k of Object.keys(row)) out[norm(k)] = row[k];
  return out;
};

/** Caminho completo do nó, como aparece na planilha: "Ciências Naturais > Química". */
const caminho = (nodes: ContentNode[], id: string): string => {
  const partes: string[] = [];
  let atual: ContentNode | null = nodes.find((n) => n.id === id) ?? null;
  while (atual) {
    partes.unshift(atual.name);
    atual = atual.parent_id ? nodes.find((n) => n.id === atual!.parent_id) ?? null : null;
  }
  return partes.join(" > ");
};

/** Aceita o caminho completo ou só o nome da folha, ignorando acento e caixa. */
const acharNo = (nodes: ContentNode[], valor: string): ContentNode | null => {
  const alvo = norm(valor).replace(/_?>_?/g, ">");
  const porCaminho = nodes.find((n) => norm(caminho(nodes, n.id)).replace(/_?>_?/g, ">") === alvo);
  if (porCaminho) return porCaminho;
  const porNome = nodes.filter((n) => norm(n.name) === alvo);
  return porNome.length === 1 ? porNome[0] : null;
};

const DIFICULDADES: Record<string, string> = {
  facil: "easy", easy: "easy",
  medio: "medium", medium: "medium",
  dificil: "hard", hard: "hard",
};

export const BulkImport = ({ onImported }: { onImported?: () => void }) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [fileName, setFileName] = useState("");
  const [valid, setValid] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [duplicadas, setDuplicadas] = useState<ParsedRow[]>([]);
  const [lidas, setLidas] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("exams").select("id, name, year").order("year", { ascending: false });
      const lista = (data ?? []) as Exam[];
      setExams(lista);
      setExamId((a) => a || lista[0]?.id || "");
    })();
  }, []);

  useEffect(() => {
    if (!examId) { setNodes([]); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("content_nodes").select("*").eq("exam_id", examId).order("level").order("display_order");
      setNodes((data ?? []) as ContentNode[]);
    })();
    reset();
  }, [examId]);

  const reset = () => {
    setFileName(""); setValid([]); setErrors([]); setDuplicadas([]); setLidas(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const folhas = useMemo(
    () => nodes.filter((n) => !nodes.some((c) => c.parent_id === n.id)),
    [nodes],
  );

  const validar = useCallback(async (rows: RawRow[], nome: string) => {
    const errs: RowError[] = [];
    const ok: ParsedRow[] = [];
    const vistosNoArquivo = new Map<string, number>();

    rows.forEach((raw, i) => {
      const rowNumber = i + 2; // linha 1 é o cabeçalho
      const row = normalizeKeys(raw);
      if (Object.values(row).every((v) => (v ?? "").toString().trim() === "")) return; // linha vazia

      const faltando = REQUIRED.filter((k) => !row[k] || row[k].toString().trim() === "");
      faltando.forEach((campo) => errs.push({ rowNumber, campo, problema: "Campo obrigatório vazio." }));

      const no = row["conteudo"] ? acharNo(nodes, row["conteudo"].toString()) : null;
      if (row["conteudo"] && !no) {
        errs.push({
          rowNumber, campo: "conteudo",
          problema: `"${row["conteudo"]}" não existe neste edital (ou é ambíguo). Use o valor da aba Conteúdo do modelo.`,
        });
      }

      const optionE = (row["alternativa_e"] ?? "").toString().trim();
      const gab = normalizeAnswer(row["gabarito"]);
      const erroGab = validateAnswer(gab, {
        a: row["alternativa_a"], b: row["alternativa_b"], c: row["alternativa_c"], d: row["alternativa_d"], e: optionE,
      });
      if (erroGab && !faltando.includes("gabarito")) errs.push({ rowNumber, campo: "gabarito", problema: erroGab });

      const difBruta = norm((row["dificuldade"] ?? "medium").toString());
      const difficulty = DIFICULDADES[difBruta];
      if (row["dificuldade"] && !difficulty) {
        errs.push({ rowNumber, campo: "dificuldade", problema: `"${row["dificuldade"]}" inválida. Use fácil, médio ou difícil.` });
      }

      const anoBruto = (row["ano"] ?? "").toString().trim();
      const year = anoBruto ? Number(anoBruto) : null;
      if (anoBruto && (isNaN(year!) || year! < 1900 || year! > 2100)) {
        errs.push({ rowNumber, campo: "ano", problema: `"${anoBruto}" não é um ano válido.` });
      }

      const enunciado = (row["enunciado"] ?? "").toString().trim();
      const chave = enunciado.toLowerCase().replace(/\s+/g, " ");
      if (chave && vistosNoArquivo.has(chave)) {
        errs.push({
          rowNumber, campo: "enunciado",
          problema: `Enunciado repetido na própria planilha (igual ao da linha ${vistosNoArquivo.get(chave)}).`,
        });
      } else if (chave) {
        vistosNoArquivo.set(chave, rowNumber);
      }

      if (errs.some((e) => e.rowNumber === rowNumber)) return;

      ok.push({
        rowNumber,
        content_node_id: no!.id,
        content_path: caminho(nodes, no!.id),
        statement: enunciado,
        option_a: row["alternativa_a"].toString().trim(),
        option_b: row["alternativa_b"].toString().trim(),
        option_c: (row["alternativa_c"] ?? "").toString().trim(),
        option_d: (row["alternativa_d"] ?? "").toString().trim(),
        option_e: optionE || null,
        correct_answer: gab,
        explanation: row["comentario"].toString().trim(),
        difficulty: difficulty ?? "medium",
        year,
        banca: (row["banca"] ?? "IDECAN").toString().trim() || "IDECAN",
      });
    });

    // Já existe no edital? O banco compara pelo enunciado normalizado e
    // devolve os textos que já estão lá.
    let jaExistem: ParsedRow[] = [];
    if (ok.length > 0) {
      const { data, error } = await (supabase as any).rpc("admin_existing_statements", {
        _exam_id: examId,
        _statements: ok.map((r) => r.statement),
      });
      if (error) {
        toast.error("Não foi possível checar duplicidade: " + error.message);
      } else {
        const existentes = new Set(((data ?? []) as any[]).map((d) => d.statement ?? d));
        jaExistem = ok.filter((r) => existentes.has(r.statement));
      }
    }

    const duplicados = new Set(jaExistem.map((r) => r.rowNumber));
    const novos = ok.filter((r) => !duplicados.has(r.rowNumber));
    setErrors(errs);
    setValid(novos);
    setDuplicadas(jaExistem);
    setLidas(rows.length);
    setFileName(nome);
    setParsing(false);
  }, [nodes, examId]);

  const onFile = (file: File) => {
    if (!examId) { toast.error("Escolha o edital antes."); return; }
    if (nodes.length === 0) { toast.error("Este edital ainda não tem conteúdo cadastrado."); return; }
    setParsing(true);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => validar(res.data as RawRow[], file.name),
        error: () => { setParsing(false); toast.error("Não consegui ler o CSV."); },
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        validar(XLSX.utils.sheet_to_json(ws) as RawRow[], file.name);
      } catch {
        setParsing(false);
        toast.error("Não consegui ler a planilha.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const importar = async () => {
    if (!valid.length || !examId) return;
    setImporting(true);
    let importadas = 0;
    try {
      const CHUNK = 100;
      for (let i = 0; i < valid.length; i += CHUNK) {
        const lote = valid.slice(i, i + CHUNK);
        const { data: criadas, error } = await (supabase as any).from("questions").insert(
          lote.map((r) => ({
            statement: r.statement,
            option_a: r.option_a, option_b: r.option_b, option_c: r.option_c, option_d: r.option_d,
            option_e: r.option_e,
            correct_answer: r.correct_answer,
            explanation: r.explanation,
            difficulty: r.difficulty,
            year: r.year,
            banca: r.banca,
          })),
        ).select("id");
        if (error) throw error;

        const ids = ((criadas ?? []) as any[]).map((q) => q.id);
        const { error: e2 } = await (supabase as any).from("exam_questions").insert(
          ids.map((id, idx) => ({
            exam_id: examId,
            question_id: id,
            content_node_id: lote[idx].content_node_id,
            status: "draft", // entra como rascunho: publica depois da revisão
          })),
        );
        if (e2) throw e2;
        importadas += ids.length;
      }

      await (supabase as any).from("question_imports").insert({
        exam_id: examId,
        user_id: user?.id ?? null,
        file_name: fileName,
        rows_read: lidas,
        rows_imported: importadas,
        rows_with_error: new Set(errors.map((e) => e.rowNumber)).size,
        rows_duplicated: duplicadas.length,
      });

      toast.success(`${importadas} questões importadas como rascunho. Revise e publique em Questões.`);
      reset();
      onImported?.();
    } catch (e: any) {
      toast.error(`Importei ${importadas} antes de falhar: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const baixarModelo = () => {
    const headers = [
      "conteudo", "enunciado",
      "alternativa_a", "alternativa_b", "alternativa_c", "alternativa_d", "alternativa_e",
      "gabarito", "comentario", "dificuldade", "banca", "ano",
    ];
    const exemplo = [
      folhas[0] ? caminho(nodes, folhas[0].id) : "Disciplina > Tópico",
      "Exemplo de enunciado da questão.",
      "Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D", "",
      "A", "Explicação do gabarito.", "médio", "IDECAN", "2026",
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, exemplo]), "questoes");
    // Aba com as classificações válidas: evita digitar o conteúdo à mão
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["conteudo (use exatamente estes valores)"], ...nodes.map((n) => [caminho(nodes, n.id)])]),
      "conteudo",
    );
    const exam = exams.find((e) => e.id === examId);
    XLSX.writeFile(wb, `modelo_questoes_${(exam?.name ?? "edital").replace(/\s+/g, "_").toLowerCase()}.xlsx`);
  };

  const linhasComErro = new Set(errors.map((e) => e.rowNumber)).size;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold">Importar questões</h2>
        </div>

        <div>
          <Label className="stencil text-[10px]">Edital de destino</Label>
          <Select value={examId} onValueChange={setExamId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {exams.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">
            As questões entram só neste edital, como rascunho, e ficam invisíveis ao aluno até você publicar.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={baixarModelo} disabled={nodes.length === 0} className="stencil text-[11px]">
            <Download className="w-3.5 h-3.5 mr-1" /> Baixar modelo deste edital
          </Button>
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={!examId || parsing}
            className="bg-gradient-brand text-white stencil text-[11px]">
            <Upload className="w-3.5 h-3.5 mr-1" /> Enviar planilha
          </Button>
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Colunas obrigatórias: {REQUIRED.join(", ")}. Opcionais: alternativa_c, alternativa_d, alternativa_e,
          dificuldade, banca, ano. O modelo traz uma aba <strong>conteudo</strong> com as classificações deste edital.
        </p>
      </div>

      {parsing && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {!parsing && fileName && (
        <>
          <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-3">
            <p className="text-sm font-semibold">{fileName}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Resumo rotulo="Linhas lidas" valor={lidas} />
              <Resumo rotulo="Prontas" valor={valid.length} tom="ok" icone={<CheckCircle2 className="w-3.5 h-3.5" />} />
              <Resumo rotulo="Com erro" valor={linhasComErro} tom={linhasComErro ? "erro" : undefined} icone={<AlertTriangle className="w-3.5 h-3.5" />} />
              <Resumo rotulo="Já no edital" valor={duplicadas.length} icone={<Copy className="w-3.5 h-3.5" />} />
            </div>

            <Button onClick={importar} disabled={!valid.length || importing}
              className="w-full bg-gradient-brand text-white stencil">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Upload className="w-4 h-4 mr-1" /> Importar {valid.length} como rascunho</>}
            </Button>
          </div>

          {errors.length > 0 && (
            <div className="bg-card border border-destructive/40 rounded-2xl p-4 shadow-card space-y-2">
              <h3 className="font-display font-bold text-sm flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" /> {errors.length} problemas em {linhasComErro} linhas
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {errors.slice(0, 100).map((e, i) => (
                  <div key={i} className="text-xs border-b border-border pb-1.5 last:border-0">
                    <span className="stencil text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded mr-1.5">
                      Linha {e.rowNumber}
                    </span>
                    <strong>{e.campo}:</strong> {e.problema}
                  </div>
                ))}
                {errors.length > 100 && (
                  <p className="text-[11px] text-muted-foreground pt-1">…e mais {errors.length - 100} problemas.</p>
                )}
              </div>
            </div>
          )}

          {duplicadas.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-1.5">
              <h3 className="font-display font-bold text-sm flex items-center gap-2">
                <Copy className="w-4 h-4 text-muted-foreground" /> {duplicadas.length} já existem neste edital
              </h3>
              <p className="text-[11px] text-muted-foreground">Estas linhas serão ignoradas na importação.</p>
              {duplicadas.slice(0, 5).map((d) => (
                <p key={d.rowNumber} className="text-xs truncate">Linha {d.rowNumber}: {d.statement}</p>
              ))}
            </div>
          )}

          {valid.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-2">
              <h3 className="font-display font-bold text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" /> Pré-visualização
              </h3>
              {valid.slice(0, 5).map((v) => (
                <div key={v.rowNumber} className="border border-border rounded-xl p-2.5 text-xs space-y-1">
                  <p className="stencil text-[10px] text-muted-foreground">{v.content_path} · Gab. {v.correct_answer} · {v.banca}</p>
                  <p className="line-clamp-2">{v.statement}</p>
                </div>
              ))}
              {valid.length > 5 && (
                <p className="text-[11px] text-muted-foreground">…e mais {valid.length - 5} questões prontas.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Resumo = ({ rotulo, valor, tom, icone }: { rotulo: string; valor: number; tom?: "ok" | "erro"; icone?: React.ReactNode }) => (
  <div className={`rounded-xl border p-2.5 ${
    tom === "ok" ? "border-success/40 bg-success/10" : tom === "erro" ? "border-destructive/40 bg-destructive/10" : "border-border"
  }`}>
    <p className="stencil text-[9px] text-muted-foreground flex items-center gap-1">{icone} {rotulo}</p>
    <p className="font-display font-bold text-lg">{valor}</p>
  </div>
);
