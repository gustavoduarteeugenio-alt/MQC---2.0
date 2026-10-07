-- Staff sempre matriculado em todos os editais.
--
-- A fase 1 matriculou o staff que existia naquele momento. Quem foi promovido
-- depois não recebeu nada — e com a tela de escolha de concurso isso virou um
-- beco: o app manda escolher, não há compra, e devolve para "sem acesso".
--
-- Agora a matrícula acompanha o papel e os editais: promoveu, matriculou;
-- criou um edital novo, o staff entra nele também.

-- ---------------------------------------------------------------------------
-- 1) Matrícula de staff para um usuário, em todos os editais
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matricular_staff(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN 0;
  END IF;
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'admin_didatico')) THEN
    RETURN 0;
  END IF;

  -- source 'manual' e sem prazo: é acesso de trabalho, não compra. E 'manual'
  -- protege a linha do webhook, que só mexe nas de origem 'hotmart'.
  INSERT INTO public.enrollments (user_id, exam_id, source)
  SELECT _user_id, e.id, 'manual' FROM public.exams e
  ON CONFLICT (user_id, exam_id) DO NOTHING;

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.matricular_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.matricular_staff(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Promoveu, matriculou
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_matricular_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('admin', 'admin_didatico') THEN
    PERFORM public.matricular_staff(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matricular_staff_ao_promover ON public.user_roles;
CREATE TRIGGER matricular_staff_ao_promover
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_matricular_staff();

-- ---------------------------------------------------------------------------
-- 3) Edital novo entra para todo o staff
--    Sem isto, quem cadastrar o terceiro concurso não o enxerga no app.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_matricular_staff_no_edital()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.enrollments (user_id, exam_id, source)
  SELECT ur.user_id, NEW.id, 'manual'
    FROM public.user_roles ur
   WHERE ur.role IN ('admin', 'admin_didatico')
   GROUP BY ur.user_id
  ON CONFLICT (user_id, exam_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matricular_staff_em_edital_novo ON public.exams;
CREATE TRIGGER matricular_staff_em_edital_novo
  AFTER INSERT ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.trg_matricular_staff_no_edital();

-- ---------------------------------------------------------------------------
-- 4) Acerta quem já está promovido e sem matrícula — o caso que apareceu
-- ---------------------------------------------------------------------------
INSERT INTO public.enrollments (user_id, exam_id, source)
SELECT ur.user_id, e.id, 'manual'
  FROM public.user_roles ur
 CROSS JOIN public.exams e
 WHERE ur.role IN ('admin', 'admin_didatico')
ON CONFLICT (user_id, exam_id) DO NOTHING;
