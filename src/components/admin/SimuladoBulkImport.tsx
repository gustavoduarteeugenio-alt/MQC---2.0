import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { normalizeAnswer, validateAnswer } from "@/lib/questions";

type Subject = { id: string; name: string; slug?: string };

type RawRow = Record<string, any>;

type ParsedRow = {
  rowNumber: number;
  num_questao: number;
  subject_id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string | null;
  correct_answer: string;
  explanation: string;
};

type RowError = { rowNumber: number; errors: string[] };

const REQUIRED = [
  "num_questao",
  "disciplina",
  "enunciado",
  "alternativa_a",
  "alternativa_b",
  "alternativa_c",
  "alternativa_d",
  "resposta_correta",
  "comentario_professor",
];

const ALLOWED_DISCIPLINAS = [
  "Língua Portuguesa",
  "Raciocínio Lógico e Matemático",
  "Noções de Direitos Humanos e Legislação",
  "Ciências Naturais",
  "Ciências Humanas",
  "Proteção e Defesa Civil",
];

const norm = (s: any) =>
  (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

const normalizeKeys = (row: RawRow): RawRow => {
  const out: RawRow = {};
  for (const k of Object.keys(row)) out[norm(k)] = row[k];
  return out;
};

interface Props {
  subjects: Subject[];
  onImported: () => void;
}

export const SimuladoBulkImport = ({ subjects, onImported }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [simuladoName, setSimuladoName] = useState("");
  const [duration, setDuration] = useState<number>(240);
  const [fileName, setFileName] = useState<string>("");
  const [valid, setValid] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setFileName("");
    setValid([]);
    setErrors([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const resetAll = () => {
    reset();
    setSimuladoName("");
    setDuration(240);
  };

  const validate = (rows: RawRow[]) => {
    // Build a map of normalized discipline name → subject_id
    const subjectByName = new Map<string, string>();
    subjects.forEach((s) => subjectByName.set(norm(s.name), s.id));

    const ok: ParsedRow[] = [];
    const errs: RowError[] = [];

    if (rows.length === 0) {
      errs.push({ rowNumber: 0, errors: ["Planilha vazia."] });
    }

    const seenNums = new Set<number>();

    rows.forEach((raw, idx) => {
      const row = normalizeKeys(raw);
      const rowNumber = idx + 2;
      const localErrors: string[] = [];

      const missing = REQUIRED.filter((k) => {
        const v = row[k];
        return v === undefined || v === null || v.toString().trim() === "";
      });
      if (missing.length) localErrors.push(`Colunas faltando: ${missing.join(", ")}`);

      const num = Number(row["num_questao"]);
      if (!Number.isFinite(num) || num < 1) {
        if (!missing.includes("num_questao")) localErrors.push(`num_questao inválido "${row["num_questao"]}".`);
      } else if (seenNums.has(num)) {
        localErrors.push(`num_questao duplicado (${num}).`);
      } else {
        seenNums.add(num);
      }

      const discRaw = (row["disciplina"] ?? "").toString().trim();
      const subject_id = subjectByName.get(norm(discRaw));
      if (!subject_id && !missing.includes("disciplina")) {
        localErrors.push(
          `Disciplina "${discRaw}" inválida. Use exatamente uma de: ${ALLOWED_DISCIPLINAS.join(" | ")}.`,
        );
      }

      // alternativa_e é opcional, como no importador do banco de questões
      const optionE = (row["alternativa_e"] ?? "").toString().trim();
      const gab = normalizeAnswer(row["resposta_correta"]);
      const gabError = validateAnswer(gab, {
        a: row["alternativa_a"],
        b: row["alternativa_b"],
        c: row["alternativa_c"],
        d: row["alternativa_d"],
        e: optionE,
      });
      if (gabError && !missing.includes("resposta_correta")) {
        localErrors.push(gabError.replace("Gabarito", "resposta_correta"));
      }

      if (localErrors.length) {
        errs.push({ rowNumber, errors: localErrors });
        return;
      }

      ok.push({
        rowNumber,
        num_questao: num,
        subject_id: subject_id!,
        statement: row["enunciado"].toString(),
        option_a: row["alternativa_a"].toString(),
        option_b: row["alternativa_b"].toString(),
        option_c: row["alternativa_c"].toString(),
        option_d: row["alternativa_d"].toString(),
        option_e: optionE || null,
        correct_answer: gab,
        explanation: row["comentario_professor"].toString(),
      });
    });

    // Sort by num_questao for stable ordering
    ok.sort((a, b) => a.num_questao - b.num_questao);

    setValid(ok);
    setErrors(errs);

    if (errs.length > 0) {
      toast.error(`Foram encontrados ${errs.length} erro(s) na planilha. Corrija antes de publicar.`);
    } else {
      toast.success(`Planilha lida com sucesso: ${ok.length} questões encontradas.`);
    }
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    setValid([]);
    setErrors([]);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows: RawRow[] = [];
      if (ext === "csv") {
        const text = await file.text();
        const res = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
        rows = res.data;
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "" });
      } else {
        toast.error("Formato não suportado. Envie .csv, .xlsx ou .xls");
        setParsing(false);
        return;
      }
      validate(rows);
    } catch (e: any) {
      toast.error("Erro ao ler arquivo: " + e.message);
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!simuladoName.trim()) {
      toast.error("Informe o nome do simulado.");
      return;
    }
    if (!valid.length) {
      toast.error("Nenhuma questão válida para importar.");
      return;
    }
    if (errors.length > 0) {
      toast.error("Corrija os erros da planilha antes de publicar.");
      return;
    }

    setImporting(true);
    try {
      // 1) Create simulado
      const { data: sim, error: eSim } = await (supabase
        .from("simulados" as any)
        .insert({
          name: simuladoName.trim(),
          description: `Importado via planilha (${valid.length} questões)`,
          duration_minutes: duration,
        } as any)
        .select("id")
        .single()) as any;
      if (eSim) throw eSim;
      const simId = sim.id;

      // 2) Insert questions
      const questionsPayload = valid.map((v) => ({
        subject_id: v.subject_id,
        statement: v.statement,
        option_a: v.option_a,
        option_b: v.option_b,
        option_c: v.option_c,
        option_d: v.option_d,
        option_e: v.option_e,
        correct_answer: v.correct_answer,
        explanation: v.explanation,
        difficulty: "medium",
      }));

      const { data: inserted, error: eQ } = await supabase
        .from("questions")
        .insert(questionsPayload as any)
        .select("id");
      if (eQ) throw eQ;

      // 3) Link to simulado in same order as valid[]
      const links = (inserted ?? []).map((q: any, i: number) => ({
        simulado_id: simId,
        question_id: q.id,
        position: valid[i].num_questao,
      }));
      const { error: eL } = await (supabase.from("simulado_questions" as any).insert(links as any)) as any;
      if (eL) throw eL;

      toast.success(`Simulado "${simuladoName}" publicado com ${valid.length} questões.`);
      resetAll();
      onImported();
    } catch (e: any) {
      toast.error("Falha na importação: " + (e.message ?? "erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "num_questao",
      "disciplina",
      "enunciado",
      "alternativa_a",
      "alternativa_b",
      "alternativa_c",
      "alternativa_d",
      "alternativa_e",
      "resposta_correta",
      "comentario_professor",
    ];
    const examples = ALLOWED_DISCIPLINAS.slice(0, 2).map((disc, i) => [
      i + 1,
      disc,
      `Exemplo de enunciado ${i + 1}. Suporta HTML: <b>negrito</b> e <img src="https://exemplo.com/img.png" />`,
      "Alternativa A",
      "Alternativa B",
      "Alternativa C",
      "Alternativa D",
      // Quatro alternativas no exemplo: é o padrão dos editais de PMMG e CBMMG
      "",
      "A",
      "Resolução comentada pelo professor.",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "simulado");
    XLSX.writeFile(wb, "modelo_simulado.xlsx");
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" /> Importar Simulado via Planilha
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Aceita .csv, .xlsx ou .xls. Colunas obrigatórias: {REQUIRED.join(", ")}.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-1" /> Modelo
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <Label className="stencil text-[10px]">Nome do Simulado</Label>
          <Input
            value={simuladoName}
            onChange={(e) => setSimuladoName(e.target.value)}
            placeholder="Ex: 1º Simulado Inédito de Reta Final - CBMMG"
          />
        </div>
        <div>
          <Label className="stencil text-[10px]">Duração (min)</Label>
          <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </div>
      </div>

      <div>
        <Label className="stencil text-[10px]">Arquivo da planilha</Label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer"
        />
        {fileName && <p className="text-xs text-muted-foreground mt-1">Selecionado: {fileName}</p>}
      </div>

      {parsing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Lendo planilha...
        </div>
      )}

      {(valid.length > 0 || errors.length > 0) && !parsing && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> {valid.length} válidas
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="w-4 h-4" /> {errors.length} com erro
            </span>
          </div>

          {errors.length > 0 && (
            <div className="max-h-48 overflow-auto border border-destructive/30 bg-destructive/5 rounded-lg p-2 space-y-1">
              {errors.slice(0, 50).map((e) => (
                <p key={e.rowNumber} className="text-xs">
                  <span className="font-mono font-bold">Linha {e.rowNumber}:</span> {e.errors.join(" • ")}
                </p>
              ))}
              {errors.length > 50 && (
                <p className="text-xs text-muted-foreground">...e mais {errors.length - 50} erro(s).</p>
              )}
            </div>
          )}

          {valid.length > 0 && errors.length === 0 && (
            <div className="border border-primary/30 bg-primary/5 rounded-lg p-3">
              <p className="text-sm font-display font-bold">
                Planilha lida com sucesso: {valid.length} questões encontradas.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Deseja publicar o simulado <strong>{simuladoName || "(sem nome)"}</strong>?
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={doImport}
              disabled={!valid.length || importing || errors.length > 0 || !simuladoName.trim()}
              className="flex-1 bg-gradient-flame text-white stencil"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Publicando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1" /> Publicar simulado ({valid.length} questões)
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={importing}>
              Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
