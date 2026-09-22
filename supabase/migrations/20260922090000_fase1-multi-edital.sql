-- MQC 2.0 — Fase 1: estrutura multi-edital.
--
-- Aditiva de propósito: cria instituição, concurso, edital, hierarquia de
-- conteúdo, vínculo questão↔edital e matrícula AO LADO do modelo atual, sem
-- mexer em subjects/questions/profiles. Assim o app em produção continua
-- funcionando, e a troca da regra de acesso vem numa migration seguinte,
-- junto com o frontend.
--
-- Traz também as árvores de conteúdo dos dois editais, extraídas dos PDFs:
-- PMMG (Edital DRH/CRS nº 10/2024) e CBMMG (Edital nº 10/2026).

-- ---------------------------------------------------------------------------
-- 1) Espinha dorsal
-- ---------------------------------------------------------------------------
CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sigla text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);

CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  year int,
  edital_ref text,
  duration_minutes int NOT NULL DEFAULT 240,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.exams IS 'O edital: unidade de isolamento de conteudo, questoes, estatistica e ranking.';

-- Hierarquia de conteúdo. parent_id permite qualquer profundidade; a aplicação
-- limita a 3 níveis por enquanto (disciplina > tópico > subtópico).
CREATE TABLE public.content_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.content_nodes(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 1 AND 3),
  display_order int NOT NULL DEFAULT 0,
  weight int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, parent_id, slug)
);
COMMENT ON COLUMN public.content_nodes.weight IS 'Quantidade de questoes da disciplina na prova oficial (nivel 1).';
CREATE INDEX idx_content_nodes_exam ON public.content_nodes (exam_id, level, display_order);
CREATE INDEX idx_content_nodes_parent ON public.content_nodes (parent_id);

-- Vínculo questão ↔ edital: a questão é canônica e pode valer em vários editais,
-- com classificação própria em cada um.
CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  content_node_id uuid REFERENCES public.content_nodes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, question_id)
);
CREATE INDEX idx_exam_questions_exam_status ON public.exam_questions (exam_id, status);
CREATE INDEX idx_exam_questions_node ON public.exam_questions (content_node_id);

-- Matrícula: o acesso passa a ser por edital, não global.
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  access_until timestamptz,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('hotmart', 'manual')),
  hotmart_transaction text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exam_id)
);
CREATE INDEX idx_enrollments_user ON public.enrollments (user_id);

-- Qual produto da Hotmart dá acesso a qual edital.
CREATE TABLE public.hotmart_products (
  product_id text PRIMARY KEY,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2) Acesso por edital
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_exam_access(_exam_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.enrollments e
       WHERE e.user_id = _user_id AND e.exam_id = _exam_id
         AND (e.access_until IS NULL OR e.access_until > now())
    )
    OR public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'admin_didatico')
  );
$$;

REVOKE ALL ON FUNCTION public.has_exam_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_exam_access(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotmart_products ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.institutions, public.contests, public.exams, public.content_nodes,
  public.exam_questions, public.enrollments, public.hotmart_products FROM anon, authenticated;
GRANT SELECT ON public.institutions, public.contests, public.exams, public.content_nodes,
  public.exam_questions, public.enrollments, public.hotmart_products TO authenticated;
GRANT ALL ON public.institutions, public.contests, public.exams, public.content_nodes,
  public.exam_questions, public.enrollments, public.hotmart_products TO service_role;

-- Staff administra tudo; aluno lê o que pertence a edital em que está matriculado.
CREATE POLICY "Staff manage institutions" ON public.institutions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'));
CREATE POLICY "Matriculado le institutions" ON public.institutions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.enrollments en
      JOIN public.exams ex ON ex.id = en.exam_id
      JOIN public.contests c ON c.id = ex.contest_id
     WHERE en.user_id = auth.uid() AND c.institution_id = institutions.id));

CREATE POLICY "Staff manage contests" ON public.contests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'));
CREATE POLICY "Matriculado le contests" ON public.contests FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.enrollments en JOIN public.exams ex ON ex.id = en.exam_id
     WHERE en.user_id = auth.uid() AND ex.contest_id = contests.id));

