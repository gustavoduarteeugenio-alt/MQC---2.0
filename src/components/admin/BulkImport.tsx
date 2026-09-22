import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { normalizeAnswer, validateAnswer } from "@/lib/questions";

type Subject = { id: string; name: string; slug: string };

type RawRow = Record<string, any>;

type ParsedRow = {
  rowNumber: number;
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
};

type RowError = { rowNumber: number; errors: string[] };

const REQUIRED = [
  "materia",
  "enunciado",
  "alternativa_a",
  "alternativa_b",
  "alternativa_c",
  "alternativa_d",
  "gabarito",
  "comentario",
];

const norm = (s: string) =>
  s
    ?.toString()
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

export const BulkImport = ({ subjects, onImported }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
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

  const validate = (rows: RawRow[]) => {
    const subjectByKey = new Map<string, string>();
    subjects.forEach((s) => {
      subjectByKey.set(norm(s.name), s.id);
      subjectByKey.set(norm(s.slug), s.id);
      subjectByKey.set(s.id, s.id);
    });

    const ok: ParsedRow[] = [];
    const errs: RowError[] = [];

    if (rows.length === 0) {
      errs.push({ rowNumber: 0, errors: ["Arquivo vazio."] });
    }

    rows.forEach((raw, idx) => {
      const row = normalizeKeys(raw);
      const rowNumber = idx + 2; // header = 1
      const missing = REQUIRED.filter((k) => !row[k] || row[k].toString().trim() === "");
      const localErrors: string[] = [];
      if (missing.length) localErrors.push(`Colunas faltando: ${missing.join(", ")}`);

      const subjKey = norm(row["materia"] ?? "");
      const subject_id = subjectByKey.get(subjKey);
      if (!subject_id && !missing.includes("materia"))
        localErrors.push(`Matéria "${row["materia"]}" não encontrada.`);

      // alternativa_e é opcional: a banca usa cinco alternativas, mas há questões com quatro
      const optionE = (row["alternativa_e"] ?? "").toString().trim();
      const gab = normalizeAnswer(row["gabarito"]);
      const gabError = validateAnswer(gab, {
        a: row["alternativa_a"],
        b: row["alternativa_b"],
        c: row["alternativa_c"],
        d: row["alternativa_d"],
        e: optionE,
      });
      if (gabError && !missing.includes("gabarito")) localErrors.push(gabError);

      const dif = (row["dificuldade"] ?? "medium").toString().trim().toLowerCase();
      const difMap: Record<string, string> = {
        facil: "easy", fácil: "easy", easy: "easy",
        medio: "medium", médio: "medium", medium: "medium",
        dificil: "hard", difícil: "hard", hard: "hard",
      };
      const difficulty = difMap[dif] ?? "medium";

      if (localErrors.length) {
        errs.push({ rowNumber, errors: localErrors });
        return;
      }

      ok.push({
        rowNumber,
        subject_id: subject_id!,
        statement: row["enunciado"].toString().trim(),
        option_a: row["alternativa_a"].toString().trim(),
        option_b: row["alternativa_b"].toString().trim(),
        option_c: row["alternativa_c"].toString().trim(),
        option_d: row["alternativa_d"].toString().trim(),
        option_e: optionE || null,
        correct_answer: gab,
        explanation: row["comentario"].toString().trim(),
        difficulty,
      });
    });

    setValid(ok);
    setErrors(errs);
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
    if (!valid.length) return;
    setImporting(true);
    const payload = valid.map(({ rowNumber, ...q }) => q);
    const chunkSize = 100;
    let inserted = 0;
    try {
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from("questions").insert(chunk as any);
        if (error) throw error;
        inserted += chunk.length;
      }
      toast.success(`${inserted} questões importadas com sucesso!`);
      reset();
      onImported();
    } catch (e: any) {
      toast.error("Falha na importação: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "materia", "enunciado",
      "alternativa_a", "alternativa_b", "alternativa_c", "alternativa_d", "alternativa_e",
      "gabarito", "comentario", "dificuldade",
    ];
    const example = [
      subjects[0]?.name ?? "Português",
      "Exemplo de enunciado da questão.",
      // PMMG e CBMMG usam quatro alternativas; a coluna alternativa_e fica no
      // modelo em branco, para editais de outras bancas que usem cinco.
      "Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D", "",
      "A", "Explicação do gabarito.", "medium",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "questoes");
    XLSX.writeFile(wb, "modelo_questoes.xlsx");
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" /> Importação em lote
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Aceita .csv, .xlsx ou .xls. Colunas obrigatórias: {REQUIRED.join(", ")}.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-1" /> Modelo
        </Button>
      </div>

      <div>
        <Label className="stencil text-[10px]">Arquivo</Label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer"
        />
        {fileName && (
          <p className="text-xs text-muted-foreground mt-1">Selecionado: {fileName}</p>
        )}
      </div>

      {parsing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Lendo arquivo...
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
                  <span className="font-mono font-bold">Linha {e.rowNumber}:</span>{" "}
                  {e.errors.join(" • ")}
                </p>
              ))}
              {errors.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  ...e mais {errors.length - 50} erro(s).
                </p>
              )}
            </div>
          )}

          {valid.length > 0 && (
            <div className="max-h-40 overflow-auto border border-border rounded-lg p-2 space-y-1">
              {valid.slice(0, 5).map((v) => (
                <p key={v.rowNumber} className="text-xs line-clamp-1">
                  <span className="font-mono">L{v.rowNumber}</span> [{v.correct_answer}]{" "}
                  {v.statement}
                </p>
              ))}
              {valid.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  ...e mais {valid.length - 5} questão(ões) prontas.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={doImport}
              disabled={!valid.length || importing}
              className="flex-1 bg-gradient-flame text-white stencil"
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importando...</>
              ) : (
                <><Upload className="w-4 h-4 mr-1" /> Importar {valid.length} questões</>
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
