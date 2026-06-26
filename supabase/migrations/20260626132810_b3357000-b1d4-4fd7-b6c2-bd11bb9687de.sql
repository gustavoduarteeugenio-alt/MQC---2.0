
-- 1) landing_leads: drop misleading SELECT policy, harden INSERT WITH CHECK
DROP POLICY IF EXISTS "Only service_role can read landing leads" ON public.landing_leads;
DROP POLICY IF EXISTS "Anyone can insert landing leads" ON public.landing_leads;

CREATE POLICY "Public can submit landing lead"
  ON public.landing_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 120
    AND email IS NOT NULL AND length(btrim(email)) BETWEEN 3 AND 200
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND (phone IS NULL OR length(phone) <= 40)
    AND (instagram_handle IS NULL OR length(instagram_handle) <= 60)
    AND (source IS NULL OR length(source) <= 80)
  );

-- 2) diagnostic_sessions: remove direct INSERT for anon/authenticated.
-- All inserts must go through SECURITY DEFINER RPC `create_diagnostic_session`.
DROP POLICY IF EXISTS "Anyone can create diagnostic session" ON public.diagnostic_sessions;

-- 3) questions: revoke direct column access to correct_answer/explanation
REVOKE SELECT (correct_answer, explanation) ON public.questions FROM anon, authenticated;

-- Reveal answer for a single question (any authenticated user)
CREATE OR REPLACE FUNCTION public.reveal_question_answer(_qid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  SELECT jsonb_build_object(
    'id', id,
    'correct_answer', upper(correct_answer),
    'explanation', explanation,
    'comment_image_url', comment_image_url
  ) INTO r
  FROM public.questions
  WHERE id = _qid;
  RETURN COALESCE(r, '{}'::jsonb);
END;
$$;

-- Reveal answers for many questions (any authenticated user) — used by simulado scoring
CREATE OR REPLACE FUNCTION public.reveal_questions_answers(_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'correct_answer', upper(correct_answer),
    'explanation', explanation,
    'comment_image_url', comment_image_url
  )) INTO r
  FROM public.questions
  WHERE id = ANY(_ids);
  RETURN COALESCE(r, '[]'::jsonb);
END;
$$;

-- Admin listing with sensitive fields (admins / didatico only)
CREATE OR REPLACE FUNCTION public.admin_list_questions()
RETURNS SETOF public.questions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT * FROM public.questions ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reveal_question_answer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_questions_answers(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_questions() TO authenticated;
