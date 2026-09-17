# Método Questão Certa — Contexto Completo do Aplicativo

Documento único de referência: produto, UX/UI, frontend, backend, regras de negócio e modelo de negócio.
Atualizado em: 14/09/2026.

---

## 1. Visão geral do produto

**Nome:** Método Questão Certa (preparatório CFSd BM — Corpo de Bombeiros Militar)
**Público:** candidatos ao concurso CFSd BM, banca IDECAN.
**Promessa central:** "acertar 80% das questões até o dia da prova" através de treino direcionado às matérias mais fracas do aluno.

**Diferencial:** o app não é um banco de questões passivo. Ele calcula desempenho por disciplina e conduz o aluno para o que ele erra mais, em blocos curtos de 10 questões.

URLs principais:
- App publicado: `https://prep-cfsd-buddy.lovable.app`
- Login/cadastro: `/auth`

---

## 2. Modelo de negócio

### 2.1 O app como parte do curso

O app é um **subproduto de uma metodologia de ensino**. Ele não tem funil, página de vendas, diagnóstico público nem checkout próprio.

```
Compra do curso na Hotmart (aulas gravadas + acesso ao app)
        ↓
Webhook da Hotmart → Edge Function hotmart-webhook → profiles.approved = true
        ↓
Cadastro/login em /auth com o mesmo e-mail da compra
        ↓
Uso do app (treino, simulados, ranking)
```

- **Prazo de acesso: 1 ano** a partir da aprovação da compra. Recompra com o mesmo e-mail libera mais 1 ano a partir da nova aprovação.
- Reembolso ou chargeback na Hotmart retira o acesso automaticamente.
- Se o aluno comprou com outro e-mail, abre um ticket na tela de login e o admin libera manualmente.

### 2.2 Regras comerciais vigentes

- **Todo usuário liberado tem acesso ilimitado** ao banco de questões, gabaritos comentados e simulados. Não há planos, trial nem anúncios.
- Campos `plan`, `premium_until`, `premium_since`, `trial_started_at` e a tabela `daily_usage` continuam no schema como legado, sem efeito no acesso.

---

## 3. UX / UI

### 3.1 Identidade visual

Tema militar do Corpo de Bombeiros, definido inteiramente em tokens HSL no `src/index.css` e consumido via Tailwind (`tailwind.config.ts`).

| Token | Uso |
|---|---|
| `--primary` (laranja chama, `18 95% 52%`) | ações principais, destaque, ícone Flame |
| `--secondary` (azul institucional, `218 75% 28%`) | blocos de gabarito, botões secundários |
| `--accent` / `--destructive` (vermelho alerta) | erros, encerrar treino |
| `--success` (verde) | acertos |
| `--warning` (âmbar) | avisos, "aguardando liberação", selos de oferta |
| `--gradient-flame` | CTAs de conversão |
| `--gradient-night` | fundos de telas públicas e loading |

Classes utilitárias próprias: `stencil` (tipografia militar em caixa alta com tracking), `font-display`, `app-shell`, `shadow-flame`, `shadow-card`, `animate-pulse-flame`, `animate-fade-in`.

Regra: **nunca hardcodar cores** (`text-white`, `bg-[#...]`) em componentes — sempre tokens semânticos.

### 3.2 Layout

- Mobile-first, container `max-w-md` centralizado (formato app).
- Navegação inferior fixa (`BottomNav`): Início · Matérias · Simulados · Ranking · Progresso · (Admin) · Perfil.
- A `BottomNav` é ocultada em `/questao/*`, `/simulado/*` e `/auth` para foco total.
- Headers fixos com título centralizado e ações nas laterais (cronômetro, voltar).
- Feedback via toasts (`sonner`, posição `top-center`).
- Estado de loading padrão: ícone `Flame` pulsante sobre `bg-gradient-night`.

### 3.3 Telas principais

