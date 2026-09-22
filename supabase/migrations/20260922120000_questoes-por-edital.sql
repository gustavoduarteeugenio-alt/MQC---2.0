-- Cadastro de questões passa a acontecer dentro de um edital: a questão é
-- canônica e o vínculo exam_questions diz em qual edital ela vale e onde se
-- classifica na árvore de conteúdo.

-- ---------------------------------------------------------------------------
-- 1) subject_id deixa de ser obrigatório
--    A classificação agora vive em exam_questions.content_node_id. A coluna
--    continua por enquanto, porque o importador e os simulados antigos ainda
--    a preenchem; sai numa limpeza posterior.
-- ---------------------------------------------------------------------------
ALTER TABLE public.questions ALTER COLUMN subject_id DROP NOT NULL;

COMMENT ON COLUMN public.questions.subject_id IS
  'Legado do modelo de disciplina unica. A classificacao valida e exam_questions.content_node_id.';

-- ---------------------------------------------------------------------------
-- 2) Listagem para o painel, dentro de um edital
--    SECURITY DEFINER porque correct_answer e explanation têm SELECT revogado
--    em nível de coluna: só staff enxerga por aqui.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_exam_questions(
  _exam_id uuid,
  _node_ids uuid[] DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  statement text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  option_e text,
  correct_answer text,
  explanation text,
  difficulty text,
  year int,
  banca text,
  image_url text,
  comment_image_url text,
  content_node_id uuid,
  content_node_name text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico')) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT q.id, q.statement, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
         q.correct_answer::text, q.explanation, q.difficulty::text, q.year, q.banca,
         q.image_url, q.comment_image_url,
         eq.content_node_id, n.name, eq.status, q.created_at
    FROM public.exam_questions eq
    JOIN public.questions q ON q.id = eq.question_id
    LEFT JOIN public.content_nodes n ON n.id = eq.content_node_id
   WHERE eq.exam_id = _exam_id
     AND (_node_ids IS NULL OR eq.content_node_id = ANY(_node_ids))
     AND (_search IS NULL OR btrim(_search) = '' OR q.statement ILIKE '%' || btrim(_search) || '%')
   ORDER BY q.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(_limit, 200), 1), 1000);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_exam_questions(uuid, uuid[], text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_exam_questions(uuid, uuid[], text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Quantas questões existem em cada nó, para o painel mostrar o preenchimento
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_count_questions_by_node(_exam_id uuid)
RETURNS TABLE (content_node_id uuid, publicadas bigint, rascunhos bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico')) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT eq.content_node_id,
         count(*) FILTER (WHERE eq.status = 'published'),
         count(*) FILTER (WHERE eq.status = 'draft')
    FROM public.exam_questions eq
   WHERE eq.exam_id = _exam_id AND eq.content_node_id IS NOT NULL
   GROUP BY eq.content_node_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_count_questions_by_node(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_count_questions_by_node(uuid) TO authenticated;
