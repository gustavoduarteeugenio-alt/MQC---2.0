
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS option_e text;
