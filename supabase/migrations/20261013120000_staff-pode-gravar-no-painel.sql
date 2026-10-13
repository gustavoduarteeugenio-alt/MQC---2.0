-- O painel não conseguia gravar: política dizia sim, privilégio dizia não.
--
-- A fase 1 revogou tudo de `authenticated` nessas tabelas e devolveu só SELECT,
-- contando com as políticas "Staff manage ..." para liberar a escrita. Mas RLS
-- não concede privilégio: ela só filtra o que o privilégio já permite. Sem o
-- GRANT, todo INSERT/UPDATE/DELETE do painel morria em "permission denied for
-- table ...", inclusive para o admin.
--
-- O estrago: importar questões, publicar questão, criar edital, mexer na árvore
-- de conteúdo e apagar mapeamento de produto — nada disso funcionava. Foi o que
-- aconteceu com a importação de 08/10: as questões entraram em `questions` e o
-- vínculo com o edital foi recusado, deixando 248 questões órfãs e invisíveis.
--
-- Aqui devolvemos o privilégio e deixamos a RLS fazer o papel dela, que é o
-- desenho original. As políticas já restringem a escrita ao staff: quem não for
-- admin nem admin_didatico continua sem conseguir gravar nada.

GRANT INSERT, UPDATE, DELETE ON
  public.institutions,
  public.contests,
  public.exams,
  public.content_nodes,
  public.exam_questions,
  public.hotmart_products
TO authenticated;

-- `enrollments` fica de fora de propósito: nenhuma tela grava matrícula direto.
-- Quem matricula é o webhook (service_role) ou uma RPC SECURITY DEFINER, que não
-- depende deste GRANT. Se um dia uma tela precisar escrever aqui, o privilégio
-- terá de ser concedido junto — e não adianta só criar a política.
