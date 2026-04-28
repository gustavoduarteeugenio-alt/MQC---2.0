-- RPC: list admins (admins only)
CREATE OR REPLACE FUNCTION public.list_admins()
RETURNS TABLE(user_id uuid, email text, full_name text, granted_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id, p.email, p.full_name, ur.created_at
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'admin'
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY ur.created_at DESC;
$$;

-- RPC: grant admin by email (admins only)
CREATE OR REPLACE FUNCTION public.grant_admin_by_email(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT user_id INTO _uid FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não encontrado com esse e-mail.');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'user_id', _uid);
END;
$$;

-- RPC: revoke admin (admins only, can't revoke self)
CREATE OR REPLACE FUNCTION public.revoke_admin(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Você não pode remover seu próprio acesso de admin.');
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
  RETURN jsonb_build_object('ok', true);
END;
$$;