CREATE POLICY "Staff manage exams" ON public.exams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'));
CREATE POLICY "Matriculado le exams" ON public.exams FOR SELECT TO authenticated
  USING (public.has_exam_access(id));

CREATE POLICY "Staff manage content_nodes" ON public.content_nodes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'));
CREATE POLICY "Matriculado le content_nodes" ON public.content_nodes FOR SELECT TO authenticated
  USING (public.has_exam_access(exam_id));

CREATE POLICY "Staff manage exam_questions" ON public.exam_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'));
-- Aluno só vê vínculo publicado, e só do edital em que está matriculado.
CREATE POLICY "Matriculado le exam_questions publicadas" ON public.exam_questions FOR SELECT TO authenticated
  USING (status = 'published' AND public.has_exam_access(exam_id));

CREATE POLICY "Admin manage enrollments" ON public.enrollments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Aluno le propria matricula" ON public.enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin manage hotmart_products" ON public.hotmart_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 4) Respostas passam a registrar edital e conteúdo
--    (colunas opcionais por enquanto: o frontend antigo ainda não as envia)
-- ---------------------------------------------------------------------------
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_node_id uuid REFERENCES public.content_nodes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON public.attempts (user_id, exam_id, created_at DESC);

ALTER TABLE public.simulados
  ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE;

ALTER TABLE public.simulado_attempts
  ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 5) Conteúdo dos dois editais
-- ---------------------------------------------------------------------------

-- ===== PMMG — CFSd 2025 (Edital DRH/CRS nº 10/2024) =====
INSERT INTO public.institutions (name, sigla, slug) VALUES ('Polícia Militar de Minas Gerais', 'PMMG', 'pmmg')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.contests (institution_id, name, slug)
SELECT i.id, 'Curso de Formação de Soldados', 'curso-de-formacao-de-soldados' FROM public.institutions i WHERE i.slug = 'pmmg'
ON CONFLICT (institution_id, slug) DO NOTHING;

