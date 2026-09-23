# Identidade

`logo-mqc.jpg` é a marca do Método Questão Certa como veio do arquivo original.
Ela não é servida pelo app: os ícones saem dela.

`gera-icone.mjs` reduz a arte aos dois tons da marca — `#042649` e `#DD5723` —
descarta a textura do fundo e gera os PNGs quadrados em `public/`. A textura só
pesa: em PNG ela levava o arquivo de 19 KB para 600 KB.

A marca ocupa 80% do quadrado, deixando margem para o recorte redondo que
Android e iOS aplicam.

Para regerar depois de trocar a arte:

    npm i sharp
    node gera-icone.mjs
