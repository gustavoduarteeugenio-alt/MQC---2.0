// Regras de alternativas e gabarito, compartilhadas pelo cadastro manual e pelos
// dois importadores de planilha.
//
// Os editais da PMMG e do CBMMG usam quatro alternativas (A a D), então a coluna
// alternativa_e fica em branco nas planilhas. E continua aceita porque outras
// bancas usam cinco, e nesse caso pode ser o gabarito — desde que a alternativa
// exista, o que validateAnswer garante.

export const ANSWER_LETTERS = ["A", "B", "C", "D", "E"] as const;
export type AnswerLetter = (typeof ANSWER_LETTERS)[number];

/** Normaliza o gabarito vindo de planilha ("b", " C ", "e") para a letra maiúscula. */
export const normalizeAnswer = (raw: unknown): string =>
  (raw ?? "").toString().trim().toUpperCase();

export const isAnswerLetter = (value: string): value is AnswerLetter =>
  (ANSWER_LETTERS as readonly string[]).includes(value);

/**
 * Valida o gabarito contra as alternativas preenchidas da linha.
 * Devolve null quando está válido, ou a mensagem de erro para o relatório.
 */
export const validateAnswer = (
  answer: string,
  options: Partial<Record<Lowercase<AnswerLetter>, string | null | undefined>>,
): string | null => {
  if (!answer) return "Gabarito vazio.";
  if (!isAnswerLetter(answer)) {
    return `Gabarito inválido "${answer}" (use ${ANSWER_LETTERS.join(", ")}).`;
  }
  const chosen = options[answer.toLowerCase() as Lowercase<AnswerLetter>];
  if (!chosen || chosen.toString().trim() === "") {
    return `Gabarito "${answer}" aponta para uma alternativa vazia.`;
  }
  return null;
};
