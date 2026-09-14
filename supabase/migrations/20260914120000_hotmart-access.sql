-- MQC 2.0: o app não tem funil próprio. O aluno compra o curso na Hotmart e o
-- acesso é liberado/retirado automaticamente pelo webhook, valendo 1 ano a
-- partir da aprovação da compra.
--
-- Regra de acesso: profiles.approved AND (access_until IS NULL OR access_until > now())
-- access_until NULL = liberação antiga, sem prazo.

-- ---------------------------------------------------------------------------
-- 0) Prazo do acesso no perfil
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_until timestamptz;

COMMENT ON COLUMN public.profiles.access_until IS
  'Fim do acesso ao app (1 ano após a compra). NULL = sem prazo (liberações anteriores à Hotmart).';

-- ---------------------------------------------------------------------------
-- 1) Aluno não pode mais alterar colunas de acesso do próprio perfil.
--    A policy "Users update own profile" liberava UPDATE em qualquer coluna,
--    permitindo que o próprio aluno marcasse approved = true.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_access_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Só requisições diretas do app (PostgREST) são restringidas; funções
  -- SECURITY DEFINER e service_role rodam com outro current_user.
  IF current_user IN ('anon', 'authenticated') AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.approved := false;
      NEW.access_until := NULL;
    ELSIF NEW.approved IS DISTINCT FROM OLD.approved
       OR NEW.access_until IS DISTINCT FROM OLD.access_until
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.premium_until IS DISTINCT FROM OLD.premium_until
       OR NEW.premium_since IS DISTINCT FROM OLD.premium_since
       OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at THEN
      RAISE EXCEPTION 'Sem permissão para alterar dados de acesso do perfil'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_access_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_access_columns ON public.profiles;
CREATE TRIGGER protect_profile_access_columns
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_access_columns();

-- ---------------------------------------------------------------------------
-- 2) Compras da Hotmart (uma linha por transação) e log de eventos recebidos.
--    Guardamos só os campos necessários, sem o payload bruto (CPF, telefone...).
-- ---------------------------------------------------------------------------
CREATE TABLE public.hotmart_purchases (
  transaction text PRIMARY KEY,
  email text NOT NULL,
  buyer_name text,
  product_id text,
  purchase_status text,
  status text NOT NULL CHECK (status IN ('active', 'revoked')),
  approved_at timestamptz,
  access_until timestamptz,
  last_event text NOT NULL,
  last_event_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hotmart_purchases_email ON public.hotmart_purchases (email);
CREATE INDEX idx_hotmart_purchases_updated_at ON public.hotmart_purchases (updated_at DESC);

CREATE TABLE public.hotmart_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotmart_event_id text UNIQUE,
  event text NOT NULL,
  action text NOT NULL CHECK (action IN ('grant', 'revoke', 'ignore')),
  transaction text,
  email text,
  product_id text,
  purchase_status text,
  event_at timestamptz NOT NULL,
  applied boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hotmart_webhook_events_received_at ON public.hotmart_webhook_events (received_at DESC);

ALTER TABLE public.hotmart_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotmart_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hotmart_purchases FROM anon, authenticated;
REVOKE ALL ON public.hotmart_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.hotmart_purchases TO authenticated;
GRANT SELECT ON public.hotmart_webhook_events TO authenticated;
GRANT ALL ON public.hotmart_purchases TO service_role;
GRANT ALL ON public.hotmart_webhook_events TO service_role;

CREATE POLICY "Admins view hotmart purchases"
  ON public.hotmart_purchases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view hotmart webhook events"
  ON public.hotmart_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 3) Sincroniza o acesso do perfil com as compras ativas e dentro do prazo.
--    Várias compras (recompra/renovação): vale o prazo que termina por último.
--    Casa pelo e-mail de auth.users (fonte da verdade), não pelo de profiles.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_hotmart_access(_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm text := lower(btrim(_email));
  _until timestamptz;
  _has_active boolean;
  _changed integer;
BEGIN
  IF _norm IS NULL OR _norm = '' THEN
    RETURN 0;
  END IF;

  SELECT max(access_until) INTO _until
    FROM public.hotmart_purchases
   WHERE email = _norm AND status = 'active' AND access_until > now();
  _has_active := _until IS NOT NULL;

  UPDATE public.profiles p
     SET approved = _has_active,
         access_until = _until
    FROM auth.users u
   WHERE u.id = p.user_id
     AND lower(u.email) = _norm
     AND (p.approved IS DISTINCT FROM _has_active OR p.access_until IS DISTINCT FROM _until);

  GET DIAGNOSTICS _changed = ROW_COUNT;
  RETURN _changed;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_hotmart_access(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_hotmart_access(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Aplica um evento do webhook de forma atômica e idempotente.
--    Chamado apenas pela Edge Function hotmart-webhook (service_role).
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
    RETURN jsonb_build_object('duplicate', true, 'applied', false, 'profiles_changed', 0);
  END IF;

  IF _action = 'ignore' OR _transaction IS NULL OR _norm IS NULL OR _norm = '' THEN
    RETURN jsonb_build_object('duplicate', false, 'applied', false, 'profiles_changed', 0);
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
    IF _old_email IS NOT NULL AND _old_email <> _norm THEN
      _profiles_changed := _profiles_changed + public.sync_hotmart_access(_old_email);
    END IF;
  END IF;

  RETURN jsonb_build_object('duplicate', false, 'applied', _applied, 'profiles_changed', _profiles_changed);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_hotmart_event(text, text, text, text, text, text, text, text, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_hotmart_event(text, text, text, text, text, text, text, text, timestamptz, timestamptz)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Listagem para o painel admin, indicando se o comprador já criou conta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_hotmart_purchases(_limit integer DEFAULT 500)
RETURNS TABLE (
  transaction text,
  email text,
  buyer_name text,
  product_id text,
  status text,
  access_until timestamptz,
  last_event text,
  updated_at timestamptz,
  has_account boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT hp.transaction, hp.email, hp.buyer_name, hp.product_id, hp.status, hp.access_until,
         hp.last_event, hp.updated_at,
         EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = hp.email)
    FROM public.hotmart_purchases hp
   ORDER BY hp.updated_at DESC
   LIMIT LEAST(GREATEST(COALESCE(_limit, 500), 1), 2000);
END;
$$;

REVOKE ALL ON FUNCTION public.list_hotmart_purchases(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_hotmart_purchases(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Cadastro já nasce liberado quando o e-mail tem compra ativa e no prazo
--    (caso em que o aluno compra antes de criar a conta).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7) Polling da tela de login passa a respeitar o prazo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_account_approved(email_input text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT approved AND (access_until IS NULL OR access_until > now())
      FROM public.profiles
     WHERE lower(email) = lower(btrim(email_input))
     LIMIT 1
  ), false);
$$;
