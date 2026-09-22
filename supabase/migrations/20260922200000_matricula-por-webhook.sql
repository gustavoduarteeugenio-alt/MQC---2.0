-- A compra na Hotmart passa a virar matrícula no edital do produto.
--
-- Antes o webhook só ligava profiles.approved: o aluno tinha "acesso ao app",
-- sem dizer a qual concurso. Agora cada produto aponta para um edital
-- (hotmart_products) e a compra cria a matrícula correspondente.
--
-- Regras que valem aqui:
--   · matrícula de staff e as criadas à mão nunca são tocadas (source='manual')
--   · perder a compra não apaga a matrícula: ela expira (access_until = now()),
--     preservando o histórico e permitindo recompra
--   · produto sem mapeamento não cria matrícula, e isso fica registrado

-- ---------------------------------------------------------------------------
-- 1) Sincroniza as matrículas de um e-mail a partir das compras dele
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

  -- Sem conta criada ainda não há o que matricular: o gatilho de cadastro
  -- (handle_new_user) chama esta função de novo quando o aluno se registrar.
  SELECT u.id INTO _user_id FROM auth.users u WHERE lower(u.email) = _norm LIMIT 1;
  IF _user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Compras ativas, agrupadas pelo edital do produto
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
     GROUP BY p.exam_id
  )
  INSERT INTO public.enrollments AS en (user_id, exam_id, access_until, source, hotmart_transaction)
  SELECT _user_id, pe.exam_id, pe.access_until, 'hotmart', pe.transaction
    FROM por_edital pe
  ON CONFLICT (user_id, exam_id) DO UPDATE
     SET access_until = EXCLUDED.access_until,
         hotmart_transaction = EXCLUDED.hotmart_transaction,
         updated_at = now()
   -- Matrícula manual é decisão humana: o webhook não mexe nela.
   WHERE en.source = 'hotmart'
     AND (en.access_until IS DISTINCT FROM EXCLUDED.access_until
          OR en.hotmart_transaction IS DISTINCT FROM EXCLUDED.hotmart_transaction);

  GET DIAGNOSTICS _n = ROW_COUNT;
  _changed := _changed + _n;

  -- Reembolso, chargeback ou prazo vencido: a matrícula expira, não desaparece.
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
-- 2) O evento do webhook passa a sincronizar matrícula também
--    Mesmo corpo de antes; muda só o trecho final, que agora chama as duas
--    sincronizações e informa quantas matrículas mudaram.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_hotmart_event(
  _hotmart_event_id text,
  _event text,
  _action text,
  _transaction text,
  _email text,
  _buyer_name text,
  _product_id text,
  _purchase_status text,
  _event_at timestamptz,
  _approved_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm text := lower(btrim(_email));
  _log_id uuid;
  _old_email text;
  _grant_at timestamptz;
  _applied boolean := false;
  _profiles_changed integer := 0;
  _enrollments_changed integer := 0;
  _mapped boolean := false;
BEGIN
  IF _action NOT IN ('grant', 'revoke', 'ignore') THEN
    RAISE EXCEPTION 'Ação inválida: %', _action;
  END IF;

  -- Reenvio do mesmo evento pela Hotmart: não processa de novo
  INSERT INTO public.hotmart_webhook_events
    (hotmart_event_id, event, action, transaction, email, product_id, purchase_status, event_at)
  VALUES
    (_hotmart_event_id, _event, _action, _transaction, _norm, _product_id, _purchase_status, _event_at)
  ON CONFLICT (hotmart_event_id) DO NOTHING
  RETURNING id INTO _log_id;

  IF _log_id IS NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'applied', false,
                              'profiles_changed', 0, 'enrollments_changed', 0);
  END IF;

  IF _action = 'ignore' OR _transaction IS NULL OR _norm IS NULL OR _norm = '' THEN
    RETURN jsonb_build_object('duplicate', false, 'applied', false,
                              'profiles_changed', 0, 'enrollments_changed', 0);
  END IF;

  SELECT email INTO _old_email FROM public.hotmart_purchases WHERE transaction = _transaction;

  -- O prazo de 1 ano conta da aprovação da compra (não do PURCHASE_COMPLETE,
  -- que chega depois); por isso approved_at/access_until nunca são sobrescritos.
  _grant_at := CASE WHEN _action = 'grant' THEN COALESCE(_approved_at, _event_at) END;

  -- Só aplica se o evento for mais recente que o último já aplicado
  -- (a Hotmart pode entregar eventos fora de ordem ao reenviar)
  INSERT INTO public.hotmart_purchases AS hp
    (transaction, email, buyer_name, product_id, purchase_status, status,
     approved_at, access_until, last_event, last_event_at)
  VALUES
    (_transaction, _norm, _buyer_name, _product_id, _purchase_status,
     CASE WHEN _action = 'grant' THEN 'active' ELSE 'revoked' END,
     _grant_at, _grant_at + interval '1 year', _event, _event_at)
  ON CONFLICT (transaction) DO UPDATE
     SET email = EXCLUDED.email,
         buyer_name = COALESCE(EXCLUDED.buyer_name, hp.buyer_name),
         product_id = COALESCE(EXCLUDED.product_id, hp.product_id),
         purchase_status = COALESCE(EXCLUDED.purchase_status, hp.purchase_status),
         status = EXCLUDED.status,
         approved_at = COALESCE(hp.approved_at, EXCLUDED.approved_at),
         access_until = COALESCE(hp.access_until, EXCLUDED.access_until),
         last_event = EXCLUDED.last_event,
         last_event_at = EXCLUDED.last_event_at,
         updated_at = now()
   WHERE hp.last_event_at <= EXCLUDED.last_event_at;

  _applied := FOUND;

  IF _applied THEN
    UPDATE public.hotmart_webhook_events SET applied = true WHERE id = _log_id;
    _profiles_changed := public.sync_hotmart_access(_norm);
    _enrollments_changed := public.sync_hotmart_enrollments(_norm);
    IF _old_email IS NOT NULL AND _old_email <> _norm THEN
      _profiles_changed := _profiles_changed + public.sync_hotmart_access(_old_email);
      _enrollments_changed := _enrollments_changed + public.sync_hotmart_enrollments(_old_email);
    END IF;
  END IF;

  -- Produto sem edital mapeado: o acesso genérico entra, mas não há matrícula.
  -- Fica no retorno para aparecer no log da Edge Function.
  _mapped := _product_id IS NOT NULL
             AND EXISTS (SELECT 1 FROM public.hotmart_products WHERE product_id = _product_id);

  RETURN jsonb_build_object('duplicate', false, 'applied', _applied,
                            'profiles_changed', _profiles_changed,
                            'enrollments_changed', _enrollments_changed,
                            'product_mapped', _mapped);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_hotmart_event(text, text, text, text, text, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_hotmart_event(text, text, text, text, text, text, text, text, timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Quem compra antes de criar a conta também precisa ser matriculado
--    A compra chega primeiro, o cadastro depois: o gatilho fecha essa ordem.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _until timestamptz;
BEGIN
  SELECT max(access_until) INTO _until
    FROM public.hotmart_purchases
   WHERE email = lower(btrim(NEW.email)) AND status = 'active' AND access_until > now();

  INSERT INTO public.profiles (user_id, full_name, email, plan, origem, trial_started_at, approved, access_until)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'basic',
    NEW.raw_user_meta_data->>'origem',
    now(),
    _until IS NOT NULL,
    _until
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  -- Agora que a conta existe, as compras dela viram matrícula.
  PERFORM public.sync_hotmart_enrollments(NEW.email);
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Painel: administrar o mapeamento produto → edital
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff manage hotmart_products" ON public.hotmart_products;
CREATE POLICY "Staff manage hotmart_products"
  ON public.hotmart_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Quais produtos vendem qual edital, com quantas compras ativas cada um.
CREATE OR REPLACE FUNCTION public.admin_hotmart_products()
RETURNS TABLE(product_id text, label text, exam_id uuid, exam_name text, compras_ativas bigint)
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
  SELECT p.product_id, p.label, p.exam_id, e.name,
         (SELECT COUNT(*) FROM public.hotmart_purchases hp
           WHERE hp.product_id = p.product_id AND hp.status = 'active' AND hp.access_until > now())
    FROM public.hotmart_products p
    JOIN public.exams e ON e.id = p.exam_id
   ORDER BY e.name, p.product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_hotmart_products() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hotmart_products() TO authenticated;

-- Compras cujo produto ainda não aponta para nenhum edital: são as vendas que
-- entraram sem matrícula e precisam de mapeamento.
CREATE OR REPLACE FUNCTION public.admin_unmapped_hotmart_products()
RETURNS TABLE(product_id text, compras bigint, ultima_compra timestamptz)
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
  SELECT hp.product_id, COUNT(*), max(hp.created_at)
    FROM public.hotmart_purchases hp
   WHERE hp.product_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.hotmart_products p WHERE p.product_id = hp.product_id)
   GROUP BY hp.product_id
   ORDER BY max(hp.created_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unmapped_hotmart_products() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_unmapped_hotmart_products() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Reprocessa matrículas de quem já comprou antes deste mapeamento existir
--    Roda depois de cadastrar um produto novo em hotmart_products.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resync_hotmart_enrollments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _total integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  FOR _email IN SELECT DISTINCT email FROM public.hotmart_purchases WHERE email IS NOT NULL LOOP
    _total := _total + public.sync_hotmart_enrollments(_email);
  END LOOP;

  RETURN _total;
END;
$$;

REVOKE ALL ON FUNCTION public.resync_hotmart_enrollments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resync_hotmart_enrollments() TO authenticated;
