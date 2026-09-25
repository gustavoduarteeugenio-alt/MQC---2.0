-- O aluno escolhe o concurso dentro do app.
--
-- A demanda se dividiu entre PMMG e CBMMG, e no momento da compra o aluno não
-- sabe que está escolhendo um edital: o primeiro comprador pegou o produto
-- pensando no bombeiro e cairia na Polícia Militar.
--
-- Agora o produto tem modo:
--   'liberar'  → a compra matricula em todos os editais mapeados (combo)
--   'escolher' → a compra dá direito a UM deles, e quem decide é o aluno
--
-- Nos dois casos os editais envolvidos são as linhas de hotmart_products.

ALTER TABLE public.hotmart_products
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'liberar';

ALTER TABLE public.hotmart_products DROP CONSTRAINT IF EXISTS hotmart_products_modo_check;
ALTER TABLE public.hotmart_products
  ADD CONSTRAINT hotmart_products_modo_check CHECK (modo IN ('liberar', 'escolher'));

COMMENT ON COLUMN public.hotmart_products.modo IS
  'liberar: matricula em todos os editais do produto. escolher: da direito a um, escolhido pelo aluno no app.';

-- ---------------------------------------------------------------------------
-- 1) A sincronização automática passa a valer só para o modo 'liberar'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_hotmart_enrollments(_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm text := lower(btrim(_email));
  _user_id uuid;
  _changed integer := 0;
  _n integer;
BEGIN
  IF _norm IS NULL OR _norm = '' THEN
    RETURN 0;
  END IF;

  SELECT u.id INTO _user_id FROM auth.users u WHERE lower(u.email) = _norm LIMIT 1;
  IF _user_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH ativas AS (
    SELECT hp.product_id, max(hp.access_until) AS access_until,
           (array_agg(hp.transaction ORDER BY hp.access_until DESC))[1] AS transaction
      FROM public.hotmart_purchases hp
     WHERE hp.email = _norm
       AND hp.status = 'active'
       AND hp.access_until > now()
     GROUP BY hp.product_id
  ),
  por_edital AS (
    SELECT p.exam_id, max(a.access_until) AS access_until,
           (array_agg(a.transaction ORDER BY a.access_until DESC))[1] AS transaction
      FROM ativas a
      JOIN public.hotmart_products p ON p.product_id = a.product_id
     -- No modo 'escolher' quem matricula é o aluno, em escolher_edital().
     WHERE p.modo = 'liberar'
     GROUP BY p.exam_id
  )
  INSERT INTO public.enrollments AS en (user_id, exam_id, access_until, source, hotmart_transaction)
  SELECT _user_id, pe.exam_id, pe.access_until, 'hotmart', pe.transaction
    FROM por_edital pe
  ON CONFLICT (user_id, exam_id) DO UPDATE
     SET access_until = EXCLUDED.access_until,
         hotmart_transaction = EXCLUDED.hotmart_transaction,
         updated_at = now()
   WHERE en.source = 'hotmart'
     AND (en.access_until IS DISTINCT FROM EXCLUDED.access_until
          OR en.hotmart_transaction IS DISTINCT FROM EXCLUDED.hotmart_transaction);

  GET DIAGNOSTICS _n = ROW_COUNT;
  _changed := _changed + _n;

  -- Reembolso, chargeback ou prazo vencido: a matrícula expira, não desaparece.
  -- Vale também para a que o aluno escolheu: o produto dela continua listando
  -- aquele edital, então enquanto a compra estiver ativa ela não expira.
  UPDATE public.enrollments en
     SET access_until = now(), updated_at = now()
   WHERE en.user_id = _user_id
     AND en.source = 'hotmart'
     AND (en.access_until IS NULL OR en.access_until > now())
     AND NOT EXISTS (
       SELECT 1
         FROM public.hotmart_purchases hp
         JOIN public.hotmart_products p ON p.product_id = hp.product_id
        WHERE hp.email = _norm
          AND hp.status = 'active'
          AND hp.access_until > now()
          AND p.exam_id = en.exam_id
     );

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _changed + _n;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_hotmart_enrollments(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_hotmart_enrollments(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) O que este aluno pode escolher
--    Vazio quando não há compra em modo 'escolher' sem escolha pendente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.editais_para_escolher()
RETURNS TABLE(exam_id uuid, nome text, instituicao text, sigla text, duracao_minutos int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _direitos int;
  _usados int;
BEGIN
  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = auth.uid();
  IF _email IS NULL THEN
    RETURN;
  END IF;

  -- Cada compra ativa de produto em modo 'escolher' dá direito a um edital.
  SELECT count(DISTINCT hp.transaction) INTO _direitos
    FROM public.hotmart_purchases hp
   WHERE hp.email = _email AND hp.status = 'active' AND hp.access_until > now()
     AND EXISTS (SELECT 1 FROM public.hotmart_products p
                  WHERE p.product_id = hp.product_id AND p.modo = 'escolher');

  SELECT count(*) INTO _usados
    FROM public.enrollments en
   WHERE en.user_id = auth.uid() AND en.source = 'hotmart'
     AND (en.access_until IS NULL OR en.access_until > now());

  IF _direitos <= _usados THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT e.id, e.name, i.name, i.sigla, e.duration_minutes
    FROM public.hotmart_purchases hp
    JOIN public.hotmart_products p ON p.product_id = hp.product_id AND p.modo = 'escolher'
    JOIN public.exams e ON e.id = p.exam_id
    JOIN public.contests c ON c.id = e.contest_id
    JOIN public.institutions i ON i.id = c.institution_id
   WHERE hp.email = _email AND hp.status = 'active' AND hp.access_until > now()
     -- não oferece o que ele já tem
     AND NOT EXISTS (SELECT 1 FROM public.enrollments en
                      WHERE en.user_id = auth.uid() AND en.exam_id = e.id
                        AND (en.access_until IS NULL OR en.access_until > now()))
   ORDER BY i.sigla, e.name;
END;
$$;

REVOKE ALL ON FUNCTION public.editais_para_escolher() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editais_para_escolher() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) O aluno escolhe
--    Revalida tudo no servidor: o cliente só manda o id do edital.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escolher_edital(_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _ate timestamptz;
  _transacao text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.editais_para_escolher() x WHERE x.exam_id = _exam_id) THEN
    RAISE EXCEPTION 'Este edital nao esta disponivel para a sua compra' USING ERRCODE = '42501';
  END IF;

  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = auth.uid();

  -- O prazo é o da compra que deu direito à escolha.
  SELECT max(hp.access_until),
         (array_agg(hp.transaction ORDER BY hp.access_until DESC))[1]
    INTO _ate, _transacao
    FROM public.hotmart_purchases hp
    JOIN public.hotmart_products p ON p.product_id = hp.product_id AND p.modo = 'escolher'
   WHERE hp.email = _email AND hp.status = 'active' AND hp.access_until > now()
     AND p.exam_id = _exam_id;

  INSERT INTO public.enrollments (user_id, exam_id, access_until, source, hotmart_transaction)
  VALUES (auth.uid(), _exam_id, _ate, 'hotmart', _transacao)
  ON CONFLICT (user_id, exam_id) DO UPDATE
     SET access_until = EXCLUDED.access_until, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'exam_id', _exam_id, 'access_until', _ate);
END;
$$;

REVOKE ALL ON FUNCTION public.escolher_edital(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.escolher_edital(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Painel: o modo entra na listagem e no cadastro
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_hotmart_products();

CREATE OR REPLACE FUNCTION public.admin_hotmart_products()
RETURNS TABLE(product_id text, label text, modo text, exam_ids uuid[], exam_names text[], compras_ativas bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.product_id,
         max(p.label),
         max(p.modo),
         array_agg(p.exam_id ORDER BY e.name),
         array_agg(e.name ORDER BY e.name),
         (SELECT COUNT(*) FROM public.hotmart_purchases hp
           WHERE hp.product_id = p.product_id AND hp.status = 'active' AND hp.access_until > now())
    FROM public.hotmart_products p
    JOIN public.exams e ON e.id = p.exam_id
   GROUP BY p.product_id
   ORDER BY max(p.label) NULLS LAST, p.product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_hotmart_products() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hotmart_products() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_hotmart_product(
  _product_id text,
  _label text,
  _exam_ids uuid[],
  _modo text DEFAULT 'liberar'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid text := btrim(_product_id);
  _n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF _pid IS NULL OR _pid = '' THEN
    RAISE EXCEPTION 'Informe o ID do produto';
  END IF;
  IF _exam_ids IS NULL OR array_length(_exam_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Escolha ao menos um edital';
  END IF;
  IF _modo NOT IN ('liberar', 'escolher') THEN
    RAISE EXCEPTION 'Modo invalido: %', _modo;
  END IF;

  DELETE FROM public.hotmart_products
   WHERE product_id = _pid AND NOT (exam_id = ANY(_exam_ids));

  INSERT INTO public.hotmart_products (product_id, exam_id, label, modo)
  SELECT _pid, x, NULLIF(btrim(_label), ''), _modo
    FROM unnest(_exam_ids) AS x
  ON CONFLICT (product_id, exam_id) DO UPDATE
     SET label = EXCLUDED.label, modo = EXCLUDED.modo;

  SELECT COUNT(*) INTO _n FROM public.hotmart_products WHERE product_id = _pid;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_hotmart_product(text, text, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_hotmart_product(text, text, uuid[], text) TO authenticated;
