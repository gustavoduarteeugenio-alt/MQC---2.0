# MQC 2.0 — Implantação

Este repositório é **só o MQC 2.0**, o produto vendido na Hotmart. Ele não tem relação
com o app mensal criado no Lovable (repositório `prep-cfsd-buddy`), que continua com o
funil, o checkout Kiwify e o **banco próprio**. Os dois produtos não compartilham nada:
nem código, nem alunos, nem banco de dados.

Arquitetura:

| Camada | Onde |
|---|---|
| Frontend (Vite + React) | Cloudflare Pages, publicando deste repositório |
| Banco, Auth e Storage | projeto Supabase próprio do MQC 2.0 |
| Webhook da Hotmart | Edge Function `hotmart-webhook` no mesmo projeto Supabase |

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

No terminal, na raiz do projeto:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <ref>
```

```bash
npx supabase db push
```

Se a migration `20260504143609` falhar por causa do `pg_cron`, ative a extensão em
**Database → Extensions** e rode o `db push` de novo. Ela é legado (expiração de plano)
e não afeta o acesso pela Hotmart.

## 3. Publicar a Edge Function do webhook

```bash
npx supabase functions deploy hotmart-webhook
```

O `supabase/config.toml` já marca `verify_jwt = false`, porque a Hotmart não envia JWT
— quem autentica a chamada é o hottok.

Depois, em **Edge Functions → hotmart-webhook → Secrets**, cadastre:

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
primeira venda.

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
