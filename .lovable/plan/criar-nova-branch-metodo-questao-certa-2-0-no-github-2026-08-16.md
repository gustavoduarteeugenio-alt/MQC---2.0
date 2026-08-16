# Criar nova branch `METODO-QUESTAO-CERTA-2.0` no GitHub

## Objetivo
Criar uma nova branch chamada `METODO-QUESTAO-CERTA-2.0` no repositório `gustavoduarteeugenio-alt/prep-cfsd-buddy`, copiando o estado atual da branch `principal`, sem mudar o fluxo de sincronização da Lovable (que continua na `principal`).

## Requisitos já confirmados
- Nome da nova branch: `METODO-QUESTAO-CERTA-2.0`
- Lovable continua editando a branch `principal`; a nova branch fica disponível para trabalho via GitHub/IDE/CLI.

## Como será feito
1. Verificar se existe uma conexão GitHub disponível para chamadas de API (connector) que permita criar refs/branches via GitHub REST API.
2. Se a conexão existir: obter o SHA atual do commit mais recente da branch `principal` e criar a nova branch `refs/heads/METODO-QUESTAO-CERTA-2.0` apontando para esse SHA.
3. Se não existir conexão de API: orientar o passo a passo manual para criar a branch pelo GitHub (Settings > Branches > New branch) e fornecer o link direto do repositório.
4. Confirmar que o projeto Lovable permanece sincronizado na branch `principal`, sem risco de alterar o ambiente atual.

## Entregas
- Branch `METODO-QUESTAO-CERTA-2.0` criada no repositório.
- Link da nova branch no GitHub.
- Confirmação de que a Lovable continua na `principal`.