| Rota | Tela | Papel na experiência |
|---|---|---|
| `/` | RootRedirect | logado → `/inicio`; deslogado → `/auth` |
| `/auth` | Login/Cadastro | inclui card âmbar de "acesso ainda não liberado" com canal de suporte, polling de aprovação e estado de "acesso liberado" |
| `/sem-acesso` | Acesso pendente | usuário logado sem acesso (compra reembolsada ou prazo de 1 ano vencido, com a data): "verificar novamente" e atalho para o suporte |
| `/inicio` | Home limpa | 4 métricas (acerto geral, total respondidas, melhor e pior matéria) + botão "Treinar agora" que leva direto à questão certa |
| `/materias` | Matérias | lista de disciplinas, sem exibir quantidade de questões |
| `/questao/:slug` | Treino | placar de acertos/erros da sessão, cronômetro, alternativas A–E, gabarito comentado após confirmar, "Próxima questão" e "Encerrar treino" |
| `/treino/resumo` | Resumo da missão | feedback por matéria, tempo, ponto forte e ponto de foco |
| `/dashboard` | Progresso | estatísticas deduplicadas por questão |
| `/simulados`, `/simulado/:id` | Simulados | provas completas cronometradas no estilo IDECAN |
| `/ranking` | Ranking | abas "Geral" (treino) e "Simulados Inéditos", pódio ouro/prata/bronze e card fixo com a posição do usuário |
| `/perfil` | Perfil | dados, apelido de ranking e toggle de anonimato (LGPD) |
| `/suporte` | Suporte | chat com o administrador |
| `/admin` | Painel | questões, importação em massa, simulados, usuários, compras Hotmart, liberações de acesso e suporte |

---

## 4. Frontend

**Stack:** React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3 + shadcn/ui + React Router + TanStack Query + sonner + lucide-react. Testes com Vitest.

### 4.1 Estrutura

```
src/
├── App.tsx                 rotas + providers + RootRedirect
├── contexts/AuthContext    sessão Supabase (user, loading)
├── components/
│   ├── ProtectedRoute      guarda de rota (auth + acesso)
│   ├── BottomNav, AppShell, NavLink
│   ├── QuestionImage, RichText, OnboardingTour
│   └── admin/              ManageQuestions, BulkImport, ManageSimulados,
│                           SimuladoBulkImport, ManageUsers, AccessRequests,
│                           ManageAdmins, HotmartPurchases, SupportMessages
├── hooks/
│   └── useProfile          perfil, papéis, uso diário, hasAccess
├── lib/
│   ├── training.ts         getSubjectStats + pickNextSubject
│   ├── stats.ts            fetchDedupedAttempts
│   ├── access.ts           regra de acesso (approved + prazo de 1 ano)
│   └── training.test.ts    13 casos cobrindo a lógica de seleção
├── pages/                  telas listadas na seção 3.3
└── integrations/supabase/  client + types (gerados, não editar)

supabase/
├── functions/hotmart-webhook/  index.ts (Edge Function) + events.ts (parser testado)
└── migrations/
```

### 4.2 Padrões

- Acesso a dados direto pelo client Supabase (`@/integrations/supabase/client`), sem camada de API própria.
- Dados sensíveis (gabarito, explicação) nunca são baixados junto com a questão — vêm por RPC após a resposta.
- Paginação manual de 1000 em 1000 linhas ao varrer `questions` e `attempts`, para contornar o teto do PostgREST.
- Refetch de estatísticas ao voltar o foco da aba.

---

## 5. Backend (Lovable Cloud / Postgres)

### 5.1 Tabelas

| Tabela | Função |
|---|---|
| `subjects` | disciplinas (`name`, `slug`, `icon`, `display_order`) |
| `questions` | questões: `subject_id`, `statement`, `option_a..e`, `correct_answer`, `explanation`, `difficulty`, `banca`, `year`, `subtopic`, `image_url`, `comment_image_url` |
| `attempts` | respostas do treino: `user_id`, `question_id`, `selected_answer`, `is_correct`, `time_seconds` |
| `daily_usage` | contagem diária de questões (legado do limite básico) |
| `profiles` | `user_id`, `full_name`, `email`, `approved`, `access_until`, `ranking_name`, `show_in_ranking` (+ legado: `plan`, `premium_until`, `trial_started_at`, `diagnostic_results`) |
| `user_roles` | papéis separados do perfil: `admin`, `admin_didatico`, `user` |
| `simulados`, `simulado_questions`, `simulado_attempts` | provas completas, composição e resultados (`by_subject` em JSON) |
| `hotmart_purchases` | uma linha por transação Hotmart: `email`, `status` (`active`/`revoked`), `approved_at`, `access_until` (+1 ano), `last_event`, `last_event_at` |
| `hotmart_webhook_events` | log de eventos recebidos (sem payload bruto), idempotência por `hotmart_event_id` |
| `diagnostic_sessions`, `landing_leads` | legado do antigo funil; sem uso no app, dados mantidos |
| `tickets_suporte` | pedidos de liberação de acesso (usuários não aprovados) |
| `support_messages`, `support_replies` | chat de suporte aluno ↔ admin |

### 5.2 Segurança

