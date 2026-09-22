-- Importação de questões por planilha, dentro de um edital: detecção de
-- duplicidade e registro de auditoria de cada importação.

-- ---------------------------------------------------------------------------
-- 1) Enunciado normalizado, para achar duplicidade
--    Coluna gerada: acompanha o enunciado sozinha, sem o app ter que manter.
-- ---------------------------------------------------------------------------
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS statement_key text
  GENERATED ALWAYS AS (md5(btrim(lower(regexp_replace(statement, '\s+', ' ', 'g'))))) STORED;

CREATE INDEX IF NOT EXISTS idx_questions_statement_key ON public.questions (statement_key);

COMMENT ON COLUMN public.questions.statement_key IS
  'Enunciado normalizado (minusculo, espacos colapsados) em md5. Usado para achar duplicidade na importacao.';

-- ---------------------------------------------------------------------------
-- 2) Quais enunciados já existem no edital
--    Recebe os enunciados crus e devolve, dos que vieram, os que já estão lá.
--    Devolve o próprio texto enviado (e não o hash) para o app comparar sem
--    precisar reproduzir a normalização nem calcular md5 no navegador.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_existing_statements(_exam_id uuid, _statements text[])
RETURNS TABLE (statement text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico')) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s
    FROM unnest(_statements) AS s
   WHERE EXISTS (
     SELECT 1
       FROM public.questions q
       JOIN public.exam_questions eq ON eq.question_id = q.id
      WHERE eq.exam_id = _exam_id
        AND q.statement_key = md5(btrim(lower(regexp_replace(s, '\s+', ' ', 'g'))))
   );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_existing_statements(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_existing_statements(uuid, text[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Auditoria das importações
-- ---------------------------------------------------------------------------
CREATE TABLE public.question_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name text,
  rows_read int NOT NULL DEFAULT 0,
  rows_imported int NOT NULL DEFAULT 0,
  rows_with_error int NOT NULL DEFAULT 0,
  rows_duplicated int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_question_imports_exam ON public.question_imports (exam_id, created_at DESC);

ALTER TABLE public.question_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_imports FROM anon, authenticated;
GRANT SELECT, INSERT ON public.question_imports TO authenticated;
GRANT ALL ON public.question_imports TO service_role;

CREATE POLICY "Staff le importacoes" ON public.question_imports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'));

CREATE POLICY "Staff registra importacao" ON public.question_imports FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'))
    AND user_id = auth.uid()
  );
