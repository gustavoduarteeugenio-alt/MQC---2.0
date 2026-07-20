
-- ============================================================
-- diagnostic_sessions: remove direct INSERT/DELETE grants from
-- anon/authenticated. Inserts must go through the SECURITY DEFINER
-- RPC create_diagnostic_session(); updates keep their RLS-scoped grant.
-- ============================================================
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.diagnostic_sessions FROM anon, authenticated;
REVOKE SELECT, UPDATE ON public.diagnostic_sessions FROM anon;

-- Keep only what the existing RLS policies need for authenticated:
GRANT SELECT, UPDATE ON public.diagnostic_sessions TO authenticated;
GRANT ALL ON public.diagnostic_sessions TO service_role;

-- Explicit deny policy documenting intent: no direct INSERT/DELETE from clients.
DROP POLICY IF EXISTS "No direct insert on diagnostic_sessions" ON public.diagnostic_sessions;
CREATE POLICY "No direct insert on diagnostic_sessions"
  ON public.diagnostic_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct delete on diagnostic_sessions" ON public.diagnostic_sessions;
CREATE POLICY "No direct delete on diagnostic_sessions"
  ON public.diagnostic_sessions
  FOR DELETE
  TO anon, authenticated
  USING (false);

-- ============================================================
-- questions: re-affirm that correct_answer/explanation are never
-- selectable by anon/authenticated. Column-level SELECT grants are
-- listed explicitly for safe columns only.
-- ============================================================
REVOKE SELECT ON public.questions FROM anon, authenticated;
REVOKE SELECT (correct_answer, explanation) ON public.questions FROM anon, authenticated, public;

GRANT SELECT (
  id, subject_id, statement,
  option_a, option_b, option_c, option_d, option_e,
  image_url, difficulty, year, banca, subtopic,
  created_at, updated_at
) ON public.questions TO authenticated;

GRANT SELECT (
  id, subject_id, statement,
  option_a, option_b, option_c, option_d, option_e,
  image_url, difficulty, year, banca, subtopic,
  created_at, updated_at
) ON public.questions TO anon;

-- comment_image_url stays authenticated-only (it may leak solution context)
GRANT SELECT (comment_image_url) ON public.questions TO authenticated;

-- Ensure admin write paths still work
GRANT INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
