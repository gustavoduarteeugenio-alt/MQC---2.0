-- Um produto da Hotmart pode liberar mais de um edital.
--
-- O Método Questão Certa é vendido como um produto só: o método é o mesmo, e o
-- material didático muda conforme o edital pretendido. Quem compra entra nos
-- editais que o produto cobre e escolhe onde estudar dentro do app.
--
-- A chave deixa de ser o produto e passa a ser o par (produto, edital). Isso
-- também abre espaço para um combo no futuro, se os concursos virarem produtos
-- separados.

ALTER TABLE public.hotmart_products DROP CONSTRAINT IF EXISTS hotmart_products_pkey;
ALTER TABLE public.hotmart_products ADD PRIMARY KEY (product_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_hotmart_products_produto ON public.hotmart_products (product_id);

-- ---------------------------------------------------------------------------
-- Painel: uma linha por produto, com os editais que ele libera
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_hotmart_products();

CREATE OR REPLACE FUNCTION public.admin_hotmart_products()
RETURNS TABLE(product_id text, label text, exam_ids uuid[], exam_names text[], compras_ativas bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.product_id,
         max(p.label),
         array_agg(p.exam_id ORDER BY e.name),
         array_agg(e.name ORDER BY e.name),
         (SELECT COUNT(*) FROM public.hotmart_purchases hp
           WHERE hp.product_id = p.product_id AND hp.status = 'active' AND hp.access_until > now())
    FROM public.hotmart_products p
    JOIN public.exams e ON e.id = p.exam_id
   GROUP BY p.product_id
   ORDER BY max(p.label) NULLS LAST, p.product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_hotmart_products() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hotmart_products() TO authenticated;

-- ---------------------------------------------------------------------------
-- Define de uma vez quais editais um produto libera
--    Numa transação só: desmarcar um edital e marcar outro nunca deixa o
--    produto sem nenhum, nem duplicado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_hotmart_product(
  _product_id text,
  _label text,
  _exam_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid text := btrim(_product_id);
  _n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF _pid IS NULL OR _pid = '' THEN
    RAISE EXCEPTION 'Informe o ID do produto';
  END IF;
  IF _exam_ids IS NULL OR array_length(_exam_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Escolha ao menos um edital';
  END IF;

  DELETE FROM public.hotmart_products
   WHERE product_id = _pid AND NOT (exam_id = ANY(_exam_ids));

  INSERT INTO public.hotmart_products (product_id, exam_id, label)
  SELECT _pid, x, NULLIF(btrim(_label), '')
    FROM unnest(_exam_ids) AS x
  ON CONFLICT (product_id, exam_id) DO UPDATE SET label = EXCLUDED.label;

  SELECT COUNT(*) INTO _n FROM public.hotmart_products WHERE product_id = _pid;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_hotmart_product(text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_hotmart_product(text, text, uuid[]) TO authenticated;
