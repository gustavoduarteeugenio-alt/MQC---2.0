## Objetivo

Fazer a lógica de treino direcionado funcionar também **dentro da página de questão**, ou seja, ao avançar de uma questão para a próxima, sem o aluno precisar voltar para a home.

## Como vai funcionar

1. **Botão "Treinar agora" (home)** — escolhe a matéria mais fraca (abaixo de 80%) e abre a primeira questão dessa matéria. Mesma regra já planejada.

2. **Dentro da página de questão (`/questao/:slug`)** — ao clicar em "Próxima questão":
   - Se o aluno **errou** a questão atual → próxima questão é da **mesma matéria** (reforço).
   - Se o aluno **acertou** → o sistema recalcula o ranking de matérias e:
     - Se a matéria atual ainda está abaixo de 80%, pode continuar nela, mas **alterna** ocasionalmente para outra matéria fraca.
     - Se houver outra matéria com desempenho **pior** que a atual, troca para ela.
     - Se a matéria atual já passou de 80%, prioriza outra matéria abaixo de 80%.
   - Quando o aluno muda de matéria, a URL muda para `/questao/{novo-slug}` e a próxima questão (não respondida ainda) daquela matéria aparece.

3. **Filtro de questões já respondidas** — ao carregar questões de uma matéria, excluir as que o usuário já respondeu (consulta `attempts` por `user_id` + `question_id`), para não repetir. Se acabarem as inéditas da matéria, libera repetição (modo revisão).

## Regra resumida da alternância (acertou)

- Monta ranking ao vivo: matérias < 80% ordenadas da pior para a melhor.
- Pega o **topo da fila**. Se for diferente da matéria atual → troca.
- Se for a mesma → continua mais 1–2 questões nela, depois força um "respiro" indo para a 2ª pior, para manter variedade (evita monotonia).
- Sem matérias < 80% → modo revisão: rotaciona entre as matérias com menor acerto recente.

## Arquivos a editar

- **`src/lib/training.ts`** (novo) — funções puras: `getSubjectStats(userId)`, `pickNextSubject({ stats, currentSubjectId, lastWasCorrect })`, `pickNextQuestion(subjectId, userId)`. Centraliza a lógica para ser reusada na home e na página de questão.
- **`src/pages/Index.tsx`** — botão "Treinar agora" chama `pickNextSubject` + `navigate('/questao/{slug}')`. Remove badge "Plano Básico".
- **`src/pages/Question.tsx`** — função `next()` passa a:
  1. Recalcular stats (incluindo a tentativa que acabou de ser salva).
  2. Decidir próxima matéria via `pickNextSubject` usando `lastWasCorrect`.
  3. Se mudou de matéria → `navigate('/questao/{novo-slug}')`.
  4. Se mesma matéria → avança no array local (recarregando se necessário para excluir respondidas).
  - Também ajustar o carregamento inicial para filtrar questões já respondidas.

## O que NÃO muda

- Estrutura visual da página de questão, layout, animações.
- Tabelas do banco (sem migração).
- Página `/materias` continua existindo como navegação livre.

## Resultado para o aluno

O aluno clica em "Treinar agora" uma vez e pode responder dezenas de questões seguidas — o app vai automaticamente puxando da matéria onde ele está pior, reforçando quando erra e alternando quando acerta, sem precisar voltar para a home.
