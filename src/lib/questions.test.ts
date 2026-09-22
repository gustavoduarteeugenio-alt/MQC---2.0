import { describe, expect, it } from "vitest";
import { ANSWER_LETTERS, isAnswerLetter, normalizeAnswer, validateAnswer } from "./questions";

const cinco = { a: "alt A", b: "alt B", c: "alt C", d: "alt D", e: "alt E" };
const quatro = { a: "alt A", b: "alt B", c: "alt C", d: "alt D", e: null };

describe("normalizeAnswer", () => {
  it("normaliza o que vem de planilha", () => {
    expect(normalizeAnswer(" b ")).toBe("B");
    expect(normalizeAnswer("e")).toBe("E");
    expect(normalizeAnswer(null)).toBe("");
    expect(normalizeAnswer(undefined)).toBe("");
  });
});

describe("isAnswerLetter", () => {
  it("aceita A a E", () => {
    expect(ANSWER_LETTERS).toEqual(["A", "B", "C", "D", "E"]);
    expect(isAnswerLetter("E")).toBe(true);
    expect(isAnswerLetter("F")).toBe(false);
    expect(isAnswerLetter("")).toBe(false);
  });
});

describe("validateAnswer", () => {
  it("aceita E como gabarito quando a alternativa existe", () => {
    expect(validateAnswer("E", cinco)).toBeNull();
  });

  it("aceita questão de quatro alternativas", () => {
    expect(validateAnswer("D", quatro)).toBeNull();
  });

  it("recusa gabarito apontando para alternativa vazia", () => {
    expect(validateAnswer("E", quatro)).toBe('Gabarito "E" aponta para uma alternativa vazia.');
    expect(validateAnswer("E", { ...cinco, e: "   " })).toBe('Gabarito "E" aponta para uma alternativa vazia.');
  });

  it("recusa letra fora do conjunto", () => {
    expect(validateAnswer("F", cinco)).toBe('Gabarito inválido "F" (use A, B, C, D, E).');
  });

  it("recusa gabarito vazio", () => {
    expect(validateAnswer("", cinco)).toBe("Gabarito vazio.");
  });
});