INSERT INTO public.exams (contest_id, name, slug, year, edital_ref, duration_minutes, is_published)
SELECT c.id, 'CFSd 2025', 'pmmg-cfsd-2025', 2025, 'Edital DRH/CRS nº 10/2024', 180, true
  FROM public.contests c JOIN public.institutions i ON i.id = c.institution_id
 WHERE i.slug = 'pmmg' AND c.slug = 'curso-de-formacao-de-soldados'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Língua Portuguesa e Interpretação de Textos', 'lingua-portuguesa-e-interpretacao-de-textos', 1, 1, 20
  FROM public.exams e WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Adequação conceitual', 'adequacao-conceitual', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Pertinência, relevância e articulação dos argumentos', 'pertinencia-relevancia-e-articulacao-dos-argumentos', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Seleção vocabular', 'selecao-vocabular', 2, 3
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Estudo de texto', 'estudo-de-texto', 2, 4
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Tipologia textual e gêneros textuais', 'tipologia-textual-e-generos-textuais', 2, 5
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Ortografia oficial', 'ortografia-oficial', 2, 6
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Acentuação gráfica', 'acentuacao-grafica', 2, 7
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Emprego dos sinais de pontuação', 'emprego-dos-sinais-de-pontuacao', 2, 8
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Estrutura e formação de palavras', 'estrutura-e-formacao-de-palavras', 2, 9
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Classes de palavras', 'classes-de-palavras', 2, 10
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Frase, oração e período', 'frase-oracao-e-periodo', 2, 11
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Termos da oração', 'termos-da-oracao', 2, 12
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Período composto por coordenação e subordinação', 'periodo-composto-por-coordenacao-e-subordinacao', 2, 13
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Funções sintáticas dos pronomes relativos', 'funcoes-sintaticas-dos-pronomes-relativos', 2, 14
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Emprego de nomes e pronomes', 'emprego-de-nomes-e-pronomes', 2, 15
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Emprego de tempos e modos verbais', 'emprego-de-tempos-e-modos-verbais', 2, 16
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Regência verbal e nominal', 'regencia-verbal-e-nominal', 2, 17
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Concordância verbal e nominal', 'concordancia-verbal-e-nominal', 2, 18
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Orações reduzidas', 'oracoes-reduzidas', 2, 19
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Colocação pronominal', 'colocacao-pronominal', 2, 20
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Estilística', 'estilistica', 2, 21
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Figuras de linguagem', 'figuras-de-linguagem', 2, 22
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Vícios de linguagem e qualidade da boa linguagem', 'vicios-de-linguagem-e-qualidade-da-boa-linguagem', 2, 23
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Fonemas', 'fonemas', 2, 24
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Semântica', 'semantica', 2, 25
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Emprego da crase', 'emprego-da-crase', 2, 26
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Sintaxe: regência, concordância e colocação', 'sintaxe-regencia-concordancia-e-colocacao', 2, 27
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Coesão e coerência textuais', 'coesao-e-coerencia-textuais', 2, 28
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa-e-interpretacao-de-textos'
 WHERE e.slug = 'pmmg-cfsd-2025';

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Literatura', 'literatura', 1, 2, 5
  FROM public.exams e WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Campo Geral, de João Guimarães Rosa', 'campo-geral-de-joao-guimaraes-rosa', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'literatura'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Vidas Secas, de Graciliano Ramos', 'vidas-secas-de-graciliano-ramos', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'literatura'
 WHERE e.slug = 'pmmg-cfsd-2025';

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Noções de Língua Inglesa', 'nocoes-de-lingua-inglesa', 1, 3, 5
  FROM public.exams e WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Compreensão e interpretação de texto escrito em língua inglesa', 'compreensao-e-interpretacao-de-texto-escrito-em-lingua-ingle', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-lingua-inglesa'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Itens gramaticais relevantes para a compreensão dos conteúdos semânticos', 'itens-gramaticais-relevantes-para-a-compreensao-dos-conteudo', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-lingua-inglesa'
 WHERE e.slug = 'pmmg-cfsd-2025';

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Noções de Direito', 'nocoes-de-direito', 1, 4, 10
  FROM public.exams e WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Constituição da República Federativa do Brasil', 'constituicao-da-republica-federativa-do-brasil', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direito'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'LINDB — Lei nº 4.657/1942', 'lindb-lei-n-4-657-1942', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direito'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Declaração Universal dos Direitos Humanos', 'declaracao-universal-dos-direitos-humanos', 2, 3
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direito'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Convenção Americana sobre Direitos Humanos', 'convencao-americana-sobre-direitos-humanos', 2, 4
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direito'
 WHERE e.slug = 'pmmg-cfsd-2025';

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Raciocínio Lógico-Matemático', 'raciocinio-logico-matematico', 1, 5, 10
  FROM public.exams e WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Interpretação de figuras, gráficos, tabelas e escalas', 'interpretacao-de-figuras-graficos-tabelas-e-escalas', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-matematico'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Estatística básica e porcentagem', 'estatistica-basica-e-porcentagem', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-matematico'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Estruturas e diagramas lógicos', 'estruturas-e-diagramas-logicos', 2, 3
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-matematico'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Métrica: áreas e volumes', 'metrica-areas-e-volumes', 2, 4
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-matematico'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Equações de 1º e 2º graus e sistemas lineares', 'equacoes-de-1-e-2-graus-e-sistemas-lineares', 2, 5
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-matematico'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Contagem, probabilidade e estatística', 'contagem-probabilidade-e-estatistica', 2, 6
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-matematico'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Noções de função', 'nocoes-de-funcao', 2, 7
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-matematico'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Operações com conjuntos', 'operacoes-com-conjuntos', 2, 8
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-matematico'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Sequências numéricas, PA e PG', 'sequencias-numericas-pa-e-pg', 2, 9
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-matematico'
 WHERE e.slug = 'pmmg-cfsd-2025';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Razão, proporção e regra de três', 'razao-proporcao-e-regra-de-tres', 2, 10
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-matematico'
 WHERE e.slug = 'pmmg-cfsd-2025';

