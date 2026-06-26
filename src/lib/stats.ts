import { supabase } from "@/integrations/supabase/client";

export type DedupedAttempt = {
  question_id: string;
  is_correct: boolean;
  created_at: string;
  subject_id: string | null;
  subject_name: string | null;
  subject_slug: string | null;
};

/**
 * Carrega as tentativas do usuário aplicando dedupe:
 * apenas a resposta MAIS RECENTE de cada questão entra no cálculo.
 * Também garante que somente questões com resposta válida (is_correct boolean)
 * entrem no resultado — questões puladas/abandonadas não chegam aqui pois
 * só inserimos `attempts` quando o aluno confirma uma alternativa.
 */
export async function fetchDedupedAttempts(userId: string): Promise<DedupedAttempt[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select("question_id, is_correct, created_at, questions(subject_id, subjects(name, slug))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error || !data) return [];

  const seen = new Set<string>();
  const out: DedupedAttempt[] = [];
  for (const a of data as any[]) {
    if (!a.question_id) continue;
    if (typeof a.is_correct !== "boolean") continue; // ignora respostas inválidas
    if (seen.has(a.question_id)) continue; // mantém a mais recente
    seen.add(a.question_id);
    out.push({
      question_id: a.question_id,
      is_correct: a.is_correct,
      created_at: a.created_at,
      subject_id: a.questions?.subject_id ?? null,
      subject_name: a.questions?.subjects?.name ?? null,
      subject_slug: a.questions?.subjects?.slug ?? null,
    });
  }
  return out;
}
