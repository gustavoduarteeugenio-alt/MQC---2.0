ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ranking_name text;

CREATE OR REPLACE FUNCTION public.get_training_ranking(_limit integer DEFAULT 20)
 RETURNS TABLE(rank_position bigint, user_id uuid, display_name text, correct_count bigint, is_anonymous boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH agg AS (
    SELECT a.user_id, COUNT(*) FILTER (WHERE a.is_correct) AS correct_count
    FROM public.attempts a
    GROUP BY a.user_id
    HAVING COUNT(*) FILTER (WHERE a.is_correct) > 0
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY agg.correct_count DESC, agg.user_id) AS rank_position,
      agg.user_id,
      COALESCE(p.show_in_ranking, true) AS show_name,
      COALESCE(
        NULLIF(btrim(p.ranking_name), ''),
        NULLIF(p.full_name, ''),
        split_part(p.email, '@', 1),
        'Recruta'
      ) AS chosen_name,
      agg.correct_count
    FROM agg
    LEFT JOIN public.profiles p ON p.user_id = agg.user_id
  )
  SELECT
    rank_position,
    user_id,
    CASE WHEN show_name THEN chosen_name ELSE 'Anônimo' END AS display_name,
    correct_count,
    NOT show_name AS is_anonymous
  FROM ranked
  ORDER BY rank_position
  LIMIT GREATEST(_limit, 1);
$function$;