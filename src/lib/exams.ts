import { supabase } from "@/integrations/supabase/client";

// Consultas da estrutura multi-edital. Tudo aqui é sempre no escopo de um
// edital: é ele que isola conteúdo, questões, estatística e ranking.

export type ExamRef = {
  id: string;
  slug: string;
  name: string;
  year: number | null;
  duration_minutes: number;
  contest_name: string;
  institution_name: string;
  institution_sigla: string;
};

export type Enrollment = { exam: ExamRef; access_until: string | null };

export type ContentNode = {
  id: string;
  exam_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  level: number;
  display_order: number;
  weight: number | null;
};

/** Rótulo curto do edital, como o aluno o reconhece: "CBMMG · CFSd BM 2027". */
export const examLabel = (e: ExamRef) => `${e.institution_sigla} · ${e.name}`;

const EXAM_SELECT =
  "access_until, exams(id, slug, name, year, duration_minutes, contests(name, institutions(name, sigla)))";

export async function fetchMyEnrollments(userId: string): Promise<Enrollment[]> {
  const { data, error } = await (supabase as any)
    .from("enrollments")
    .select(EXAM_SELECT)
    .eq("user_id", userId);
  if (error || !data) return [];

  return (data as any[])
    .map((row) => {
      const ex = row.exams;
      if (!ex) return null;
      return {
        access_until: row.access_until ?? null,
        exam: {
          id: ex.id,
          slug: ex.slug,
          name: ex.name,
          year: ex.year ?? null,
          duration_minutes: ex.duration_minutes ?? 240,
          contest_name: ex.contests?.name ?? "",
          institution_name: ex.contests?.institutions?.name ?? "",
          institution_sigla: ex.contests?.institutions?.sigla ?? "",
        },
      } as Enrollment;
    })
    .filter(Boolean)
    .filter((e: Enrollment) => !e.access_until || new Date(e.access_until) > new Date())
    .sort((a: Enrollment, b: Enrollment) => examLabel(a.exam).localeCompare(examLabel(b.exam)));
}

export async function fetchContentNodes(examId: string): Promise<ContentNode[]> {
  const { data } = await (supabase as any)
    .from("content_nodes")
    .select("id, exam_id, parent_id, name, slug, level, display_order, weight")
    .eq("exam_id", examId)
    .order("level")
    .order("display_order");
  return (data ?? []) as ContentNode[];
}

export const disciplinesOf = (nodes: ContentNode[]) =>
  nodes.filter((n) => n.level === 1).sort((a, b) => a.display_order - b.display_order);

export const childrenOf = (nodes: ContentNode[], parentId: string | null) =>
  nodes.filter((n) => n.parent_id === parentId).sort((a, b) => a.display_order - b.display_order);

export const nodeBySlug = (nodes: ContentNode[], slug: string) =>
  nodes.find((n) => n.slug === slug) ?? null;

/** Disciplina (nível 1) à qual um nó pertence — usada para agrupar estatística. */
export const disciplineOf = (nodes: ContentNode[], nodeId: string | null): ContentNode | null => {
  let current = nodes.find((n) => n.id === nodeId) ?? null;
  while (current && current.parent_id) current = nodes.find((n) => n.id === current!.parent_id) ?? null;
  return current;
};

/** Todos os nós de uma subárvore, incluindo a raiz — o treino de um tópico inclui seus subtópicos. */
export const subtreeIds = (nodes: ContentNode[], rootId: string): string[] => {
  const out = [rootId];
  const walk = (parentId: string) => {
    for (const child of nodes.filter((n) => n.parent_id === parentId)) {
      out.push(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return out;
};

/** Quantas questões publicadas existem em cada nó do edital (contagem própria, sem herdar filhos). */
export async function fetchQuestionCounts(examId: string): Promise<Record<string, number>> {
  const { data } = await (supabase as any)
    .from("exam_questions")
    .select("content_node_id")
    .eq("exam_id", examId)
    .eq("status", "published");
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { content_node_id: string | null }[]) {
    if (!row.content_node_id) continue;
    counts[row.content_node_id] = (counts[row.content_node_id] ?? 0) + 1;
  }
  return counts;
}

/** Soma a contagem de um nó com a de toda a sua subárvore. */
export const countWithSubtree = (nodes: ContentNode[], counts: Record<string, number>, rootId: string) =>
  subtreeIds(nodes, rootId).reduce((sum, id) => sum + (counts[id] ?? 0), 0);
