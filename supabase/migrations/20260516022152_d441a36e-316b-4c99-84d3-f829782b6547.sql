ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- Aprovar automaticamente usuários já existentes para não quebrar acesso atual
UPDATE public.profiles SET approved = true WHERE approved = false;