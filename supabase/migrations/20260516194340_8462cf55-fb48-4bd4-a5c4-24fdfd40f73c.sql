CREATE TABLE public.support_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('admin','user')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_replies_message ON public.support_replies(message_id, created_at);

ALTER TABLE public.support_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all replies"
  ON public.support_replies FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner views replies of own message"
  ON public.support_replies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_messages m WHERE m.id = message_id AND m.user_id = auth.uid()));

CREATE POLICY "Admins insert replies"
  ON public.support_replies FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND author_id = auth.uid() AND author_role = 'admin');

CREATE POLICY "Owner inserts replies on own message"
  ON public.support_replies FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND author_role = 'user'
    AND EXISTS (SELECT 1 FROM public.support_messages m WHERE m.id = message_id AND m.user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_replies;