- RLS habilitado em todas as tabelas públicas, com GRANTs explícitos por papel.
- `correct_answer` e `explanation` têm **SELECT revogado em nível de coluna**; só saem por RPC `SECURITY DEFINER` (`reveal_question_answer`, `reveal_questions_answers`) e apenas para usuários autenticados.
- Colunas de acesso de `profiles` (`approved`, `access_until`, `email`, `plan`, `premium_*`, `trial_started_at`) são protegidas pelo trigger `protect_profile_access_columns`: só admin, service_role ou funções `SECURITY DEFINER` alteram.
- `hotmart_purchases` e `hotmart_webhook_events`: SELECT só para admin; escrita só pela RPC `apply_hotmart_event` (service_role).
- A Edge Function `hotmart-webhook` roda sem JWT (`verify_jwt = false`) e valida o header `X-HOTMART-HOTTOK` contra o secret `HOTMART_HOTTOK`.
- `diagnostic_sessions` é fail-closed: INSERT/DELETE diretos negados; toda a interação passa por RPCs com validação de `client_token`.
- Papéis nunca ficam em `profiles` — sempre em `user_roles`, validados pela função `has_role()` (`SECURITY DEFINER`), evitando escalonamento de privilégio.
- `landing_leads` e `tickets_suporte` aceitam INSERT anônimo com validação de formato, mas SELECT apenas para admin.

### 5.3 Principais funções (RPC)

| Função | Uso |
|---|---|
| `apply_hotmart_event` | aplica um evento do webhook (idempotente, descarta eventos fora de ordem) e sincroniza `approved` |
| `sync_hotmart_access(email)` | `approved` = existe compra ativa e no prazo para o e-mail; `access_until` = maior prazo (casando por `auth.users.email`) |
| `check_account_approved(email)` | polling da tela de login; considera o prazo |
| `list_hotmart_purchases` | listagem do admin com indicação de conta criada |
| `reveal_question_answer` / `reveal_questions_answers` | gabarito após a resposta |
| `has_role`, `grant_role_by_email`, `revoke_role`, `list_staff`, `list_admins` | administração de papéis |
| `get_training_ranking`, `get_my_training_rank` | ranking geral |
| `list_published_simulados`, `get_simulado_ranking`, `get_my_simulado_rank` | ranking de simulados |
| `handle_new_user` (trigger) | cria `profiles` + papel `user` no cadastro; já nasce `approved` se o e-mail tem compra ativa |
| RPCs de diagnóstico (`get_diagnostic_questions`, `create_diagnostic_session`...) | legado do antigo funil, sem uso no app |
| `expire_premium_users` | rebaixa planos vencidos (legado) |

---

## 6. Regras de negócio

### 6.1 Acesso e autenticação

1. Cadastro cria automaticamente perfil e papel `user`. O perfil já nasce liberado (com `access_until`) se o e-mail tiver compra ativa e no prazo em `hotmart_purchases`; nesse caso o aluno entra direto.
2. Login é bloqueado enquanto `approved = false`: aparece card âmbar "acesso ainda não liberado", com caixa de texto para abrir ticket, botão "Voltar para o login" e persistência do estado em `localStorage`.
3. O app faz polling de `check_account_approved`; quando o webhook libera, a tela troca para "acesso liberado" com botão de login.
4. `ProtectedRoute` exige sessão; usuários sem acesso são enviados a `/sem-acesso` (rotas liberadas: `/sem-acesso`, `/perfil`).
5. `hasAccess = hasActiveAccess(profile) || isAdmin || isDidacticAdmin`, onde `hasActiveAccess = approved && (access_until nulo || access_until > agora)` (`src/lib/access.ts`).
6. Com o prazo vencido o aluno continua conseguindo logar, mas cai em `/sem-acesso` com a data de término; a renovação na Hotmart libera de novo.
7. Liberação manual pelo admin (Usuários ou Liberações de acesso) concede 1 ano a partir do momento da liberação.

### 6.2 Liberação pela Hotmart

- Eventos que **liberam**: `PURCHASE_APPROVED`, `PURCHASE_COMPLETE`. Eventos que **retiram**: `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK`. Os demais só ficam registrados.
- O acesso é por transação: o aluno fica liberado enquanto tiver **ao menos uma** compra ativa e dentro do prazo com o e-mail.
- O prazo conta de `data.purchase.approved_date` (ou da data do evento, se não vier) e não é estendido por `PURCHASE_COMPLETE`.
- Eventos repetidos (mesmo `id`) são descartados; eventos mais antigos que o último aplicado na transação não sobrescrevem o status.
- Secret opcional `HOTMART_PRODUCT_IDS` (IDs separados por vírgula) restringe quais produtos da conta dão acesso.
- Revogação afeta qualquer perfil com aquele e-mail, inclusive se ele tinha sido liberado manualmente.

