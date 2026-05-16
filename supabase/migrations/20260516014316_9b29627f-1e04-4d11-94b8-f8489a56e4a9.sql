CREATE POLICY "Anon read subjects for diagnostic"
ON public.subjects FOR SELECT TO anon USING (true);

CREATE POLICY "Anon read questions for diagnostic"
ON public.questions FOR SELECT TO anon USING (true);