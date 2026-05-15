CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own support messages"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own support messages"
ON public.support_messages FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all support messages"
ON public.support_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update support messages"
ON public.support_messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_support_messages_updated_at
BEFORE UPDATE ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_support_messages_status ON public.support_messages(status);
CREATE INDEX idx_support_messages_created_at ON public.support_messages(created_at DESC);