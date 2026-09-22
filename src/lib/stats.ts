import { supabase } from "@/integrations/supabase/client";
import { ContentNode, disciplineOf } from "@/lib/exams";

export type ExamAttempt = {
  question_id: string;
  is_correct: boolean;
  created_at: string;
  content_node_id: string | null;
};

/**
 * Tentativas do aluno **dentro de um edital**, deduplicadas por questão.
 *
 * O dedupe é herdado do modelo atual e será revisto na fase dos indicadores:
 * recência e retenção precisam do histórico completo, que continua gravado.
 */
export async function fetchExamAttempts(userId: string, examId: string): Promise<ExamAttempt[]> {
  const { data, error } = await (supabase as any)
    .from("attempts")
    .select("question_id, is_correct, created_at, content_node_id")
    .eq("user_id", userId)
    .eq("exam_id", examId)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error || !data) return [];

  const seen = new Set<string>();
  const out: ExamAttempt[] = [];
  for (const a of data as any[]) {
    if (!a.question_id || typeof a.is_correct !== "boolean") continue;
    if (seen.has(a.question_id)) continue;
    seen.add(a.question_id);
    out.push({
      question_id: a.question_id,
      is_correct: a.is_correct,
      created_at: a.created_at,
      content_node_id: a.content_node_id ?? null,
    });
  }
  return out;
}

export type NodeTally = { total: number; correct: number };

/** Agrega as tentativas por nó de conteúdo e também na disciplina (nível 1) de cada um. */
export function tallyByNode(attempts: ExamAttempt[], nodes: ContentNode[]) {
  const byNode: Record<string, NodeTally> = {};
  const byDiscipline: Record<string, NodeTally> = {};

  for (const a of attempts) {
    if (!a.content_node_id) continue;
    const node = (byNode[a.content_node_id] ??= { total: 0, correct: 0 });
    node.total++;
    if (a.is_correct) node.correct++;

    const disc = disciplineOf(nodes, a.content_node_id);
    if (!disc) continue;
    const d = (byDiscipline[disc.id] ??= { total: 0, correct: 0 });
    d.total++;
    if (a.is_correct) d.correct++;
  }

  return { byNode, byDiscipline };
}

export const accuracyOf = (t: NodeTally | undefined) =>
  t && t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
