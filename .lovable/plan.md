## Problema

Hoje o resultado do diagnóstico calcula `overallPct` como **média das porcentagens por matéria** (`sum(pct)/n_subjects`). Isso distorce o número real: se uma matéria tem 2 questões e outra 1, todas pesam igual. O feedback final ("você passaria/reprovaria") usa esse valor enviesado, então não reflete o acerto real do aluno no banco de questões.

Além disso, o card de erros/acertos da tela de quiz já mostra contagem real, mas a tela de resultado nunca exibe o total de **acertos vs erros absolutos** — só percentual por matéria. O usuário quer que o feedback final seja baseado no **percentual real de acertos** sobre o total respondido.

## Plano

### 1. `src/pages/Diagnostico.tsx` — cálculo correto

Substituir, no bloco RESULT (linha 381):

```ts
const overall = results.reduce((s, r) => s + r.pct, 0) / Math.max(1, results.length);
```

por cálculo baseado em totais absolutos:

```ts
const totalQuestions = results.reduce((s, r) => s + r.total, 0);
const totalCorrect   = results.reduce((s, r) => s + r.correct, 0);
const totalWrong     = totalQuestions - totalCorrect;
const overallPct     = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
```

### 2. Faixas de feedback baseadas em % real

Manter 3 faixas, agora ancoradas no percentual real:

- **≥ 80%** → "Prontidão: X% — você passaria hoje." (verde)
- **60–79%** → "Prontidão: X% — você está perto, mas ainda reprovaria." (amarelo)
- **< 60%** → "Prontidão: X% — se a prova fosse hoje, você não passaria." (vermelho)

Subtexto usa `totalCorrect`/`totalWrong` para ficar concreto:
"Você acertou **{totalCorrect} de {totalQuestions}** ({overallPct}%). {weak.length} matéria(s) abaixo da meta."

### 3. Card-resumo no topo do resultado

Adicionar no header do estágio `result`, logo abaixo do título, um par de chips (mesmo visual do quiz) com:
- Acertos: `{totalCorrect}` (verde)
- Erros: `{totalWrong}` (vermelho)
- % geral: barra de progresso colorida conforme a faixa (verde/amarelo/vermelho)

### 4. Persistência consistente

No `next()` (linha 205), já gravamos `correct: totalCorrect`. Garantir que esse total venha do mesmo cálculo (soma dos `correct` por matéria, não de `sessionCorrect` que poderia divergir se o usuário trocar respostas — hoje não troca, mas blindar). Nenhuma mudança de schema.

### 5. Sem mudança em

- Seleção de 2 questões por matéria (já correto).
- RLS, tabela `diagnostic_sessions`, fluxo de intro/quiz.
- Lista de matérias fracas/fortes (continua usando `MASTERY_TARGET = 80`).

## Arquivos

- `src/pages/Diagnostico.tsx` (apenas bloco RESULT + pequeno ajuste no `next()`)
