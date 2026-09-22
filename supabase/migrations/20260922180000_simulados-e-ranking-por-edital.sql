-- Simulados e ranking passam a viver dentro do edital.
--
-- As funções antigas (sem edital) continuam existindo até o frontend novo
-- estar publicado: aplicar esta migration sozinha não quebra o site no ar.

-- ---------------------------------------------------------------------------
-- 1) Simulado pertence a um edital
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_simulados_exam ON public.simulados (exam_id);
CREATE INDEX IF NOT EXISTS idx_simulado_attempts_exam ON public.simulado_attempts (user_id, exam_id, started_at DESC);

-- Aluno só enxerga simulado de edital em que está matriculado.
DROP POLICY IF EXISTS "Com acesso le simulados" ON public.simulados;
CREATE POLICY "Com acesso le simulados do edital"
  ON public.simulados FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico')
    OR (exam_id IS NOT NULL AND public.has_exam_access(exam_id))
  );

DROP POLICY IF EXISTS "Com acesso le simulado_questions" ON public.simulado_questions;
CREATE POLICY "Com acesso le simulado_questions do edital"
  ON public.simulado_questions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.simulados s
     WHERE s.id = simulado_questions.simulado_id
       AND (
         public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico')
         OR (s.exam_id IS NOT NULL AND public.has_exam_access(s.exam_id))
       )
  ));

