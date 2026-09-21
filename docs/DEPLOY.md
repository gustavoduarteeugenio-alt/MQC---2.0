# MQC 2.0 — Implantação

Este repositório é **só o MQC 2.0**, o produto vendido na Hotmart. Ele não tem relação
com o app mensal criado no Lovable (repositório `prep-cfsd-buddy`), que continua com o
funil, o checkout Kiwify e o **banco próprio**. Os dois produtos não compartilham nada:
nem código, nem alunos, nem banco de dados.

Arquitetura:

| Camada | Onde |
|---|---|
| Frontend (Vite + React) | Cloudflare Pages, projeto `mqc---2-0` → https://mqc---2-0.pages.dev |
| Banco, Auth e Storage | projeto Supabase `nrlovulqehnnabrwqwbo` (São Paulo) |
| Webhook da Hotmart | Edge Function `hotmart-webhook` no mesmo projeto Supabase |

**Estado:** tudo acima está no ar desde 21/09/2026. Este documento serve para
refazer a instalação num projeto novo e como referência dos ajustes de painel.

---

## 1. Criar o projeto no Supabase

1. Em [supabase.com/dashboard](https://supabase.com/dashboard), **New project**.
2. Nome: `mqc-2.0`. Região: **South America (São Paulo)**, para reduzir latência.
3. Guarde a senha do banco num gerenciador de senhas. Ela não é usada no dia a dia.

Anote, em **Project Settings → API**:

- **Project URL** (`https://<ref>.supabase.co`)
- **anon / publishable key** — chave pública, embutida no frontend
- **Project ref** (o `<ref>` da URL)

> **Nunca** compartilhe em chat a `service_role key`, a senha do banco ou o hottok da
> Hotmart. A `service_role` é injetada automaticamente na Edge Function; o hottok é
> cadastrado direto no painel.

## 2. Criar a estrutura do banco

As migrations em `supabase/migrations/` montam tudo: tabelas, RLS, funções, o bucket
`question-images`, as disciplinas e as regras de acesso da Hotmart. O banco de questões
nasce **vazio**, por decisão de produto.

Pelo CLI, na raiz do projeto:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <ref>
```

```bash
npx supabase db push
```

**Se o CLI não funcionar** (na máquina usada em 09/2026 o npm falhava com
`UNABLE_TO_VERIFY_LEAF_SIGNATURE`, por inspeção de TLS do antivírus), o caminho
alternativo é o **SQL Editor** do painel. O script
`scratchpad/pgtest/build-and-test.mjs` (fora do repositório) gera
`supabase/bootstrap/parte-N.sql` concatenando as migrations, valida num Postgres real
via PGlite e registra as versões em `supabase_migrations.schema_migrations` para o CLI
não reaplicar depois. Cole uma parte por vez e clique em **Run**.

As partes são divididas nos `ALTER TYPE ... ADD VALUE`: o SQL Editor roda cada colagem
como uma transação, e o Postgres não deixa usar um valor de enum novo na mesma
transação em que ele foi criado (`admin_didatico`).

Se a migration `20260504143609` falhar por causa do `pg_cron`, ative a extensão em
**Database → Extensions** e rode de novo. Ela é legado (expiração de plano) e não
afeta o acesso pela Hotmart.

## 3. Publicar a Edge Function do webhook

```bash
npx supabase functions deploy hotmart-webhook
```

O `supabase/config.toml` já marca `verify_jwt = false`, porque a Hotmart não envia JWT
— quem autentica a chamada é o hottok.

Sem CLI, dá para criar a função pelo painel em **Edge Functions → Deploy a new
function**, colando `supabase/bootstrap/hotmart-webhook.ts` (versão de arquivo único,
gerada a partir de `index.ts` + `events.ts`). Nesse caminho, **desligue
`Verify JWT with legacy secret`** nas configurações da função e salve — o painel cria
com a verificação ligada, e aí a Hotmart é recusada antes de chegar ao código. Para
conferir: um POST sem token deve responder `{"error":"unauthorized"}` (nosso código) e
não `Missing authorization header` (portão do Supabase).

Depois, em **Edge Functions → Secrets**, cadastre:

| Secret | Valor |
|---|---|
| `HOTMART_HOTTOK` | o hottok da sua conta Hotmart (**Ferramentas → Webhook**) |
| `HOTMART_PRODUCT_IDS` | opcional: IDs dos produtos que dão acesso, separados por vírgula |

## 4. Criar o primeiro admin

O cadastro pelo app cria sempre um usuário comum. Crie sua conta em `/auth` e depois
rode no **SQL Editor**, trocando o e-mail:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'seu@email.com'
on conflict (user_id, role) do nothing;
```

Admin tem acesso ao app independente de compra, então dá para testar tudo antes da
primeira venda — tanto no `ProtectedRoute` quanto na tela de login (`isStaff` em
`src/lib/access.ts`).

## 5. Publicar o frontend na Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create**
   → **Pages** → **Connect to Git** → repositório do MQC 2.0.
2. Configuração de build:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Variáveis de ambiente (produção e preview):

   | Variável | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL do passo 1 |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key do passo 1 |
   | `VITE_SUPABASE_PROJECT_ID` | project ref |

4. O arquivo `public/_redirects` já manda toda rota para o `index.html`, o que faz
   `/inicio`, `/questao/...` e as outras rotas funcionarem ao recarregar a página.
5. Domínio próprio em **Custom domains**, se quiser.

Como as variáveis `VITE_*` são embutidas no bundle, qualquer troca delas exige um novo
build.

Se o build falhar em segundos com `bun install --frozen-lockfile`, procure por um
`bun.lockb` no repositório: a Cloudflare prefere o bun quando encontra esse arquivo.
O projeto usa npm.

## 5.1 URLs de autenticação

Em **Authentication → URL Configuration** do Supabase:

- **Site URL:** `https://mqc---2-0.pages.dev` (ou o domínio próprio)
- **Redirect URLs:** `https://mqc---2-0.pages.dev/**` e `http://localhost:8080/**`

Sem isso, o link de confirmação de e-mail e o de recuperar senha voltam para
`localhost:3000`, que é o padrão do projeto novo.

## 6. Configurar o webhook na Hotmart

Em **Ferramentas → Webhook**, cadastre:

- **URL:** `https://<ref>.supabase.co/functions/v1/hotmart-webhook`
- **Versão:** 2.0.0
- **Eventos:** compra aprovada, compra completa, reembolso, chargeback

Dispare o evento de teste e confirme em **Admin → Hotmart** que ele apareceu. A mesma
tela mostra a URL do webhook e se o comprador já criou conta.

## 7. Cadastrar conteúdo

Em **Admin → Questões** (uma a uma) ou **Importar Lote** (planilha CSV/XLSX). Simulados
em **Admin → Simulados**.

---

## Checklist antes de vender

- [ ] Migrations aplicadas (`supabase migration list` sem pendências)
- [ ] Edge Function publicada e `HOTMART_HOTTOK` cadastrado
- [ ] Evento de teste da Hotmart visível em Admin → Hotmart
- [ ] Compra de teste real liberando o acesso de ponta a ponta
- [ ] Confirmação de e-mail **ativa** em **Authentication → Providers → Email**; sem
      ela, alguém que saiba o e-mail de um comprador pode se cadastrar antes dele
- [ ] Ao menos um admin criado
- [ ] Questões cadastradas
- [ ] Domínio próprio apontado e testado no celular
