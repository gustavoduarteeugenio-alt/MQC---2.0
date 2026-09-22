import { describe, it, expect } from "vitest";
import { caminhoNoBucket } from "./imagens";

const PROJ = "https://nrlovulqehnnabrwqwbo.supabase.co";

describe("caminhoNoBucket", () => {
  it("aceita caminho puro", () => {
    expect(caminhoNoBucket("questions/abc.png")).toBe("questions/abc.png");
  });

  it("tolera barra à toa e o nome do bucket repetido", () => {
    expect(caminhoNoBucket("/questions/abc.png")).toBe("questions/abc.png");
    expect(caminhoNoBucket("question-images/questions/abc.png")).toBe("questions/abc.png");
  });

  it("extrai o caminho da URL pública antiga", () => {
    expect(caminhoNoBucket(`${PROJ}/storage/v1/object/public/question-images/questions/abc.png`))
      .toBe("questions/abc.png");
  });

  it("extrai o caminho de uma URL ja assinada, ignorando o token", () => {
    expect(caminhoNoBucket(`${PROJ}/storage/v1/object/sign/question-images/questions/abc.png?token=xyz`))
      .toBe("questions/abc.png");
  });

  it("decodifica caminho com espaco", () => {
    expect(caminhoNoBucket(`${PROJ}/storage/v1/object/public/question-images/questions/mapa%20de%20minas.png`))
      .toBe("questions/mapa de minas.png");
  });

  it("deixa imagem de fora intacta", () => {
    expect(caminhoNoBucket("https://exemplo.com/img.png")).toBeNull();
  });

  it("ignora outro bucket do mesmo projeto", () => {
    expect(caminhoNoBucket(`${PROJ}/storage/v1/object/public/avatars/eu.png`)).toBeNull();
  });

  it("ignora valor vazio", () => {
    expect(caminhoNoBucket("")).toBeNull();
    expect(caminhoNoBucket("   ")).toBeNull();
  });
});
