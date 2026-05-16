
CREATE TABLE public.tickets_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  email_usuario text NOT NULL,
  mensagem text NOT NULL,
  status_resolvido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  resolved_by uuid NULL
);

ALTER TABLE public.tickets_suporte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create access ticket"
  ON public.tickets_suporte FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins view all access tickets"
  ON public.tickets_suporte FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update access tickets"
  ON public.tickets_suporte FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_tickets_suporte_created_at ON public.tickets_suporte (created_at DESC);
CREATE INDEX idx_tickets_suporte_status ON public.tickets_suporte (status_resolvido);
