import { describe, it, expect, vi, beforeEach } from "vitest";

// O client do Supabase é mockado: os testes cobrem a lógica de dedupe,
// não a chamada de rede.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import { fetchDedupedAttempts } from "./stats";

/** Linha crua como o Supabase devolve (com o join aninhado de questions/subjects). */
type RawRow = {
  question_id: string | null;
  is_correct: unknown;
  created_at: string;
  questions?: {
    subject_id: string | null;
    subjects?: { name: string; slug: string } | null;
  } | null;
};

/**
 * Simula a cadeia `from().select().eq().order().limit()`, que só resolve
 * a promise no `limit`.
 */
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

/** Helper para montar uma linha respondida. */
const row = (
  question_id: string,
  is_correct: unknown,
  created_at: string,
  subject?: { id: string; name: string; slug: string },
): RawRow => ({
  question_id,
  is_correct,
  created_at,
  questions: subject
    ? { subject_id: subject.id, subjects: { name: subject.name, slug: subject.slug } }
    : null,
});

describe("fetchDedupedAttempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lista vazia quando a query falha", async () => {
    mockResponse({ data: null, error: { message: "boom" } });
    await expect(fetchDedupedAttempts("user-1")).resolves.toEqual([]);
  });

  it("retorna lista vazia quando não há dados", async () => {
    mockResponse({ data: null, error: null });
    await expect(fetchDedupedAttempts("user-1")).resolves.toEqual([]);
  });

  it("filtra as tentativas pelo usuário informado", async () => {
    const chain = mockResponse({ data: [], error: null });
    await fetchDedupedAttempts("user-42");
    expect(supabase.from).toHaveBeenCalledWith("attempts");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-42");
  });

  it("mantém apenas a resposta MAIS RECENTE de cada questão", async () => {
    // A query ordena por created_at desc, então a mais recente vem primeiro.
    mockResponse({
      data: [
        row("q1", true, "2026-03-02T10:00:00Z"),
        row("q1", false, "2026-03-01T10:00:00Z"),
      ],
      error: null,
    });

    const out = await fetchDedupedAttempts("user-1");

    expect(out).toHaveLength(1);
    expect(out[0].is_correct).toBe(true);
    expect(out[0].created_at).toBe("2026-03-02T10:00:00Z");
  });

  it("preserva questões distintas sem deduplicar entre elas", async () => {
    mockResponse({
      data: [
        row("q1", true, "2026-03-02T10:00:00Z"),
        row("q2", false, "2026-03-02T09:00:00Z"),
        row("q3", true, "2026-03-02T08:00:00Z"),
      ],
      error: null,
    });

    const out = await fetchDedupedAttempts("user-1");

    expect(out.map((a) => a.question_id)).toEqual(["q1", "q2", "q3"]);
  });

  it("ignora linhas sem question_id", async () => {
    mockResponse({
      data: [
        { question_id: null, is_correct: true, created_at: "2026-03-02T10:00:00Z" },
        row("q1", true, "2026-03-02T09:00:00Z"),
      ],
      error: null,
    });

    const out = await fetchDedupedAttempts("user-1");

    expect(out).toHaveLength(1);
    expect(out[0].question_id).toBe("q1");
  });

  it("ignora respostas cujo is_correct não é boolean", async () => {
    mockResponse({
      data: [
        row("q1", null, "2026-03-02T10:00:00Z"),
        row("q2", undefined, "2026-03-02T09:00:00Z"),
        row("q3", "true", "2026-03-02T08:00:00Z"),
        row("q4", false, "2026-03-02T07:00:00Z"),
      ],
      error: null,
    });

    const out = await fetchDedupedAttempts("user-1");

    expect(out).toHaveLength(1);
    expect(out[0].question_id).toBe("q4");
    expect(out[0].is_correct).toBe(false);
  });

  it("achata os dados da matéria vindos do join", async () => {
    mockResponse({
      data: [
        row("q1", true, "2026-03-02T10:00:00Z", {
          id: "sub-port",
          name: "Português",
          slug: "portugues",
        }),
      ],
      error: null,
    });

    const out = await fetchDedupedAttempts("user-1");

    expect(out[0]).toEqual({
      question_id: "q1",
      is_correct: true,
      created_at: "2026-03-02T10:00:00Z",
      subject_id: "sub-port",
      subject_name: "Português",
      subject_slug: "portugues",
    });
  });

  it("usa null quando a questão não tem matéria associada", async () => {
    mockResponse({
      data: [row("q1", true, "2026-03-02T10:00:00Z")],
      error: null,
    });

    const out = await fetchDedupedAttempts("user-1");

    expect(out[0].subject_id).toBeNull();
    expect(out[0].subject_name).toBeNull();
    expect(out[0].subject_slug).toBeNull();
  });
});
