
CREATE OR REPLACE FUNCTION public.grant_role_by_email(_email text, _role app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _role = 'user' THEN
    RAISE EXCEPTION 'cannot grant base user role';
  END IF;

  SELECT user_id INTO _uid FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário não encontrado com esse e-mail.');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'user_id', _uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_role(_user_id uuid, _role app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _user_id = auth.uid() AND _role = 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Você não pode remover seu próprio acesso de admin.');
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_staff()
RETURNS TABLE(user_id uuid, email text, full_name text, role app_role, granted_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ur.user_id, p.email, p.full_name, ur.role, ur.created_at
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin','admin_didatico')
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY ur.created_at DESC;
$$;
