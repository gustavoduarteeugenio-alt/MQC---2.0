## Problema
A página `/diagnostico` é pública (sem login), mas as policies RLS de `subjects` e `questions` só liberam `SELECT` para o role `authenticated`. Usuários anônimos recebem 0 linhas → toast "Nenhuma matéria cadastrada".

## Correção (migration)
Adicionar policies de leitura para `anon` nas duas tabelas, restritas ao mínimo necessário para o diagnóstico:

```sql
-- subjects: leitura pública (apenas metadados não sensíveis)
CREATE POLICY "Anon read subjects for diagnostic"
ON public.subjects FOR SELECT TO anon USING (true);

-- questions: leitura pública (necessária para sortear/exibir as 12)
CREATE POLICY "Anon read questions for diagnostic"
ON public.questions FOR SELECT TO anon USING (true);
```

## Considerações
- `questions` já é legível por qualquer usuário autenticado (inclusive contas grátis recém-criadas), então liberar para `anon` não expõe nada que já não esteja acessível com um cadastro de 10 segundos.
- Se preferir blindar, alternativa é criar uma **edge function pública** `diagnostic-questions` que usa service role e devolve só as 12 sorteadas — mais seguro, mais código. Recomendo a opção simples acima dado o conteúdo já ser semi-público.

## Arquivos
- 1 migration SQL nova (as duas policies).
- Nenhuma mudança em código frontend.
