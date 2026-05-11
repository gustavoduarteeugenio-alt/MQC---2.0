
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS comment_image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated view question images" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload question images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update question images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete question images" ON storage.objects;

CREATE POLICY "Authenticated view question images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'question-images');

CREATE POLICY "Admins upload question images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'question-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'admin_didatico'::app_role))
);

CREATE POLICY "Admins update question images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'question-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'admin_didatico'::app_role))
);

CREATE POLICY "Admins delete question images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'question-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'admin_didatico'::app_role))
);
