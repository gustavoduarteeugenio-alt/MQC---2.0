
-- Simulados (mock exams)
CREATE TABLE public.simulados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read simulados"
  ON public.simulados FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage simulados"
  ON public.simulados FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_simulados_updated_at
  BEFORE UPDATE ON public.simulados FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Questions in a fixed simulado
CREATE TABLE public.simulado_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  UNIQUE (simulado_id, question_id)
);

ALTER TABLE public.simulado_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read simulado_questions"
  ON public.simulado_questions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage simulado_questions"
  ON public.simulado_questions FOR ALL USING (has_role(auth.uid(), 'admin'));

-- User's simulado attempts (history)
CREATE TABLE public.simulado_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  simulado_id uuid REFERENCES public.simulados(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('fixed','random')),
  title text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_seconds integer,
  total integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  by_subject jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.simulado_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own simulado_attempts"
  ON public.simulado_attempts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own simulado_attempts"
  ON public.simulado_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own simulado_attempts"
  ON public.simulado_attempts FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_simulado_attempts_user ON public.simulado_attempts(user_id, started_at DESC);
