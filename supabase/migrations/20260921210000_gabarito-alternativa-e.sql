-- A coluna option_e existe desde 05/2026, mas a restrição de correct_answer
-- continuava aceitando apenas A–D: nenhuma questão com gabarito E podia ser
-- gravada. A banca IDECAN usa cinco alternativas.

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_correct_answer_check;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_correct_answer_check
  CHECK (correct_answer IN ('A', 'B', 'C', 'D', 'E'));

-- O gabarito não pode apontar para uma alternativa que não existe.
-- Só E precisa da regra: A–D são NOT NULL desde a criação da tabela.
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_answer_has_option_check;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_answer_has_option_check
  CHECK (correct_answer <> 'E' OR (option_e IS NOT NULL AND btrim(option_e) <> ''));
