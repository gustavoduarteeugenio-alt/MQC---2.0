-- Fecha o bucket de imagens das questões.
--
-- O bucket question-images era público: qualquer pessoa com o link via a
-- imagem, sem login e sem ter comprado. Como a imagem costuma ser parte do
-- enunciado (mapa, gráfico, figura), isso vazava conteúdo do produto.
--
-- Agora o bucket é privado e o app passa a pedir uma URL assinada, de curta
-- duração, que só é emitida para quem tem acesso ativo.

UPDATE storage.buckets SET public = false WHERE id = 'question-images';

-- Leitura: staff sempre; aluno, só com acesso ativo.
-- Sem esta policy o createSignedUrl do app falha, porque assinar exige poder
-- ler o objeto.
DROP POLICY IF EXISTS "Authenticated view question images" ON storage.objects;
DROP POLICY IF EXISTS "Com acesso le imagens de questao" ON storage.objects;
CREATE POLICY "Com acesso le imagens de questao"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'question-images'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_didatico'::app_role)
    OR public.has_app_access()
  )
);

-- Escrita continua restrita ao staff (policies de 20260511214009 seguem valendo;
-- recriadas aqui para a migration ser autossuficiente).
DROP POLICY IF EXISTS "Admins upload question images" ON storage.objects;
CREATE POLICY "Admins upload question images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'question-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'admin_didatico'::app_role))
);

DROP POLICY IF EXISTS "Admins update question images" ON storage.objects;
CREATE POLICY "Admins update question images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'question-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'admin_didatico'::app_role))
);

DROP POLICY IF EXISTS "Admins delete question images" ON storage.objects;
CREATE POLICY "Admins delete question images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'question-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'admin_didatico'::app_role))
);
