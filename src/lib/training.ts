import { accuracyOf, fetchExamAttempts, tallyByNode } from "@/lib/stats";
import { ContentNode, disciplinesOf } from "@/lib/exams";

export type SubjectInfo = { id: string; name: string; slug: string };
export type SubjectStat = SubjectInfo & {
  total: number;
  correct: number;
  accuracy: number; // 0..100, 0 if no attempts
  hasAttempts: boolean;
};

const TARGET_ACCURACY = 80;

/**
 * Estatística por disciplina no escopo de um edital: as "matérias" são as
 * disciplinas (nível 1) da árvore de conteúdo, e as tentativas contadas são só
 * as daquele edital. Alimenta pickNextSubject sem mudar suas regras.
 */
export async function getDisciplineStats(
  userId: string,
  examId: string,
  nodes: ContentNode[],
): Promise<SubjectStat[]> {
  const attempts = await fetchExamAttempts(userId, examId);
  const { byDiscipline } = tallyByNode(attempts, nodes);

  return disciplinesOf(nodes).map((d) => {
    const tally = byDiscipline[d.id];
    return {
      id: d.id,
      name: d.name,
      slug: d.slug,
      total: tally?.total ?? 0,
      correct: tally?.correct ?? 0,
      accuracy: accuracyOf(tally),
      hasAttempts: (tally?.total ?? 0) > 0,
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
