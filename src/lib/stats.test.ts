import { describe, it, expect, vi, beforeEach } from "vitest";

// O client do Supabase é mockado: os testes cobrem a lógica de dedupe e
// agregação, não a chamada de rede.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import { accuracyOf, fetchExamAttempts, tallyByNode } from "./stats";
import type { ContentNode } from "./exams";

type RawRow = {
  question_id: string | null;
  is_correct: unknown;
  created_at: string;
  content_node_id?: string | null;
};

/** Simula `from().select().eq().eq().order().limit()`, que só resolve no `limit`. */
const mockResponse = (result: { data: RawRow[] | null; error: unknown }) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  vi.mocked(supabase.from).mockReturnValue(chain as never);
  return chain;
};

const row = (
  question_id: string,
  is_correct: unknown,
  created_at: string,
  content_node_id: string | null = "n1",
): RawRow => ({ question_id, is_correct, created_at, content_node_id });

const node = (id: string, parent_id: string | null, level: number): ContentNode => ({
  id,
  exam_id: "e1",
  parent_id,
  name: id,
  slug: id,
  level,
  display_order: 1,
  weight: null,
});

// Disciplina d1 → tópico t1 → subtópico s1; disciplina d2 → tópico t2
const NODES: ContentNode[] = [
  node("d1", null, 1), node("t1", "d1", 2), node("s1", "t1", 3),
  node("d2", null, 1), node("t2", "d2", 2),
];

describe("fetchExamAttempts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna lista vazia quando a query falha", async () => {
    mockResponse({ data: null, error: { message: "boom" } });
    await expect(fetchExamAttempts("user-1", "exam-1")).resolves.toEqual([]);
  });

  it("retorna lista vazia quando não há dados", async () => {
    mockResponse({ data: null, error: null });
    await expect(fetchExamAttempts("user-1", "exam-1")).resolves.toEqual([]);
  });

  it("filtra por usuário E por edital", async () => {
    const chain = mockResponse({ data: [], error: null });
    await fetchExamAttempts("user-42", "exam-9");
    expect(supabase.from).toHaveBeenCalledWith("attempts");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-42");
    expect(chain.eq).toHaveBeenCalledWith("exam_id", "exam-9");
  });

  it("mantém apenas a resposta mais recente de cada questão", async () => {
    mockResponse({
      data: [
        row("q1", true, "2026-09-20T10:00:00Z"),
        row("q1", false, "2026-09-19T10:00:00Z"),
      ],
      error: null,
    });
    const out = await fetchExamAttempts("user-1", "exam-1");
    expect(out).toHaveLength(1);
    expect(out[0].is_correct).toBe(true);
  });

  it("preserva questões distintas e ignora linhas inválidas", async () => {
    mockResponse({
      data: [
        row("q1", true, "2026-09-20T10:00:00Z", "t1"),
        row("q2", false, "2026-09-20T09:00:00Z", "t2"),
        row(null as never, true, "2026-09-20T08:00:00Z"),
        row("q3", "sim" as unknown, "2026-09-20T07:00:00Z"),
      ],
      error: null,
    });
    const out = await fetchExamAttempts("user-1", "exam-1");
    expect(out.map((a) => a.question_id)).toEqual(["q1", "q2"]);
    expect(out[0].content_node_id).toBe("t1");
  });
});

describe("tallyByNode", () => {
  it("conta no nó respondido e sobe até a disciplina", () => {
    const { byNode, byDiscipline } = tallyByNode(
      [
        { question_id: "q1", is_correct: true, created_at: "", content_node_id: "s1" },
        { question_id: "q2", is_correct: false, created_at: "", content_node_id: "t1" },
        { question_id: "q3", is_correct: true, created_at: "", content_node_id: "t2" },
      ],
      NODES,
    );
    // o subtópico conta só nele mesmo…
    expect(byNode["s1"]).toEqual({ total: 1, correct: 1 });
    expect(byNode["t1"]).toEqual({ total: 1, correct: 0 });
    // …e as duas respostas de d1 (via s1 e t1) somam na disciplina
    expect(byDiscipline["d1"]).toEqual({ total: 2, correct: 1 });
    expect(byDiscipline["d2"]).toEqual({ total: 1, correct: 1 });
  });

  it("ignora tentativas sem nó e nós desconhecidos", () => {
    const { byNode, byDiscipline } = tallyByNode(
      [
        { question_id: "q1", is_correct: true, created_at: "", content_node_id: null },
        { question_id: "q2", is_correct: true, created_at: "", content_node_id: "fantasma" },
      ],
      NODES,
    );
    expect(byNode["fantasma"]).toEqual({ total: 1, correct: 1 });
    expect(Object.keys(byDiscipline)).toEqual([]);
  });
});

describe("accuracyOf", () => {
  it("arredonda e trata ausência de dados", () => {
    expect(accuracyOf({ total: 3, correct: 2 })).toBe(67);
    expect(accuracyOf({ total: 0, correct: 0 })).toBe(0);
    expect(accuracyOf(undefined)).toBe(0);
  });
});
