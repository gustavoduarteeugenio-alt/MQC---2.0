## Objetivo

Permitir que o aluno encerre o treino a qualquer momento e veja uma tela de resumo com feedback baseado no que respondeu na sessão.

## Mudanças

### 1. `src/pages/Question.tsx`

- **Remover o botão de voltar** (seta `←`) do `TopBar`. O título da matéria fica centralizado e o cronômetro à direita.
- Trocar `sessionCorrect`/`sessionWrong` por um mapa `sessionBySubject: { [subjectId]: { name, slug, correct, wrong } }` atualizado a cada `confirm()`. O totalizador no topo continua mostrando acertos/erros somados.
- Adicionar um botão **"Encerrar treino"** grande, largura total, **logo abaixo** do botão "Próxima questão" (e também abaixo do "Confirmar resposta" quando ainda não confirmou). Visual secundário/outline para não competir com o CTA principal.
- Visível só depois da 1ª resposta na sessão (`totalAnswered > 0`).
- Ao clicar: `navigate("/treino/resumo", { state: { bySubject: [...], totalCorrect, totalWrong, durationSeconds } })`.

### 2. `src/pages/TrainingSummary.tsx` (novo)

Tela de resumo no mesmo estilo da Home:

- Cabeçalho com gradient: "Treino encerrado" + tempo total.
- Card grande de acerto: `X de Y acertos` + percentual.
- Cards:
  - **Foco agora**: matéria com PIOR % na sessão (destaque vermelho, ícone alvo).
  - **Mandando bem**: matéria com MELHOR % na sessão (destaque verde, ícone troféu).
  - Se só houve 1 matéria, mostra apenas o desempenho dela.
- Lista compacta de todas as matérias da sessão com seu %.
- Frase de feedback dinâmica:
  - `≥80%` → "Excelente, soldado! Mantenha o ritmo."
  - `50–79%` → "Bom desempenho. Foque em {pior} para subir o índice."
  - `<50%` → "Hora de reforçar a base. Comece por {pior}."
- Dois CTAs:
  - **"Treinar a matéria fraca"** → `/questao/{slug-da-pior}`.
  - **"Voltar para o início"** → `/`.

Se acessada sem `location.state` → redireciona para `/`.

### 3. `src/App.tsx`

Registrar `<Route path="/treino/resumo" element={<TrainingSummary />} />` no bloco autenticado.

## Dados passados no `navigate(state)`

```
{
  durationSeconds: number,
  totalCorrect: number,
  totalWrong: number,
  bySubject: [{ id, name, slug, correct, wrong, accuracy }]
}
```

## O que NÃO muda

- Banco de dados (sem migração).
- Lógica de `pickNextSubject`.
- Layout do enunciado e das alternativas.
