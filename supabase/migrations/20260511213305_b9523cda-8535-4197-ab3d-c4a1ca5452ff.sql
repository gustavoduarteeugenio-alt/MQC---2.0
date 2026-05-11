
-- 1) Add optional subtopic column to questions
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS subtopic text;

-- 2) Capture canonical IDs of subjects to keep (by current slug)
-- Reuse existing rows so foreign keys remain valid.
-- portugues → Língua Portuguesa
UPDATE public.subjects
SET name = 'Língua Portuguesa', slug = 'lingua-portuguesa', display_order = 1
WHERE slug = 'portugues';

-- rlm → Raciocínio Lógico e Matemático
UPDATE public.subjects
SET name = 'Raciocínio Lógico e Matemático', slug = 'rlm', display_order = 2
WHERE slug = 'rlm';

-- defesa-civil → Proteção e Defesa Civil
UPDATE public.subjects
SET name = 'Proteção e Defesa Civil', slug = 'protecao-defesa-civil', display_order = 6
WHERE slug = 'defesa-civil';

-- direito → Noções de Direitos Humanos e Legislação (unified)
UPDATE public.subjects
SET name = 'Noções de Direitos Humanos e Legislação', slug = 'direitos-humanos-legislacao', display_order = 3
WHERE slug = 'direito';

-- Tag and migrate questions from direitos-humanos & legislacao into the unified subject
UPDATE public.questions q
SET subtopic = COALESCE(q.subtopic, 'Direitos Humanos'),
    subject_id = (SELECT id FROM public.subjects WHERE slug = 'direitos-humanos-legislacao')
WHERE subject_id = (SELECT id FROM public.subjects WHERE slug = 'direitos-humanos');

UPDATE public.questions q
SET subtopic = COALESCE(q.subtopic, 'Legislação'),
    subject_id = (SELECT id FROM public.subjects WHERE slug = 'direitos-humanos-legislacao')
WHERE subject_id = (SELECT id FROM public.subjects WHERE slug = 'legislacao');

-- Tag existing "Noções de Direito" questions
UPDATE public.questions
SET subtopic = COALESCE(subtopic, 'Noções de Direito')
WHERE subject_id = (SELECT id FROM public.subjects WHERE slug = 'direitos-humanos-legislacao')
  AND subtopic IS NULL;

DELETE FROM public.subjects WHERE slug IN ('direitos-humanos','legislacao');

-- quimica → Ciências Naturais (unified)
UPDATE public.subjects
SET name = 'Ciências Naturais', slug = 'ciencias-naturais', display_order = 4
WHERE slug = 'quimica';

UPDATE public.questions
SET subtopic = COALESCE(subtopic, 'Química')
WHERE subject_id = (SELECT id FROM public.subjects WHERE slug = 'ciencias-naturais')
  AND subtopic IS NULL;

UPDATE public.questions
SET subtopic = COALESCE(subtopic, 'Biologia'),
    subject_id = (SELECT id FROM public.subjects WHERE slug = 'ciencias-naturais')
WHERE subject_id = (SELECT id FROM public.subjects WHERE slug = 'biologia');

UPDATE public.questions
SET subtopic = COALESCE(subtopic, 'Física'),
    subject_id = (SELECT id FROM public.subjects WHERE slug = 'ciencias-naturais')
WHERE subject_id = (SELECT id FROM public.subjects WHERE slug = 'fisica');

DELETE FROM public.subjects WHERE slug IN ('biologia','fisica');

-- historia-mg → Ciências Humanas (unified)
UPDATE public.subjects
SET name = 'Ciências Humanas', slug = 'ciencias-humanas', display_order = 5
WHERE slug = 'historia-mg';

UPDATE public.questions
SET subtopic = COALESCE(subtopic, 'História de Minas Gerais')
WHERE subject_id = (SELECT id FROM public.subjects WHERE slug = 'ciencias-humanas')
  AND subtopic IS NULL;

UPDATE public.questions
SET subtopic = COALESCE(subtopic, 'Geografia de Minas Gerais'),
    subject_id = (SELECT id FROM public.subjects WHERE slug = 'ciencias-humanas')
WHERE subject_id = (SELECT id FROM public.subjects WHERE slug = 'geografia-mg');

DELETE FROM public.subjects WHERE slug = 'geografia-mg';
