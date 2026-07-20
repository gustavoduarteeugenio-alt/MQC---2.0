
CREATE OR REPLACE FUNCTION public.list_published_simulados()
RETURNS TABLE(id uuid, name text, description text, created_at timestamptz, question_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.description, s.created_at,
    (SELECT COUNT(*) FROM public.simulado_questions sq WHERE sq.simulado_id = s.id) AS question_count
  FROM public.simulados s
  WHERE EXISTS (SELECT 1 FROM public.simulado_questions sq WHERE sq.simulado_id = s.id)
  ORDER BY s.created_at DESC;
$$;

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
  WITH first_attempt AS (
    SELECT DISTINCT ON (sa.user_id) sa.*
    FROM public.simulado_attempts sa
    WHERE sa.simulado_id = _simulado_id AND sa.finished_at IS NOT NULL
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
        SELECT SUM((s->>'correct')::int)
        FROM jsonb_array_elements(fa.by_subject) s
        WHERE s->>'name' ILIKE '%prote%'
           OR s->>'name' ILIKE '%defesa civil%'
           OR s->>'name' ILIKE '%direitos humanos%'
           OR s->>'name' ILIKE '%legisla%'
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
  WITH first_attempt AS (
    SELECT DISTINCT ON (sa.user_id) sa.*
    FROM public.simulado_attempts sa
    WHERE sa.simulado_id = _simulado_id AND sa.finished_at IS NOT NULL
    ORDER BY sa.user_id, sa.started_at ASC
  ),
  scored AS (
    SELECT
      fa.user_id, fa.correct, fa.total, fa.duration_seconds, fa.started_at,
      COALESCE((
        SELECT SUM((s->>'correct')::int)
        FROM jsonb_array_elements(fa.by_subject) s
        WHERE s->>'name' ILIKE '%prote%'
           OR s->>'name' ILIKE '%defesa civil%'
           OR s->>'name' ILIKE '%direitos humanos%'
           OR s->>'name' ILIKE '%legisla%'
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
