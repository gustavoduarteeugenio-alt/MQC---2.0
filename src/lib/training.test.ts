import { describe, it, expect } from "vitest";
import { pickNextSubject, type SubjectStat } from "./training";

/** Helper para construir um SubjectStat de forma sucinta. */
const mk = (
  id: string,
  name: string,
  accuracy: number,
  total = 10,
): SubjectStat => ({
  id,
  name,
  slug: name.toLowerCase(),
  total,
  correct: Math.round((total * accuracy) / 100),
  accuracy,
  hasAttempts: total > 0,
});

const unattempted = (id: string, name: string): SubjectStat => ({
  id,
  name,
  slug: name.toLowerCase(),
  total: 0,
  correct: 0,
  accuracy: 0,
  hasAttempts: false,
});

describe("pickNextSubject", () => {
  it("retorna null quando não há matérias", () => {
    expect(pickNextSubject({ stats: [] })).toBeNull();
  });

  it("prioriza matérias inéditas sobre matérias fracas", () => {
    const stats = [
      mk("mat", "Matemática", 30),
      unattempted("rlm", "RLM"),
      mk("port", "Português", 60),
    ];
    const next = pickNextSubject({ stats });
    expect(next?.id).toBe("rlm");
  });

  it("modo reforço: errou a última → mantém a matéria atual mesmo se outra é pior", () => {
    const stats = [
      mk("mat", "Matemática", 30),
      mk("port", "Português", 60),
    ];
    const next = pickNextSubject({
      stats,
      currentSubjectId: "port",
      lastWasCorrect: false,
    });
    expect(next?.id).toBe("port");
  });

  it("acertou e existe matéria mais fraca → troca para a pior", () => {
    const stats = [
      mk("mat", "Matemática", 30),
      mk("port", "Português", 60),
    ];
    const next = pickNextSubject({
      stats,
      currentSubjectId: "port",
      lastWasCorrect: true,
      streakOnCurrent: 1,
    });
    expect(next?.id).toBe("mat");
  });

  it("acertou e atual já é a pior, streak=1 → continua na atual", () => {
    const stats = [
      mk("mat", "Matemática", 30),
      mk("port", "Português", 60),
    ];
    const next = pickNextSubject({
      stats,
      currentSubjectId: "mat",
      lastWasCorrect: true,
      streakOnCurrent: 1,
    });
    expect(next?.id).toBe("mat");
  });

  it("streak >= 2 na pior matéria → alterna para a 2ª pior (variedade)", () => {
    const stats = [
      mk("mat", "Matemática", 30),
      mk("port", "Português", 60),
      mk("leg", "Legislação", 70),
    ];
    const next = pickNextSubject({
      stats,
      currentSubjectId: "mat",
      lastWasCorrect: true,
      streakOnCurrent: 2,
    });
    expect(next?.id).toBe("port");
  });

  it("streak alto mas só existe UMA matéria fraca → continua nela", () => {
    const stats = [
      mk("mat", "Matemática", 30),
      mk("port", "Português", 85),
      mk("leg", "Legislação", 90),
    ];
    const next = pickNextSubject({
      stats,
      currentSubjectId: "mat",
      lastWasCorrect: true,
      streakOnCurrent: 5,
    });
    expect(next?.id).toBe("mat");
  });

  it("todas as matérias ≥ 80% → modo revisão (menor acerto entre fortes)", () => {
    const stats = [
      mk("mat", "Matemática", 95),
      mk("port", "Português", 82),
      mk("leg", "Legislação", 88),
    ];
    const next = pickNextSubject({
      stats,
      currentSubjectId: "mat",
      lastWasCorrect: true,
      streakOnCurrent: 1,
    });
    expect(next?.id).toBe("port");
  });

  it("padrão E-E-E-E sempre reforça a matéria atual", () => {
    const stats = [
      mk("mat", "Matemática", 50),
      mk("port", "Português", 30),
    ];
    for (let i = 0; i < 4; i++) {
      const next = pickNextSubject({
        stats,
        currentSubjectId: "mat",
        lastWasCorrect: false,
        streakOnCurrent: 0,
      });
      expect(next?.id).toBe("mat");
    }
  });

  it("padrão A-E-A-E-A em uma única matéria fraca → fica sempre nela", () => {
    const stats = [
      mk("mat", "Matemática", 40),
      mk("port", "Português", 85),
      mk("leg", "Legislação", 90),
    ];
    const pattern = [true, false, true, false, true];
    let streak = 0;
    for (const correct of pattern) {
      streak = correct ? streak + 1 : 0;
      const next = pickNextSubject({
        stats,
        currentSubjectId: "mat",
        lastWasCorrect: correct,
        streakOnCurrent: streak,
      });
      expect(next?.id).toBe("mat");
    }
  });

  it("padrão A-A-A-A em matéria fraca com OUTRAS fracas → alterna ao bater streak 2", () => {
    const stats = [
      mk("mat", "Matemática", 40),
      mk("port", "Português", 60),
    ];
    const choices: string[] = [];
    let streak = 0;
    for (let i = 0; i < 4; i++) {
      streak += 1; // todos acertos
      const next = pickNextSubject({
        stats,
        currentSubjectId: "mat",
        lastWasCorrect: true,
        streakOnCurrent: streak,
      });
      choices.push(next!.id);
    }
    // 1ª e 2ª chamadas (streak 1 e 2): streak<2 → mat; streak>=2 → port
    expect(choices[0]).toBe("mat");
    expect(choices[1]).toBe("port");
    // chamadas seguintes mantêm a regra (streak ainda na matéria atual = mat)
    expect(choices[2]).toBe("port");
    expect(choices[3]).toBe("port");
  });

  it("fluxo realista de treino: matemática 40 → legislação 60 → português 75 → história 90", () => {
    // Estado mutável simulando respostas certas
    const stats: SubjectStat[] = [
      mk("mat", "Matemática", 40, 10),
      mk("leg", "Legislação", 60, 10),
      mk("port", "Português", 75, 10),
      mk("hist", "História", 90, 10),
    ];

    const apply = (id: string, correct: boolean) => {
      const s = stats.find((x) => x.id === id)!;
      s.total += 1;
      if (correct) s.correct += 1;
      s.accuracy = Math.round((s.correct / s.total) * 100);
    };

    // Aluno está em Matemática
    let current = "mat";
    let streak = 0;

    // 1) Acerta em Matemática (streak=1) → continua mat
    apply(current, true); streak = 1;
    let next = pickNextSubject({ stats, currentSubjectId: current, lastWasCorrect: true, streakOnCurrent: streak });
    expect(next?.id).toBe("mat");
    current = next!.id;

    // 2) Acerta novamente (streak=2) → alterna para 2ª pior (leg)
    apply(current, true); streak = 2;
    next = pickNextSubject({ stats, currentSubjectId: current, lastWasCorrect: true, streakOnCurrent: streak });
    expect(next?.id).toBe("leg");
    current = next!.id; streak = 0; // mudou de matéria → reset

    // 3) Erra em Legislação → fica em legislação
    apply(current, false); streak = 0;
    next = pickNextSubject({ stats, currentSubjectId: current, lastWasCorrect: false, streakOnCurrent: streak });
    expect(next?.id).toBe("leg");
    current = next!.id;

    // 4) Acerto isolado em Legislação (streak=1) → mat ainda é a pior, troca pra mat
    apply(current, true); streak = 1;
    next = pickNextSubject({ stats, currentSubjectId: current, lastWasCorrect: true, streakOnCurrent: streak });
    expect(next?.id).toBe("mat");
  });

  it("quando matéria atual ultrapassa 80%, próximo acerto a tira da fila de prioridade", () => {
    // Matemática agora forte (85%), outras ainda fracas
    const stats = [
      mk("mat", "Matemática", 85),
      mk("port", "Português", 50),
      mk("leg", "Legislação", 70),
    ];
    const next = pickNextSubject({
      stats,
      currentSubjectId: "mat",
      lastWasCorrect: true,
      streakOnCurrent: 1,
    });
    // queue só contém port e leg; topo = port (pior)
    expect(next?.id).toBe("port");
  });
});
