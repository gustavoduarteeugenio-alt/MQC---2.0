# Método Questão Certa — Contexto Completo do Aplicativo

Documento único de referência: produto, UX/UI, frontend, backend, regras de negócio e modelo de negócio.
Atualizado em: 15/08/2026.

---

## 1. Visão geral do produto

**Nome:** Método Questão Certa (preparatório CFSd BM — Corpo de Bombeiros Militar)
**Público:** candidatos ao concurso CFSd BM, banca IDECAN.
**Promessa central:** "acertar 80% das questões até o dia da prova" através de treino direcionado às matérias mais fracas do aluno.

**Diferencial:** o app não é um banco de questões passivo. Ele diagnostica, calcula desempenho por disciplina e conduz o aluno para o que ele erra mais, em blocos curtos de 10 questões.

URLs principais:
- App publicado: `https://prep-cfsd-buddy.lovable.app`
- Diagnóstico (porta de entrada pública): `/diagnostico`
- Página de vendas: `/ultima-chamada`
- Página de planos: `/selecionar-plano`
- Login/cadastro: `/auth`

---

## 2. Modelo de negócio

### 2.1 Funil

```
Tráfego (Instagram / anúncios)
        ↓
/diagnostico  → 12 questões gratuitas, sem login
        ↓
Captura de lead (nome + @Instagram) antes de liberar o resultado
        ↓
Resultado com pontos fracos + CTA "Liberar meu treino focado"
        ↓
Checkout Kiwify (pagamento externo)
        ↓
Cadastro em /auth
        ↓
Liberação manual do acesso pelo administrador (aprovação)
        ↓
Uso do app (treino, simulados, ranking)
```

### 2.2 Oferta e preços atuais

| Oferta | Preço | Checkout |
|---|---|---|
| Acesso até o dia da prova | R$ 79,90 (até 2x de R$ 39,95) — oferta principal | `https://pay.kiwify.com.br/5kq1jdL` |
| Mensal | conforme card em `/selecionar-plano` | `https://pay.kiwify.com.br/PMLV49m` |
| Campanha "Última Chamada" | R$ 97,00 | `https://pay.kiwify.com.br/5kq1jdL` |

**Importante:** o pagamento é 100% externo (Kiwify). Não há integração de webhook nem cobrança dentro do app. A ponte entre "pagou" e "usa" é **manual**: o administrador aprova o e-mail no painel.

### 2.3 Regras comerciais vigentes

- Não existe mais "plano básico" nem venda de gabarito: **todo usuário aprovado tem acesso ilimitado** ao banco de questões, gabaritos comentados e simulados.
- Não há anúncios em nenhuma tela.
- O acesso é controlado por aprovação administrativa (`profiles.approved`) e, tecnicamente, ainda existe um período de trial de 5 dias e campos de plano no banco — legado mantido para compatibilidade, sem uso comercial ativo.

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
| `/` | RootRedirect | logado → `/inicio`; deslogado → `/diagnostico` |
| `/diagnostico` | Diagnóstico | 12 questões fixas (2 por disciplina), sem gabarito durante a execução, captura de lead, resultado com matéria crítica e CTAs |
| `/auth` | Login/Cadastro | inclui card âmbar de "aguardando liberação" com canal de suporte, polling de aprovação e estado de "acesso liberado" |
| `/inicio` | Home limpa | 4 métricas (acerto geral, total respondidas, melhor e pior matéria) + botão "Treinar agora" que leva direto à questão certa |
| `/materias` | Matérias | lista de disciplinas, sem exibir quantidade de questões |
| `/questao/:slug` | Treino | placar de acertos/erros da sessão, cronômetro, alternativas A–E, gabarito comentado após confirmar, "Próxima questão" e "Encerrar treino" |
| `/treino/resumo` | Resumo da missão | feedback por matéria, tempo, ponto forte e ponto de foco |
| `/dashboard` | Progresso | estatísticas deduplicadas por questão |
| `/simulados`, `/simulado/:id` | Simulados | provas completas cronometradas no estilo IDECAN |
| `/ranking` | Ranking | abas "Geral" (treino) e "Simulados Inéditos", pódio ouro/prata/bronze e card fixo com a posição do usuário |
| `/perfil` | Perfil | dados, apelido de ranking e toggle de anonimato (LGPD) |
| `/suporte` | Suporte | chat com o administrador |
| `/admin` | Painel | questões, importação em massa, simulados, usuários, liberações de acesso, diagnósticos e suporte |
| `/ultima-chamada`, `/reta-final` | Vendas | landing pages públicas |
| `/selecionar-plano` | Oferta | pública, sem exigir cadastro |

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
│   ├── QuestionImage, RichText, AdBanner (inativo)
│   └── admin/              ManageQuestions, BulkImport, ManageSimulados,
│                           SimuladoBulkImport, ManageUsers, AccessRequests,
│                           ManageAdmins, ManageDiagnostics, SupportMessages
├── hooks/
│   ├── useProfile          perfil, papéis, trial, uso diário, hasAccess
│   └── usePremiumFeatures  flags de recursos (legado)
├── lib/
│   ├── training.ts         getSubjectStats + pickNextSubject
│   ├── stats.ts            fetchDedupedAttempts
│   └── training.test.ts    13 casos cobrindo a lógica de seleção
├── pages/                  telas listadas na seção 3.3
└── integrations/supabase/  client + types (gerados, não editar)
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
| `profiles` | `user_id`, `full_name`, `email`, `plan`, `premium_until`, `trial_started_at`, `approved`, `ranking_name`, `show_in_ranking`, `diagnostic_results` |
| `user_roles` | papéis separados do perfil: `admin`, `admin_didatico`, `user` |
| `simulados`, `simulado_questions`, `simulado_attempts` | provas completas, composição e resultados (`by_subject` em JSON) |
| `diagnostic_sessions` | sessões do diagnóstico público: `client_token`, respostas, resultado, `lead_name`, `instagram_handle` |
| `landing_leads` | leads das landing pages |
| `tickets_suporte` | pedidos de liberação de acesso (usuários não aprovados) |
| `support_messages`, `support_replies` | chat de suporte aluno ↔ admin |