-- ===== CBMMG — CFSd BM 2027 (Edital nº 10/2026) =====
INSERT INTO public.institutions (name, sigla, slug) VALUES ('Corpo de Bombeiros Militar de Minas Gerais', 'CBMMG', 'cbmmg')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.contests (institution_id, name, slug)
SELECT i.id, 'Curso de Formação de Soldados', 'curso-de-formacao-de-soldados' FROM public.institutions i WHERE i.slug = 'cbmmg'
ON CONFLICT (institution_id, slug) DO NOTHING;

INSERT INTO public.exams (contest_id, name, slug, year, edital_ref, duration_minutes, is_published)
SELECT c.id, 'CFSd BM 2027', 'cbmmg-cfsd-bm-2027', 2027, 'Edital nº 10/2026', 240, true
  FROM public.contests c JOIN public.institutions i ON i.id = c.institution_id
 WHERE i.slug = 'cbmmg' AND c.slug = 'curso-de-formacao-de-soldados'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Língua Portuguesa', 'lingua-portuguesa', 1, 1, 10
  FROM public.exams e WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Compreensão e interpretação de textos', 'compreensao-e-interpretacao-de-textos', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Tipos e gêneros textuais', 'tipos-e-generos-textuais', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Ortografia e acentuação', 'ortografia-e-acentuacao', 2, 3
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Coesão textual', 'coesao-textual', 2, 4
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Morfossintaxe do período', 'morfossintaxe-do-periodo', 2, 5
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Pontuação', 'pontuacao', 2, 6
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Concordância verbal e nominal', 'concordancia-verbal-e-nominal', 2, 7
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Crase', 'crase', 2, 8
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Colocação pronominal', 'colocacao-pronominal', 2, 9
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Reescritura de frases e parágrafos', 'reescritura-de-frases-e-paragrafos', 2, 10
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'lingua-portuguesa'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Raciocínio Lógico e Matemático', 'raciocinio-logico-e-matematico', 1, 2, 5
  FROM public.exams e WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Lógica de relações arbitrárias', 'logica-de-relacoes-arbitrarias', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-e-matematico'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Raciocínio verbal, sequencial e orientação espaço-temporal', 'raciocinio-verbal-sequencial-e-orientacao-espaco-temporal', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-e-matematico'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Operações com conjuntos', 'operacoes-com-conjuntos', 2, 3
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-e-matematico'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Problemas aritméticos, geométricos e matriciais', 'problemas-aritmeticos-geometricos-e-matriciais', 2, 4
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'raciocinio-logico-e-matematico'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Noções de Direitos Humanos e Legislação', 'nocoes-de-direitos-humanos-e-legislacao', 1, 3, 10
  FROM public.exams e WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Conceito e história dos direitos humanos', 'conceito-e-historia-dos-direitos-humanos', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direitos-humanos-e-legislacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Sistema ONU e Conselho de Direitos Humanos', 'sistema-onu-e-conselho-de-direitos-humanos', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direitos-humanos-e-legislacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'PIDCP e PIDESC', 'pidcp-e-pidesc', 2, 3
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direitos-humanos-e-legislacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Declaração Universal dos Direitos Humanos', 'declaracao-universal-dos-direitos-humanos', 2, 4
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direitos-humanos-e-legislacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Convenção Americana sobre Direitos Humanos', 'convencao-americana-sobre-direitos-humanos', 2, 5
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direitos-humanos-e-legislacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Estatuto dos Militares de MG — Lei nº 5.301/1969', 'estatuto-dos-militares-de-mg-lei-n-5-301-1969', 2, 6
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direitos-humanos-e-legislacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Constituição Federal', 'constituicao-federal', 2, 7
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direitos-humanos-e-legislacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Constituição do Estado de Minas Gerais', 'constituicao-do-estado-de-minas-gerais', 2, 8
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direitos-humanos-e-legislacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'LINDB — Lei nº 4.657/1942', 'lindb-lei-n-4-657-1942', 2, 9
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'nocoes-de-direitos-humanos-e-legislacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Ciências Naturais', 'ciencias-naturais', 1, 4, 10
  FROM public.exams e WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Química', 'quimica', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'ciencias-naturais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Átomos, moléculas e íons', 'atomos-moleculas-e-ions', 3, 1
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'quimica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Reações químicas', 'reacoes-quimicas', 3, 2
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'quimica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Ligações químicas', 'ligacoes-quimicas', 3, 3
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'quimica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Estequiometria', 'estequiometria', 3, 4
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'quimica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Soluções', 'solucoes', 3, 5
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'quimica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Cinética química', 'cinetica-quimica', 3, 6
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'quimica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Equilíbrio químico', 'equilibrio-quimico', 3, 7
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'quimica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Eletroquímica', 'eletroquimica', 3, 8
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'quimica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Gases e gases tóxicos', 'gases-e-gases-toxicos', 3, 9
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'quimica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Física', 'fisica', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'ciencias-naturais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Unidades de medida e vetores', 'unidades-de-medida-e-vetores', 3, 1
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'fisica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Cinemática', 'cinematica', 3, 2
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'fisica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Dinâmica', 'dinamica', 3, 3
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'fisica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Trabalho e energia', 'trabalho-e-energia', 3, 4
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'fisica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Estática', 'estatica', 3, 5
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'fisica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Estática e dinâmica dos fluidos', 'estatica-e-dinamica-dos-fluidos', 3, 6
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'fisica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Temperatura e dilatação térmica', 'temperatura-e-dilatacao-termica', 3, 7
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'fisica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Combustão e termodinâmica', 'combustao-e-termodinamica', 3, 8
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'fisica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Eletricidade e circuitos', 'eletricidade-e-circuitos', 3, 9
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'fisica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Ondas', 'ondas', 3, 10
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'fisica'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Biologia e fisiologia humana', 'biologia-e-fisiologia-humana', 2, 3
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'ciencias-naturais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Sistemas do corpo humano', 'sistemas-do-corpo-humano', 3, 1
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'biologia-e-fisiologia-humana'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Metabolismo', 'metabolismo', 3, 2
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'biologia-e-fisiologia-humana'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Genética e ciclo celular', 'genetica-e-ciclo-celular', 3, 3
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'biologia-e-fisiologia-humana'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Histologia', 'histologia', 3, 4
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'biologia-e-fisiologia-humana'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Imunologia', 'imunologia', 3, 5
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'biologia-e-fisiologia-humana'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Embriologia', 'embriologia', 3, 6
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'biologia-e-fisiologia-humana'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Fisiopatologia', 'fisiopatologia', 3, 7
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'biologia-e-fisiologia-humana'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Geografia física de Minas Gerais', 'geografia-fisica-de-minas-gerais', 2, 4
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'ciencias-naturais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Vegetação e biomas', 'vegetacao-e-biomas', 3, 1
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'geografia-fisica-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Relevo', 'relevo', 3, 2
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'geografia-fisica-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Geomorfologia cárstica', 'geomorfologia-carstica', 3, 3
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'geografia-fisica-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Hidrografia', 'hidrografia', 3, 4
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-naturais'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'geografia-fisica-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Ciências Humanas', 'ciencias-humanas', 1, 5, 10
  FROM public.exams e WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'História de Minas Gerais', 'historia-de-minas-gerais', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'ciencias-humanas'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Colonização', 'colonizacao', 3, 1
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Ciclo do ouro', 'ciclo-do-ouro', 3, 2
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Inconfidência Mineira', 'inconfidencia-mineira', 3, 3
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Escravidão', 'escravidao', 3, 4
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Cidades históricas', 'cidades-historicas', 3, 5
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Café e industrialização', 'cafe-e-industrializacao', 3, 6
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Política do Café com Leite', 'politica-do-cafe-com-leite', 3, 7
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Revolução de 1930', 'revolucao-de-1930', 3, 8
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Estado Novo', 'estado-novo', 3, 9
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Cultura popular', 'cultura-popular', 3, 10
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Desafios contemporâneos', 'desafios-contemporaneos', 3, 11
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'historia-de-minas-gerais'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Mineração', 'mineracao', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'ciencias-humanas'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'História da mineração', 'historia-da-mineracao', 3, 1
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'mineracao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Minerais metálicos e não metálicos', 'minerais-metalicos-e-nao-metalicos', 3, 2
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'mineracao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Impactos ambientais', 'impactos-ambientais', 3, 3
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'mineracao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Gestão de rejeitos', 'gestao-de-rejeitos', 3, 4
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'mineracao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Barragens', 'barragens', 2, 3
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'ciencias-humanas'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Inventário de barragens', 'inventario-de-barragens', 3, 1
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'barragens'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Segurança de barragens', 'seguranca-de-barragens', 3, 2
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'barragens'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Impactos socioambientais', 'impactos-socioambientais', 3, 3
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'barragens'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Gestão de resíduos', 'gestao-de-residuos', 3, 4
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'barragens'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Áreas de risco', 'areas-de-risco', 2, 4
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'ciencias-humanas'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Mapeamento de riscos', 'mapeamento-de-riscos', 3, 1
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'areas-de-risco'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Vulnerabilidade socioeconômica', 'vulnerabilidade-socioeconomica', 3, 2
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'areas-de-risco'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Prevenção e mitigação', 'prevencao-e-mitigacao', 3, 3
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'areas-de-risco'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Ordenamento territorial', 'ordenamento-territorial', 3, 4
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'areas-de-risco'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Educação e conscientização', 'educacao-e-conscientizacao', 3, 5
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'areas-de-risco'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Patrimônio natural', 'patrimonio-natural', 2, 5
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'ciencias-humanas'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Cachoeiras, grutas e cavernas', 'cachoeiras-grutas-e-cavernas', 3, 1
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'patrimonio-natural'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Ecoturismo', 'ecoturismo', 3, 2
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'patrimonio-natural'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Conservação e manejo', 'conservacao-e-manejo', 3, 3
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'patrimonio-natural'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Lagos e represas', 'lagos-e-represas', 3, 4
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'patrimonio-natural'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Regionalização e população', 'regionalizacao-e-populacao', 2, 6
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'ciencias-humanas'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Mesorregiões', 'mesorregioes', 3, 1
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'regionalizacao-e-populacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Demografia', 'demografia', 3, 2
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'regionalizacao-e-populacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Regiões metropolitanas', 'regioes-metropolitanas', 3, 3
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'regionalizacao-e-populacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Urbanização', 'urbanizacao', 3, 4
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'regionalizacao-e-populacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Economia regional', 'economia-regional', 3, 5
  FROM public.exams e
  JOIN public.content_nodes d ON d.exam_id = e.id AND d.parent_id IS NULL AND d.slug = 'ciencias-humanas'
  JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id = d.id AND p.slug = 'regionalizacao-e-populacao'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';

INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order, weight)
SELECT e.id, NULL, 'Proteção e Defesa Civil', 'protecao-e-defesa-civil', 1, 6, 5
  FROM public.exams e WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Gestão de riscos e desastres', 'gestao-de-riscos-e-desastres', 2, 1
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'protecao-e-defesa-civil'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Cenários de risco no Brasil', 'cenarios-de-risco-no-brasil', 2, 2
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'protecao-e-defesa-civil'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Redução de riscos e desastres', 'reducao-de-riscos-e-desastres', 2, 3
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'protecao-e-defesa-civil'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';
INSERT INTO public.content_nodes (exam_id, parent_id, name, slug, level, display_order)
SELECT e.id, p.id, 'Ações integradas e colaboração na gestão de riscos', 'acoes-integradas-e-colaboracao-na-gestao-de-riscos', 2, 4
  FROM public.exams e JOIN public.content_nodes p ON p.exam_id = e.id AND p.parent_id IS NULL AND p.slug = 'protecao-e-defesa-civil'
 WHERE e.slug = 'cbmmg-cfsd-bm-2027';

-- ---------------------------------------------------------------------------
-- 6) Matrícula do staff nos dois editais, para poder revisar conteúdo
-- ---------------------------------------------------------------------------
INSERT INTO public.enrollments (user_id, exam_id, source)
SELECT ur.user_id, e.id, 'manual'
  FROM public.user_roles ur CROSS JOIN public.exams e
 WHERE ur.role IN ('admin', 'admin_didatico')
ON CONFLICT (user_id, exam_id) DO NOTHING;
