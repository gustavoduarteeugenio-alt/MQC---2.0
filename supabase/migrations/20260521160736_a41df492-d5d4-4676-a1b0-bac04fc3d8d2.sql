
-- Add lead capture columns to diagnostic_sessions
ALTER TABLE public.diagnostic_sessions
  ADD COLUMN IF NOT EXISTS lead_name text,
  ADD COLUMN IF NOT EXISTS instagram_handle text;

-- Admin overview metrics
CREATE OR REPLACE FUNCTION public.get_diagnostic_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_sessions', (SELECT COUNT(*) FROM public.diagnostic_sessions),
    'completed_sessions', (SELECT COUNT(*) FROM public.diagnostic_sessions WHERE completed_at IS NOT NULL),
    'leads_count', (SELECT COUNT(*) FROM public.diagnostic_sessions WHERE lead_name IS NOT NULL AND btrim(lead_name) <> ''),
    'last_24h', (SELECT COUNT(*) FROM public.diagnostic_sessions WHERE created_at >= now() - interval '24 hours'),
    'last_7d', (SELECT COUNT(*) FROM public.diagnostic_sessions WHERE created_at >= now() - interval '7 days'),
    'avg_score', (SELECT COALESCE(ROUND(AVG(CASE WHEN total > 0 THEN (correct::numeric / total) * 100 END)::numeric, 1), 0) FROM public.diagnostic_sessions WHERE completed_at IS NOT NULL)
  ) INTO result;

  RETURN result;
END;
$$;

-- Admin paginated listing with profile join
CREATE OR REPLACE FUNCTION public.list_diagnostic_sessions(
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0,
  _filter text DEFAULT 'all'
)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  completed_at timestamptz,
  lead_name text,
  instagram_handle text,
  profile_name text,
  profile_email text,
  user_id uuid,
  correct integer,
  total integer,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT d.*
    FROM public.diagnostic_sessions d
    WHERE
      CASE _filter
        WHEN 'completed' THEN d.completed_at IS NOT NULL
        WHEN 'leads' THEN d.lead_name IS NOT NULL AND btrim(d.lead_name) <> ''
        WHEN 'anonymous' THEN (d.lead_name IS NULL OR btrim(d.lead_name) = '') AND d.user_id IS NULL
        ELSE TRUE
      END
  ),
  counted AS (SELECT COUNT(*)::bigint AS c FROM base)
  SELECT
    b.id,
    b.created_at,
    b.completed_at,
    b.lead_name,
    b.instagram_handle,
    p.full_name AS profile_name,
    p.email AS profile_email,
    b.user_id,
    b.correct,
    b.total,
    (SELECT c FROM counted) AS total_count
  FROM base b
  LEFT JOIN public.profiles p ON p.user_id = b.user_id
  ORDER BY b.created_at DESC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_diagnostic_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_diagnostic_sessions(integer, integer, text) TO authenticated;
