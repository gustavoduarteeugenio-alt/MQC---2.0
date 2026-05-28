CREATE TABLE public.landing_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  instagram_handle TEXT,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Permissões para leads públicos (qualquer um pode se cadastrar)
GRANT INSERT ON public.landing_leads TO anon;
GRANT INSERT ON public.landing_leads TO authenticated;
GRANT ALL ON public.landing_leads TO service_role;

-- Habilitar RLS
ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;

-- Políticas: qualquer um pode inserir (formulário público)
CREATE POLICY "Anyone can insert landing leads"
ON public.landing_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Apenas service_role (admin) pode ler todos os leads
CREATE POLICY "Only service_role can read landing leads"
ON public.landing_leads
FOR SELECT
TO authenticated
USING (false);