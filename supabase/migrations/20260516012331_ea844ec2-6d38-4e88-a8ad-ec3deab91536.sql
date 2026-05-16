
-- Profiles: novos campos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS diagnostic_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS diagnostic_results jsonb;

-- Tabela diagnostic_sessions
CREATE TABLE IF NOT EXISTS public.diagnostic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  client_token text NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  results jsonb,
  total int NOT NULL DEFAULT 0,
  correct int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_client_token ON public.diagnostic_sessions(client_token);
CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_user_id ON public.diagnostic_sessions(user_id);

ALTER TABLE public.diagnostic_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can create their own session
CREATE POLICY "Anyone can create diagnostic session"
  ON public.diagnostic_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anyone can read/update by client_token (filtering happens via .eq('client_token', token) in query)
CREATE POLICY "Anyone can read diagnostic sessions"
  ON public.diagnostic_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update diagnostic sessions"
  ON public.diagnostic_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- updated_at trigger
CREATE TRIGGER trg_diagnostic_sessions_updated_at
  BEFORE UPDATE ON public.diagnostic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
