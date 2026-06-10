
-- 1. Lock down diagnostic_sessions
DROP POLICY IF EXISTS "Anyone can read diagnostic sessions" ON public.diagnostic_sessions;
DROP POLICY IF EXISTS "Anyone can update diagnostic sessions" ON public.diagnostic_sessions;

CREATE POLICY "Owner reads own diagnostic session"
  ON public.diagnostic_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner updates own diagnostic session"
  ON public.diagnostic_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Remove anon read on questions (exposes correct_answer)
DROP POLICY IF EXISTS "Anon read questions for diagnostic" ON public.questions;
DROP POLICY IF EXISTS "Anon read subjects for diagnostic" ON public.subjects;

-- 3. Tighten user_roles ALL policy with WITH CHECK
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Limit anon visibility of user_roles SELECT
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Storage: remove listing on question-images (public URL reads still work)
DROP POLICY IF EXISTS "Authenticated view question images" ON storage.objects;

-- 5. Server-side functions for anonymous diagnostic flow
CREATE OR REPLACE FUNCTION public.get_diagnostic_questions(_per_subject int DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH ranked AS (
    SELECT q.*, s.name AS subject_name, s.display_order,
      ROW_NUMBER() OVER (PARTITION BY q.subject_id ORDER BY q.id) AS rn
    FROM public.questions q
    JOIN public.subjects s ON s.id = q.subject_id
  ),
  picked AS (
    SELECT * FROM ranked WHERE rn <= GREATEST(_per_subject, 1)
    ORDER BY display_order, rn
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'subject_id', subject_id,
    'subject_name', subject_name,
    'statement', statement,
    'option_a', option_a,
    'option_b', option_b,
    'option_c', option_c,
    'option_d', option_d,
    'option_e', option_e,
    'image_url', image_url
  )) INTO result FROM picked;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_diagnostic_session(_client_token text, _total int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF _client_token IS NULL OR length(btrim(_client_token)) < 8 THEN
    RAISE EXCEPTION 'invalid client_token';
  END IF;
  INSERT INTO public.diagnostic_sessions (client_token, total, user_id)
  VALUES (_client_token, GREATEST(_total, 0), auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_diagnostic_answers(
  _session_id uuid,
  _client_token text,
  _answers jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.diagnostic_sessions;
  _results jsonb;
  _total int;
  _correct int;
BEGIN
  SELECT * INTO _row FROM public.diagnostic_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
  IF _row.client_token <> _client_token AND (_row.user_id IS NULL OR _row.user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH ans AS (
    SELECT (e->>'qid')::uuid AS qid, upper(e->>'ans') AS ans
    FROM jsonb_array_elements(COALESCE(_answers, '[]'::jsonb)) e
  ),
  joined AS (
    SELECT q.subject_id, s.name AS subject_name, ans.ans, upper(q.correct_answer) AS correct
    FROM ans JOIN public.questions q ON q.id = ans.qid
    JOIN public.subjects s ON s.id = q.subject_id
  ),
  per_sub AS (
    SELECT subject_id, subject_name,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ans = correct)::int AS correct
    FROM joined GROUP BY subject_id, subject_name
  )
  SELECT jsonb_agg(jsonb_build_object(
    'subject_id', subject_id,
    'subject_name', subject_name,
    'total', total,
    'correct', correct,
    'pct', CASE WHEN total > 0 THEN ROUND((correct::numeric / total) * 100)::int ELSE 0 END
  ) ORDER BY (CASE WHEN total > 0 THEN (correct::numeric / total) ELSE 0 END))
  INTO _results FROM per_sub;

  _results := COALESCE(_results, '[]'::jsonb);
  SELECT COALESCE(SUM((e->>'total')::int),0), COALESCE(SUM((e->>'correct')::int),0)
    INTO _total, _correct FROM jsonb_array_elements(_results) e;

  UPDATE public.diagnostic_sessions
  SET answers = COALESCE(_answers, '[]'::jsonb),
      results = _results,
      correct = _correct,
      total = _total,
      completed_at = now(),
      updated_at = now()
  WHERE id = _session_id;

  RETURN jsonb_build_object('results', _results, 'correct', _correct, 'total', _total);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_diagnostic_lead(
  _session_id uuid,
  _client_token text,
  _lead_name text,
  _instagram_handle text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.diagnostic_sessions;
BEGIN
  SELECT * INTO _row FROM public.diagnostic_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
  IF _row.client_token <> _client_token AND (_row.user_id IS NULL OR _row.user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.diagnostic_sessions
  SET lead_name = btrim(_lead_name),
      instagram_handle = regexp_replace(btrim(_instagram_handle), '^@', ''),
      updated_at = now()
  WHERE id = _session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_diagnostic_session(_client_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.diagnostic_sessions;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _client_token IS NULL OR length(btrim(_client_token)) < 8 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT * INTO _row FROM public.diagnostic_sessions
  WHERE client_token = _client_token
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;

  UPDATE public.diagnostic_sessions SET user_id = _uid, updated_at = now() WHERE id = _row.id;
  RETURN jsonb_build_object('ok', true, 'id', _row.id, 'results', _row.results, 'completed_at', _row.completed_at);
END;
$$;

-- 6. Subjects: re-expose minimal read to anon for the Diagnostico intro labels (slug + name only is not sensitive)
-- Already authenticated has access; keep just authenticated.

-- 7. Permissions for RPCs
REVOKE ALL ON FUNCTION public.get_diagnostic_questions(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_diagnostic_questions(int) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_diagnostic_session(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_diagnostic_session(text, int) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_diagnostic_answers(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_diagnostic_answers(uuid, text, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.set_diagnostic_lead(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_diagnostic_lead(uuid, text, text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_diagnostic_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_diagnostic_session(text) TO authenticated;

-- 8. Lock down trigger / admin-only DEFINER functions from being callable via API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_by_email(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_role_by_email(text, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_admins() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_diagnostic_sessions(int, int, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_diagnostic_overview() FROM PUBLIC, anon;
