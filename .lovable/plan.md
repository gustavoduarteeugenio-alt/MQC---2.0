# Jogar branch `METODO-QUESTAO-CERTA-2.0` para o novo repositório `MQC---2.0`

## Objetivo
Copiar a branch `METODO-QUESTAO-CERTA-2.0` (criada anteriormente no projeto) para o novo repositório `https://github.com/gustavoduarteeugenio-alt/MQC---2.0`, mantendo a sincronização atual da Lovable no repositório `prep-cfsd-buddy` e na branch `principal`.

## Requisitos já confirmados
- Novo repositório: `gustavoduarteeugenio-alt/MQC---2.0`
- Nome da branch no novo repositório: `METODO-QUESTAO-CERTA-2.0`
- Lovable permanece sincronizada no repositório atual `prep-cfsd-buddy`, branch `principal`.

## Limitação técnica a considerar
A Lovable não permite executar `git push` diretamente no sandbox (o estado git é gerenciado internamente). Além disso, a API REST do GitHub não consegue copiar uma branch entre dois repositórios diferentes sem transferir o histórico de commits. Portanto, a forma mais segura e completa é executar comandos git locais na máquina do usuário.

## Como será feito
1. Verificar se a branch `METODO-QUESTAO-CERTA-2.0` já existe no repositório atual `prep-cfsd-buddy`. Se não existir, criá-la a partir da `principal`.
2. Clonar o repositório atual e acessar a branch desejada.
3. Adicionar o novo repositório `MQC---2.0` como remote adicional.
4. Fazer push da branch `METODO-QUESTAO-CERTA-2.0` para o novo repositório.
5. Confirmar que o push foi bem-sucedido e fornecer o link direto da branch no GitHub.
6. Confirmar que a Lovable continua sincronizada no `prep-cfsd-buddy` / `principal`, sem alterar nada no projeto atual.

## Comandos sugeridos para execução local

```bash
# 1. Clonar o repositório atual
git clone https://github.com/gustavoduarteeugenio-alt/prep-cfsd-buddy.git
cd prep-cfsd-buddy

# 2. Verificar se a branch existe localmente e remota; senão, criar a partir da principal
git fetch origin

# Se a branch já existir no origin:
git checkout METODO-QUESTAO-CERTA-2.0

# Se não existir:
git checkout -b METODO-QUESTAO-CERTA-2.0 origin/principal

# 3. Adicionar o novo repositório como remote secundário
git remote add novo https://github.com/gustavoduarteeugenio-alt/MQC---2.0.git

# 4. Enviar a branch para o novo repositório
git push novo METODO-QUESTAO-CERTA-2.0
```

## Entregas
- Branch `METODO-QUESTAO-CERTA-2.0` disponível em `https://github.com/gustavoduarteeugenio-alt/MQC---2.0/tree/METODO-QUESTAO-CERTA-2.0`.
- Link direto para a branch no GitHub.
- Confirmação de que a Lovable continua no repositório e branch originais.
- Caso o usuário prefira não executar comandos localmente, orientar como fazer o mesmo via interface do GitHub (criar branch a partir de PR, fork, etc.) ou usar o GitHub Desktop.
