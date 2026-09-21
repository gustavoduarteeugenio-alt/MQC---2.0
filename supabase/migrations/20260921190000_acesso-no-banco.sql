-- MQC 2.0: o conteúdo passa a exigir acesso no banco, não só na interface.
--
-- Antes, qualquer conta autenticada lia questões, disciplinas e simulados, mesmo
-- sem compra ou com o prazo de 1 ano vencido: o bloqueio existia apenas no app
-- (ProtectedRoute e telas). Quem usasse a API direto contornava.

-- ---------------------------------------------------------------------------
-- 1) Regra única de acesso, agora no banco.
--    Espelha hasActiveAccess + isStaff de src/lib/access.ts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_app_access(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = _user_id
         AND p.approved
         AND (p.access_until IS NULL OR p.access_until > now())
    )
    OR public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'admin_didatico')
  );
$$;

REVOKE ALL ON FUNCTION public.has_app_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_app_access(uuid) TO authenticated;

COMMENT ON FUNCTION public.has_app_access(uuid) IS
  'Compra ativa e no prazo, ou papel de staff. Usada nas policies de conteúdo.';

-- ---------------------------------------------------------------------------
-- 2) Leitura de conteúdo exige acesso
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read subjects" ON public.subjects;
CREATE POLICY "Com acesso le disciplinas"
  ON public.subjects FOR SELECT TO authenticated
  USING (public.has_app_access());

DROP POLICY IF EXISTS "Authenticated read questions" ON public.questions;
CREATE POLICY "Com acesso le questoes"
  ON public.questions FOR SELECT TO authenticated
  USING (public.has_app_access());

DROP POLICY IF EXISTS "Authenticated read simulados" ON public.simulados;
CREATE POLICY "Com acesso le simulados"
  ON public.simulados FOR SELECT TO authenticated
  USING (public.has_app_access());

DROP POLICY IF EXISTS "Authenticated read simulado_questions" ON public.simulado_questions;
CREATE POLICY "Com acesso le simulado_questions"
  ON public.simulado_questions FOR SELECT TO authenticated
  USING (public.has_app_access());

-- ---------------------------------------------------------------------------
-- 3) Registrar respostas também exige acesso
--    (sem isso, uma conta vencida continuaria gravando tentativas)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users insert own attempts" ON public.attempts;
CREATE POLICY "Com acesso insere proprias tentativas"
  ON public.attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_app_access());

DROP POLICY IF EXISTS "Users insert own simulado_attempts" ON public.simulado_attempts;
CREATE POLICY "Com acesso insere proprio simulado_attempt"
  ON public.simulado_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_app_access());

-- ---------------------------------------------------------------------------
-- 4) RPCs SECURITY DEFINER ignoram RLS: a checagem entra no corpo.
--    reveal_* é o caso mais sensível — devolve gabarito e comentário.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reveal_question_answer(_qid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_app_access() THEN
    RAISE EXCEPTION 'Sem acesso ao conteudo' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.reveal_questions_answers(_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_app_access() THEN
    RAISE EXCEPTION 'Sem acesso ao conteudo' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.list_published_simulados()
RETURNS TABLE(id uuid, name text, description text, created_at timestamptz, question_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_app_access() THEN
    RAISE EXCEPTION 'Sem acesso ao conteudo' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT s.id, s.name, s.description, s.created_at,
    (SELECT COUNT(*) FROM public.simulado_questions sq WHERE sq.simulado_id = s.id) AS question_count
  FROM public.simulados s
  WHERE EXISTS (SELECT 1 FROM public.simulado_questions sq WHERE sq.simulado_id = s.id)
  ORDER BY s.created_at DESC;
END;
$$;
