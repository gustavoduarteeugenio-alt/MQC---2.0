## Objetivo
Bloquear o login de usuários ainda não aprovados (`profiles.approved = false`), mostrar um card de alerta na própria tela de login com um canal direto de suporte, persistir as mensagens em uma nova tabela `tickets_suporte` e dar ao admin uma aba para listar e aprovar com 1 clique.

---

## 1. Banco de dados (nova migração)

Criar tabela `public.tickets_suporte`:

- `id uuid pk default gen_random_uuid()`
- `user_id uuid null` (pode ser null porque o usuário está deslogado no momento do envio)
- `email_usuario text not null`
- `mensagem text not null` (limite ~2000)
- `status_resolvido boolean not null default false`
- `created_at timestamptz default now()`
- `resolved_at timestamptz null`
- `resolved_by uuid null`

RLS:
- `INSERT` liberado para `anon` e `authenticated` (`with check true`) — necessário porque o aluno envia sem sessão ativa.
- `SELECT` / `UPDATE` apenas para `has_role(auth.uid(), 'admin')`.
- Sem `DELETE`.

Índice em `created_at desc` e `status_resolvido`.

> Observação: já existe `support_messages`, mas ela exige `auth.uid() = user_id`. Como o usuário não-aprovado é deslogado, criamos a nova tabela conforme especificado, dedicada a pedidos de liberação.

---

## 2. Tela de Login (`src/pages/Auth.tsx`)

Fluxo:
1. Ao logar, se `profiles.approved !== true`, **NÃO** mostrar mais um `toast.error` simples. Em vez disso:
   - `supabase.auth.signOut()` (mantém comportamento atual de bloqueio).
   - Guardar `pendingEmail` em estado local e ativar `showPendingCard = true`.
2. Quando `showPendingCard` for true, substituir o formulário pelo **Card de Alerta** centralizado:
   - Borda `border-2 border-amber-400/70`, fundo `bg-amber-500/10`, ícone `AlertTriangle` âmbar pulsante.
   - Título: **⚠️ Aguardando liberação do administrador**
   - Corpo (texto exato do briefing): *"Seu cadastro foi realizado com sucesso! Nossa equipe está validando seu acesso junto à plataforma de pagamento. Em breve suas frentes de combate estarão liberadas. Se preferir, envie uma mensagem direto para o nosso suporte abaixo."*
   - `Textarea` (placeholder: *"Digite sua mensagem ou informe o e-mail cadastrado na Kiwifi..."*, maxLength 2000, com validação zod min 3).
   - Botão **"Enviar para o Suporte"** (gradient flame).
   - Link discreto **"Voltar para o login"** para reabrir o form.
3. Ao clicar em enviar:
   - Validar com zod (`email_usuario` = `pendingEmail`, `mensagem` ≥ 3 chars).
   - `supabase.from("tickets_suporte").insert({ email_usuario, mensagem, user_id: null })`.
   - Toast: *"Mensagem enviada! Analisaremos seu acesso prioritariamente."*
   - Desabilitar o botão e mostrar estado "Mensagem enviada ✓" (impede spam imediato).

Nada mais é alterado no fluxo de signup/signin existente.

---

## 3. Painel Admin (`src/pages/Admin.tsx` + novo componente)

Criar `src/components/admin/AccessRequests.tsx`:
- Lista `tickets_suporte` (ordem: pendentes primeiro, depois `created_at desc`).
- Cada item exibe: e-mail, mensagem, data formatada PT-BR, badge de status.
- Botão **"Aprovar Usuário"**:
  1. Busca `profiles` por `email = email_usuario` (case-insensitive).
  2. Se encontrado: `update profiles set approved = true, plan = 'premium', premium_since = now(), premium_until = now() + interval '1 year'` (alinhado com fluxo premium atual; ajustável se preferir só `approved=true`).
  3. `update tickets_suporte set status_resolvido = true, resolved_at = now(), resolved_by = auth.uid()` para o ticket.
  4. Toast de sucesso + refresh da lista.
  - Se e-mail não bate com nenhum `profiles`, toast de erro com instrução.
- Botão secundário **"Marcar como resolvido"** (só fecha o ticket sem aprovar).
- Filtro: Pendentes / Resolvidos / Todos.
- Realtime opcional (mesmo padrão de `SupportMessages.tsx`).

No `Admin.tsx`, dentro da aba/menu **Suporte**, adicionar uma sub-seção (Tabs ou seção acima de `SupportMessages`) chamada **"Liberações pendentes"** que renderiza `AccessRequests`.

---

## 4. Detalhes técnicos

- Reutilizar tokens do design system existente (`bg-gradient-night`, `text-primary`, `stencil`, `shadow-flame`); âmbar via `amber-400/500` (já presente nas hints do Auth).
- Validação client-side com `zod` (já usado em Auth).
- Sem alteração em `ProtectedRoute` / `useProfile` — o bloqueio continua sendo feito no submit do login.
- Sem mudanças no schema de `profiles`; usa o campo `approved` já existente.

---

## Fora de escopo
- Mudanças em `support_messages` / `support_replies`.
- Envio de e-mail automático para o aluno (pode ser adicionado depois via edge function).
- Auto-criação de profile a partir do ticket (admin precisa que o usuário já tenha se cadastrado).