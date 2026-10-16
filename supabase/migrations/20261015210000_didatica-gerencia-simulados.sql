-- A admin didática também monta simulado.
--
-- As políticas de leitura já a incluíam, mas as de escrita ficaram só no admin,
-- herdadas de quando "admin_didatico" nem existia. Montar simulado é trabalho de
-- conteúdo, que é justamente o papel dela — e sem isto ela nem via o menu.

DROP POLICY IF EXISTS "Admins manage simulados" ON public.simulados;
CREATE POLICY "Staff manage simulados" ON public.simulados FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'));

DROP POLICY IF EXISTS "Admins manage simulado_questions" ON public.simulado_questions;
CREATE POLICY "Staff manage simulado_questions" ON public.simulado_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin_didatico'));

-- A lição da migration anterior: política sem privilégio não escreve nada.
-- Estas tabelas nunca foram revogadas, mas deixar o GRANT explícito evita que o
-- acesso dependa do privilégio padrão que o projeto tinha no dia da criação.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulados, public.simulado_questions TO authenticated;