### 5.2 Segurança

- RLS habilitado em todas as tabelas públicas, com GRANTs explícitos por papel.
- `correct_answer` e `explanation` têm **SELECT revogado em nível de coluna**; só saem por RPC `SECURITY DEFINER` (`reveal_question_answer`, `reveal_questions_answers`) e apenas para usuários autenticados.
- `diagnostic_sessions` é fail-closed: INSERT/DELETE diretos negados; toda a interação passa por RPCs com validação de `client_token`.
- Papéis nunca ficam em `profiles` — sempre em `user_roles`, validados pela função `has_role()` (`SECURITY DEFINER`), evitando escalonamento de privilégio.
- `landing_leads` e `tickets_suporte` aceitam INSERT anônimo com validação de formato, mas SELECT apenas para admin.

### 5.3 Principais funções (RPC)

| Função | Uso |
|---|---|
| `get_diagnostic_questions(_per_subject)` | 2 questões por disciplina, determinístico |
| `create_diagnostic_session` / `submit_diagnostic_answers` / `set_diagnostic_lead` / `claim_diagnostic_session` | ciclo completo do diagnóstico |
| `reveal_question_answer` / `reveal_questions_answers` | gabarito após a resposta |
| `check_account_approved(email)` | polling da tela de login |
| `has_role`, `grant_role_by_email`, `revoke_role`, `list_staff`, `list_admins` | administração de papéis |
| `get_training_ranking`, `get_my_training_rank` | ranking geral |
| `list_published_simulados`, `get_simulado_ranking`, `get_my_simulado_rank` | ranking de simulados |
| `list_diagnostic_sessions`, `get_diagnostic_overview` | métricas de diagnóstico no admin |
| `handle_new_user` (trigger) | cria `profiles` + papel `user` no cadastro |
| `expire_premium_users` | rebaixa planos vencidos (legado) |

---

## 6. Regras de negócio

### 6.1 Acesso e autenticação

1. Cadastro cria automaticamente perfil (`approved = false`) e papel `user`.
2. Login é bloqueado enquanto `approved = false`: aparece card âmbar "aguardando liberação do administrador", com caixa de texto para abrir ticket, botão "Voltar para o login" e persistência do estado em `localStorage`.
3. O app faz polling de `check_account_approved`; ao ser aprovado, a tela troca para "acesso liberado" com botão de login.
4. `ProtectedRoute` exige sessão; usuários sem acesso são enviados a `/trial-expirado` (rotas liberadas: `/trial-expirado`, `/planos`, `/perfil`).
5. `hasAccess = isPremium || trialActive || isAdmin || isDidacticAdmin`.

### 6.2 Diagnóstico

- Público, sem login. Sempre as **mesmas 12 questões** (2 por disciplina), ordem determinística.
- Nenhum gabarito é mostrado durante a execução.
- Após a 12ª questão, o resultado só é liberado depois do cadastro simples (nome + @Instagram).
- Comparação de resposta normalizada em maiúsculas.
- Resultado: percentual geral com cor (verde/amarelo/vermelho), desempenho por matéria e "Matéria mais crítica".
- Resultado persistido em `diagnostic_sessions` e, quando o usuário se cadastra, associado ao `profiles`.
- CTAs finais: "Liberar meu treino focado" (Kiwify) e "Criar conta / Entrar".

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
- Usuários: liberação de acesso (fluxo simplificado, sem restringir plano nem reiniciar trial).
- Liberações de acesso: fila de tickets de cadastro pendente.
- Diagnósticos: métricas (sessões, concluídos, leads, últimas 24h/7d, média) e exportação CSV de leads.
- Suporte: chat com alunos.
- Admins: conceder/revogar papéis por e-mail (`admin_didatico` tem acesso apenas ao conteúdo didático).

---

## 7. Lacunas conhecidas

- Não há edital/concurso nem hierarquia assunto/subassunto no banco — apenas `subjects` e o campo livre `subtopic`.
- `attempts` não tem restrição de unicidade; a deduplicação é feita na aplicação.
- O cálculo de estatísticas opera sob um teto prático de linhas lidas.
- Conciliação pagamento → liberação é manual (sem webhook Kiwify).
- Campos de plano/trial/`daily_usage` permanecem no schema como legado, sem efeito comercial hoje.
