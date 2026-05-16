import { supabase } from "@/integrations/supabase/client";

export type SubjectInfo = { id: string; name: string; slug: string };
export type SubjectStat = SubjectInfo & {
  total: number;
  correct: number;
  accuracy: number; // 0..100, 0 if no attempts
  hasAttempts: boolean;
};

const TARGET_ACCURACY = 80;

/** Carrega todas as matérias + estatísticas de acerto do usuário por matéria. */
export async function getSubjectStats(userId: string): Promise<SubjectStat[]> {
  const [{ data: subjects }, { data: attempts }] = await Promise.all([
    supabase.from("subjects").select("id, name, slug").order("display_order"),
    supabase
      .from("attempts")
      .select("is_correct, questions(subject_id)")
      .eq("user_id", userId)
      .limit(5000),
  ]);

  const stats: Record<string, { total: number; correct: number }> = {};
  (attempts ?? []).forEach((a: any) => {
    const sid = a.questions?.subject_id;
    if (!sid) return;
    stats[sid] = stats[sid] ?? { total: 0, correct: 0 };
    stats[sid].total++;
    if (a.is_correct) stats[sid].correct++;
  });

  return (subjects ?? []).map((s: any) => {
    const st = stats[s.id];
    const total = st?.total ?? 0;
    const correct = st?.correct ?? 0;
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      hasAttempts: total > 0,
    };
  });
}

/**
 * Escolhe a próxima matéria a treinar.
 * Regras:
 *  - Se errou a última → reforça a mesma matéria.
 *  - Senão: prioriza não iniciadas, depois <80% (da pior para a melhor).
 *  - Se o topo da fila for a matéria atual e o aluno já fez `streakOnCurrent` acertos seguidos,
 *    troca para a 2ª pior para garantir variedade.
 *  - Se ninguém estiver abaixo de 80% → modo revisão (matéria de menor acerto).
 */
export function pickNextSubject(opts: {
  stats: SubjectStat[];
  currentSubjectId?: string | null;
  lastWasCorrect?: boolean | null;
  streakOnCurrent?: number;
}): SubjectStat | null {
  const { stats, currentSubjectId, lastWasCorrect, streakOnCurrent = 0 } = opts;
  if (stats.length === 0) return null;

  const current = currentSubjectId
    ? stats.find((s) => s.id === currentSubjectId) ?? null
    : null;

  if (lastWasCorrect === false && current) return current;

  const unattempted = stats.filter((s) => !s.hasAttempts);
  const weak = stats
    .filter((s) => s.hasAttempts && s.accuracy < TARGET_ACCURACY)
    .sort((a, b) => a.accuracy - b.accuracy);

  const queue = [...unattempted, ...weak];

  if (queue.length === 0) {
    // todos >= 80% → revisão da que tem menor acerto
    const reviewed = [...stats].sort((a, b) => a.accuracy - b.accuracy);
    return reviewed[0] ?? null;
  }

  const top = queue[0];
  if (!current || top.id !== current.id) return top;

  // top é a matéria atual: alterna se houver streak e existir outra fraca
  if (streakOnCurrent >= 2 && queue.length >= 2) return queue[1];
  return top;
}
