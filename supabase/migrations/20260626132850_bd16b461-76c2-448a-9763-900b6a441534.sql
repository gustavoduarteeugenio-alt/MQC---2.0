
DROP POLICY IF EXISTS "Anyone can create access ticket" ON public.tickets_suporte;

CREATE POLICY "Public can submit access ticket"
  ON public.tickets_suporte
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email_usuario IS NOT NULL
    AND length(btrim(email_usuario)) BETWEEN 3 AND 200
    AND email_usuario ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND mensagem IS NOT NULL
    AND length(btrim(mensagem)) BETWEEN 1 AND 2000
    AND status_resolvido = false
    AND resolved_at IS NULL
    AND resolved_by IS NULL
  );
