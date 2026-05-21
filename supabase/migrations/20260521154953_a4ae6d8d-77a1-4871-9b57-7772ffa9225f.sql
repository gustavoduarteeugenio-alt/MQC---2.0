CREATE OR REPLACE FUNCTION public.check_account_approved(email_input text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT approved FROM public.profiles WHERE lower(email) = lower(btrim(email_input)) LIMIT 1), false);
$$;

GRANT EXECUTE ON FUNCTION public.check_account_approved(text) TO anon, authenticated;