## Objetivo

Criar testes automatizados para a função `pickNextSubject` em `src/lib/training.ts`, validando a lógica de seleção da próxima matéria em diversas combinações de acertos/erros.

## Arquivo

- **`src/lib/training.test.ts`** (novo) — suite Vitest puramente lógica, sem mock de rede (a função `pickNextSubject` já é pura).

## Cenários cobertos

Cada teste monta um array de `SubjectStat` simulando o estado atual do aluno e verifica qual matéria é escolhida.

1. **Sem dados** — nenhum subject → retorna `null`.
2. **Matérias inéditas têm prioridade** — uma sem `hasAttempts` vence qualquer matéria com `<80%`.
3. **Errou a última** — retorna a matéria atual, ignorando ranking (modo reforço).
4. **Acertou e existe matéria mais fraca que a atual** — troca para a pior.
5. **Acertou e a atual é a mais fraca, sem streak** — continua na atual.
6. **Acertou em sequência (`streakOnCurrent >= 2`) na pior matéria** — alterna para a 2ª pior, mesmo sendo melhor (variedade).
7. **Streak alto mas só existe uma matéria fraca** — continua na atual (não há para onde alternar).
8. **Todas as matérias ≥ 80%** — modo revisão: escolhe a de menor acerto entre as fortes.
9. **Sequência de chamadas simulando treino real**:
   - Estado: Matemática 40%, Legislação 60%, Português 75%, História 90%.
   - Simula: acerto em Matemática (streak=1) → continua Matemática.
   - Acerto novamente (streak=2) → alterna para Legislação.
   - Erro em Legislação → fica em Legislação.
   - Acerto isolado em Legislação (streak=1) → continua Legislação (Mat segue como pior, troca pra Mat).
   - Acertos até Matemática passar de 80% → fila reorganiza, prioriza Legislação/Português.
10. **Padrão alternado A-E-A-E-A** em uma única matéria fraca → sempre fica nela (porque erros e streak nunca chegam a 2).
11. **Padrão A-A-A-A-A** em uma única matéria fraca com outras fortes → após streak ≥ 2, alterna para a fraca seguinte (ou continua se não houver).
12. **Padrão E-E-E-E** → sempre reforça a matéria atual.

## Como rodar

`npm run test` ou via ferramenta `run-tests`. O setup já existe (vitest + jsdom configurados).

## Saída esperada

Suite com ~10–12 `it()` cobrindo regras, branches do `pickNextSubject` e uma simulação de fluxo. Sem alteração no código de produção.
