## Objetivo
Após o cadastro (signup), redirecionar o usuário para uma nova tela `/selecionar-plano` mostrando dois planos com checkout no Kiwify. Substituir os planos antigos (R$29,90 mensal / R$69,90 trimestral) nos lugares onde aparecem.

## Novos planos
- **Mensal** — R$ 49,90/mês — `https://pay.kiwify.com.br/PMLV49m`
- **Até o dia da prova** — R$ 79,90, em até 2x sem juros (destaque "Melhor escolha") — `https://pay.kiwify.com.br/PMLV49m` *(mesmo link informado — confirmar se há link distinto ou se é intencional usar o mesmo checkout)*

## Mudanças

### 1. Nova página `src/pages/SelecionarPlano.tsx`
- Layout no estilo da marca (gradient night + flame), centralizado.
- Dois cards lado a lado (mobile: empilhados):
  - **Até o dia da prova** com badge "Melhor escolha", preço R$ 79,90, sub "2x de R$ 39,95 sem juros", benefícios, CTA "Garantir acesso".
  - **Mensal** R$ 49,90/mês, benefícios, CTA "Assinar mensal".
- Botão secundário "Continuar sem plano" → vai para `/`.
- Cliques nos CTAs abrem o link Kiwify em nova aba (`target="_blank"`).
- Rota pública apenas para usuários logados (envolver em `ProtectedRoute`).

### 2. `src/App.tsx`
- Adicionar `<Route path="/selecionar-plano" element={<ProtectedRoute><SelecionarPlano /></ProtectedRoute>} />`.

### 3. `src/pages/Auth.tsx`
- No fluxo de **signup** bem-sucedido, navegar para `/selecionar-plano` em vez de `/`.
- Signin continua indo para `/`.

### 4. `src/components/PlanSelectionDialog.tsx`
- Trocar os dois planos para os novos (Mensal R$49,90 e Até a Prova R$79,90 2x).
- Remover constantes `MONTHLY_URL`/`QUARTERLY_URL` e usar o novo link.

### 5. `src/pages/Plans.tsx`
- Atualizar card Premium para refletir os novos preços e oferecer as duas opções (reaproveitar `PlanSelectionDialog`).

## Arquivos
- novo: `src/pages/SelecionarPlano.tsx`
- editado: `src/App.tsx`, `src/pages/Auth.tsx`, `src/components/PlanSelectionDialog.tsx`, `src/pages/Plans.tsx`

## Observação
O usuário forneceu apenas **uma URL Kiwify** (`PMLV49m`) para os dois planos. Vou usá-la nos dois CTAs. Se houver um link separado para o "Até a prova" (R$79,90 2x), basta enviar que eu troco.