### 6.3 Treino direcionado (núcleo do método)

**Estatísticas** (`src/lib/stats.ts`): apenas a **resposta mais recente por questão** é considerada (dedupe por `question_id`), evitando distorção por repetições.

**Escolha da disciplina** (`pickNextSubject`, meta = 80% de acerto):
1. Se errou a última → permanece na mesma disciplina (reforço).
2. Senão, fila de prioridade: disciplinas **não iniciadas** → disciplinas com acerto **< 80%**, da pior para a melhor.
3. Se o topo da fila for a disciplina atual e o aluno já tiver 2 acertos seguidos nela → alterna para a segunda pior (variedade).
4. Se todas estiverem ≥ 80% → modo revisão: a de menor acerto.

**Escolha da questão** (`/questao/:slug`):
1. Busca todos os IDs da disciplina, paginado.
2. Exclui todas as questões já respondidas pelo usuário.
3. Se sobraram inéditas, usa só elas; se não, libera repetição (modo revisão).
4. Embaralha (Fisher–Yates) e monta um bloco de **10 questões únicas**.
5. Ao concluir o bloco, encerra e retorna ao dashboard.

**Durante a questão:** cronômetro por questão, placar de acertos/erros da sessão, sem exibir "Questão X de Y" nem quantidade de questões da matéria. O gabarito comentado aparece após confirmar, para todos os usuários.

**Encerrar treino:** gera a tela "Resumo da missão" com acertos/erros, tempo, desempenho por matéria, ponto forte e ponto de foco.

**Regra transversal:** o app **nunca informa quantas questões existem** em cada matéria, em nenhuma tela.

### 6.4 Simulados

- Provas completas montadas pelo admin (`simulados` + `simulado_questions`), com duração padrão de 240 minutos.
- Cadastro em massa por planilha CSV/XLSX com validação no cliente.
- Resultado gravado em `simulado_attempts` com desempenho por matéria em JSON.

### 6.5 Ranking

- **Aba Geral:** total de acertos no treino, top 20, pódio ouro/prata/bronze, card fixo com a posição do usuário.
- **Aba Simulados Inéditos:** seleção por dropdown; conta **apenas a primeira tentativa finalizada** de cada usuário.
- Critérios de desempate: acertos DESC → tempo ASC → pontuação ponderada (Proteção e Defesa Civil, Direitos Humanos, Legislação) DESC → data da tentativa ASC.
- LGPD: o aluno escolhe apelido (`ranking_name`) e pode aparecer como "Anônimo" (`show_in_ranking`).

### 6.6 Suporte

- Aluno abre mensagem em `/suporte`; admin responde em formato de chat (`support_replies`), com papéis distintos e RLS por dono da mensagem.
- Usuários **não aprovados** usam o canal separado `tickets_suporte`, visível em Admin → Liberações de acesso.

### 6.7 Administração

Painel `/admin` (papéis `admin` e `admin_didatico`):
- Questões: CRUD, upload de imagens (bucket público `question-images`), importação em massa.
- Simulados: criação manual e importação de planilha.
- Usuários: liberar/revogar acesso manualmente.
- Hotmart: compras recebidas (ativa/revogada, se o comprador já criou conta), últimos eventos e URL do webhook.
- Liberações de acesso: fila de tickets de cadastro pendente (ex.: comprou com outro e-mail).
- Suporte: chat com alunos.
- Admins: conceder/revogar papéis por e-mail (`admin_didatico` tem acesso apenas ao conteúdo didático).

---

## 7. Lacunas conhecidas

- Não há edital/concurso nem hierarquia assunto/subassunto no banco — apenas `subjects` e o campo livre `subtopic`.
- `attempts` não tem restrição de unicidade; a deduplicação é feita na aplicação.
- O cálculo de estatísticas opera sob um teto prático de linhas lidas.
- Usuários liberados antes da Hotmart têm `access_until` nulo (sem prazo).
- O prazo é verificado no app (frontend e `check_account_approved`); as policies RLS das tabelas de conteúdo não checam acesso.
- Campos de plano/trial/`daily_usage`, tabelas e RPCs do antigo funil (diagnóstico, `landing_leads`) permanecem no schema como legado.
