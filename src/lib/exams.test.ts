import { describe, it, expect } from "vitest";
import { ExamRef, examLabel, examLabelCurto } from "./exams";

const exame = (name: string, sigla: string): ExamRef => ({
  id: "x", slug: "x", name, year: null, duration_minutes: 240,
  contest_name: "Curso de Formação de Soldados",
  institution_name: "Instituição", institution_sigla: sigla,
});

describe("examLabelCurto", () => {
  it("junta o curso com a sigla da instituição", () => {
    expect(examLabelCurto(exame("CFSd BM 2027", "CBMMG"))).toBe("CFSd-CBMMG");
    expect(examLabelCurto(exame("CFSd 2025", "PMMG"))).toBe("CFSd-PMMG");
  });

  it("tira o curso do nome, para um edital futuro não precisar de código novo", () => {
    expect(examLabelCurto(exame("CFO 2028", "PMMG"))).toBe("CFO-PMMG");
  });

  it("tolera espaço a mais no nome", () => {
    expect(examLabelCurto(exame("  CFSd  BM 2027 ", "CBMMG"))).toBe("CFSd-CBMMG");
  });

  it("cai na sigla quando o nome está vazio", () => {
    expect(examLabelCurto(exame("", "PMMG"))).toBe("PMMG");
    expect(examLabelCurto(exame("   ", "PMMG"))).toBe("PMMG");
  });
});

describe("examLabel", () => {
  it("segue completo, para os cabeçalhos das telas", () => {
    expect(examLabel(exame("CFSd BM 2027", "CBMMG"))).toBe("CBMMG · CFSd BM 2027");
  });
});
