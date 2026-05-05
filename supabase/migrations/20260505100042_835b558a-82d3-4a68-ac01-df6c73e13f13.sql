
UPDATE public.subjects
SET name = 'Defesa Civil', slug = 'defesa-civil'
WHERE slug = 'informatica' OR lower(name) = 'informática' OR lower(name) = 'informatica';

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS banca text NOT NULL DEFAULT 'IDECAN';