-- ---------------------------------------------------------------------------
-- 2) Listagem de simulados do edital
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_published_simulados(_exam_id uuid)
RETURNS TABLE(id uuid, name text, description text, created_at timestamptz, duration_minutes int, question_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_exam_access(_exam_id) THEN
    RAISE EXCEPTION 'Sem acesso ao conteudo' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.id, s.name, s.description, s.created_at, s.duration_minutes,
         (SELECT COUNT(*) FROM public.simulado_questions sq WHERE sq.simulado_id = s.id)
    FROM public.simulados s
   WHERE s.exam_id = _exam_id
     AND EXISTS (SELECT 1 FROM public.simulado_questions sq WHERE sq.simulado_id = s.id)
   ORDER BY s.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_published_simulados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_published_simulados(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Ranking do treino, por edital
--    Sobrecarga: a versão sem edital continua para o frontend atual.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_training_ranking(_exam_id uuid, _limit integer DEFAULT 20)
RETURNS TABLE(rank_position bigint, user_id uuid, display_name text, correct_count bigint, is_anonymous boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_exam_access(_exam_id) THEN
    RAISE EXCEPTION 'Sem acesso ao conteudo' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT a.user_id, COUNT(*) FILTER (WHERE a.is_correct) AS correct_count
      FROM public.attempts a
     WHERE a.exam_id = _exam_id
     GROUP BY a.user_id
    HAVING COUNT(*) FILTER (WHERE a.is_correct) > 0
  ),
  ranked AS (
    SELECT ROW_NUMBER() OVER (ORDER BY agg.correct_count DESC, agg.user_id) AS pos,
           agg.user_id,
           COALESCE(p.show_in_ranking, true) AS show_name,
           COALESCE(NULLIF(btrim(p.ranking_name), ''), NULLIF(p.full_name, ''),
                    split_part(p.email, '@', 1), 'Recruta') AS chosen_name,
           agg.correct_count
      FROM agg
      LEFT JOIN public.profiles p ON p.user_id = agg.user_id
  )
  SELECT r.pos, r.user_id,
         CASE WHEN r.show_name THEN r.chosen_name ELSE 'Anônimo' END,
         r.correct_count,
         NOT r.show_name
    FROM ranked r
   ORDER BY r.pos
   LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 200);
END;
$$;

REVOKE ALL ON FUNCTION public.get_training_ranking(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_training_ranking(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_training_rank(_exam_id uuid)
RETURNS TABLE(rank_position bigint, correct_count bigint, total_users bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT a.user_id, COUNT(*) FILTER (WHERE a.is_correct) AS correct_count
      FROM public.attempts a
     WHERE a.exam_id = _exam_id
     GROUP BY a.user_id
    HAVING COUNT(*) FILTER (WHERE a.is_correct) > 0
  ),
  ranked AS (
    SELECT ROW_NUMBER() OVER (ORDER BY agg.correct_count DESC, agg.user_id) AS pos,
           agg.user_id, agg.correct_count
      FROM agg
  )
  SELECT r.pos, r.correct_count, (SELECT COUNT(*) FROM ranked)
    FROM ranked r
   WHERE r.user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_training_rank(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_training_rank(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Ranking de simulado: fechado ao edital e com desempate vindo do edital
--
--    Antes o desempate somava acertos de disciplinas escritas à mão no SQL
--    ("proteção", "defesa civil", ...), o que só valia para o CBMMG. Agora o
--    peso é o da própria disciplina no edital do simulado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_simulado_ranking(_simulado_id uuid, _limit int DEFAULT 100)
RETURNS TABLE(
  rank_position bigint,
  user_id uuid,
  display_name text,
  is_anonymous boolean,
  correct int,
  total int,
  duration_seconds int,
  weighted_score numeric,
  finished_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sim AS (
    SELECT s.id, s.exam_id
      FROM public.simulados s
     WHERE s.id = _simulado_id
       AND (s.exam_id IS NULL OR public.has_exam_access(s.exam_id))
  ),
  first_attempt AS (
    SELECT DISTINCT ON (sa.user_id) sa.*
    FROM public.simulado_attempts sa
    WHERE sa.simulado_id = (SELECT sim.id FROM sim) AND sa.finished_at IS NOT NULL
    ORDER BY sa.user_id, sa.started_at ASC
  ),
  scored AS (
    SELECT
      fa.user_id,
      fa.correct,
      fa.total,
      fa.duration_seconds,
      fa.finished_at,
      fa.started_at,
      COALESCE((
        SELECT SUM((s->>'correct')::int * COALESCE(cn.weight, 1))
        FROM jsonb_array_elements(fa.by_subject) s
        LEFT JOIN public.content_nodes cn
          ON cn.exam_id = (SELECT sim.exam_id FROM sim)
         AND cn.level = 1
         AND cn.name = s->>'name'
      ), 0)::numeric AS weighted_score,
      COALESCE(NULLIF(btrim(p.ranking_name),''), NULLIF(p.full_name,''), split_part(p.email,'@',1), 'Recruta') AS chosen_name,
      COALESCE(p.show_in_ranking, true) AS show_name
    FROM first_attempt fa
    LEFT JOIN public.profiles p ON p.user_id = fa.user_id
  ),
  ranked AS (
    SELECT ROW_NUMBER() OVER (
      ORDER BY correct DESC, duration_seconds ASC NULLS LAST, weighted_score DESC, started_at ASC
    ) AS rank_position, scored.*
    FROM scored
  )
  SELECT rank_position, user_id,
    CASE WHEN show_name THEN chosen_name ELSE 'Anônimo' END AS display_name,
    NOT show_name AS is_anonymous,
    correct, total, duration_seconds, weighted_score, finished_at
  FROM ranked
  ORDER BY rank_position
  LIMIT GREATEST(_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.get_my_simulado_rank(_simulado_id uuid)
RETURNS TABLE(
  rank_position bigint,
  total_users bigint,
  correct int,
  total int,
  duration_seconds int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sim AS (
    SELECT s.id, s.exam_id
      FROM public.simulados s
     WHERE s.id = _simulado_id
       AND (s.exam_id IS NULL OR public.has_exam_access(s.exam_id))
  ),
  first_attempt AS (
    SELECT DISTINCT ON (sa.user_id) sa.*
    FROM public.simulado_attempts sa
    WHERE sa.simulado_id = (SELECT sim.id FROM sim) AND sa.finished_at IS NOT NULL
    ORDER BY sa.user_id, sa.started_at ASC
  ),
  scored AS (
    SELECT
      fa.user_id, fa.correct, fa.total, fa.duration_seconds, fa.started_at,
      COALESCE((
        SELECT SUM((s->>'correct')::int * COALESCE(cn.weight, 1))
        FROM jsonb_array_elements(fa.by_subject) s
        LEFT JOIN public.content_nodes cn
          ON cn.exam_id = (SELECT sim.exam_id FROM sim)
         AND cn.level = 1
         AND cn.name = s->>'name'
      ), 0)::numeric AS weighted_score
    FROM first_attempt fa
  ),
  ranked AS (
    SELECT ROW_NUMBER() OVER (
      ORDER BY correct DESC, duration_seconds ASC NULLS LAST, weighted_score DESC, started_at ASC
    ) AS rank_position, scored.*
    FROM scored
  )
  SELECT r.rank_position, (SELECT COUNT(*) FROM ranked)::bigint AS total_users,
    r.correct, r.total, r.duration_seconds
  FROM ranked r
  WHERE r.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_simulado_ranking(uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_simulado_rank(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_simulado_ranking(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_simulado_rank(uuid) TO authenticated;
