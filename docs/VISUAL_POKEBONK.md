# Mapeamento visual do PokéBonk (25/10/2026)

Partida jogada em pokebonk.com (Floresta Verde, Clássico, Normal, Charmander, ~1 min, níveis 1–3)
e comparada com uma partida nossa no mesmo bioma (`npm start`, Charmander). O foco é o que separa os
dois na tela: mapa, sprites, animações, efeitos e câmera. Nada dos arquivos deles entra no repositório:
as artes deles têm dono; aqui só ficam medidas e técnicas.

## O que eles fazem

### Motor e câmera

- three.js (`/assets/three-*.js`), cena 3D real com câmera em perspectiva inclinada (~45–50°), que
  acompanha o jogador e gira com o mapa (há ícone de rotação). Aparece o horizonte: montanhas ao fundo,
  árvores distantes menores.
- Câmera próxima: o Charmander ocupa ~80 px de altura numa tela de 733 px (o nosso, ~30 px).

### Mapa

- **Relevo de verdade:** platôs com paredões de pedra em blocos (textura pixel-art com musgo), rampas
  de terra entre os níveis, o jogador sobe no platô. A arena é cercada por paredões, não por uma linha.
- **Texturas pixel-art em escala grande, sem suavização:** `env/<bioma>/ground.png`, `cliff.png`,
  `path.png` (caminhos de terra). O chão tem tufos em "ᴧ", florzinhas brancas/amarelas espalhadas e
  variação de verde em blocos de pixel visíveis.
- **Props em atlas:** `env/forest/atlas.png` 2048×128 com 23 sprites pequenos (23–89 px):
  `tree0..5`, `oak`, `bush`, `berrybush`, `tallgrass`, `fern`, `boulder`, `rocks`, `stump`, `log`,
  `hollowlog`, `mushrooms`, `glowshrooms`, `flowersA/B`, `sunflower`, `arch`. Desenhados em 3D como
  billboards ampliados 3–5× com filtro "nearest" — o pixel grande é intencional.
- **Água:** lagoas com borda de espuma pixelada e reflexo de nuvens em blocos.
- **Oclusão:** prop entre a câmera e o jogador fica translúcido (pontilhado) em vez de escondê-lo.
- Eventos e modelos especiais (torre, túmulos, abóboras do evento) vêm como `.glb`.

### Sprites e animações

- Mesmas sheets PMD que nós (`/data/sprites.json`: `walk`, `idle`, `attack`, `hurt`, `faint`,
  `charge`, 8 direções, duração por frame). A diferença não é a fonte: é a escala na tela, a
  orientação que acompanha a câmera e a morte (o inimigo derrete/achata no chão antes de sumir).
- Sombra elíptica e anel ciano brilhante sob o jogador; barra de HP com número logo abaixo dele.

### Efeitos

- Projéteis com sprite próprio de pixel-art (Ember: chama em gota com rastro), não círculos.
- Ataque de área como **decalque no chão** (Fire Spin: espiral laranja pintada no terreno).
- Números de dano pequenos, em pixel, sobre o alvo.
- "SEQUÊNCIA ×N" de abates na lateral; toasts de evento ("Altar — fique dentro do círculo…").
- Tela de nível: fundo desfocado, faixa "Nível N!" inclinada, cartas com cor de raridade e ícone do
  item, botões Atualizar (F) / Pular (X) / Banir (Z) com contadores.

### HUD

- Retrato grande circular com selo de nível; relógio em pílula; contador de abates; painel do recorde
  da temporada.
- Minimapa circular com bússola (N/S/L/O) e ícones de interesse: altares, baús, Poké Bolas, guardiões.
- Barra de golpes com ícone do tipo em cada slot e o ultimate num círculo com recarga radial.

## Onde estamos

- `src/render/renderer.js`: projeção ortográfica achatada (`DEPTH = 0.62`), chão é um tile procedural
  de manchas (`makeTile`), arena delimitada por `strokeRect`, props desenhados com elipses e
  retângulos (`drawProp`). Sem relevo, sem água, sem horizonte.
- Sprites PMD com as mesmas animações (`drawEnemy`/`drawPlayer` já escolhem `idle/walk/attack/hurt/faint`),
  mas pequenos (`CREATURE_SCALE = 0.046`).
- Minimapa existe (`hud.js`) mas mostra quase só o jogador.

## Plano (ordem por ganho visual ÷ esforço, tudo em Canvas 2D e offline)

| # | Mudança | Esforço | Onde |
|---|---|---|---|
| 1 | **Escala e câmera:** criaturas ~2,5× maiores, zoom mais próximo, `imageSmoothingEnabled = false` em tudo que é pixel. Rebalancear alcance de visão (spawn fora da tela). | P | `renderer.js` (`ZOOM`, `CREATURE_SCALE`, `resize`) |
| 2 | **Chão pixel-art:** pintar o tile em baixa resolução (64–128 px, paleta de 4–5 verdes, tufos "ᴧ", florzinhas) e ampliar sem suavização; caminhos de terra como segunda textura. | P | `makeTile`, `palette.js` |
| 3 | **Atlas de props próprio:** gerar por código (ou desenhar) sprites pequenos por bioma — árvores (3–4 formas), arbusto, samambaia, girassol, cogumelos, pedras, toco, tronco — num canvas offscreen, desenhados ampliados e ordenados por profundidade junto com as criaturas. | M | novo `src/render/props.js`, `drawProp` |
| 4 | **Bordas com paredão:** trocar o `strokeRect` por paredões de pedra em blocos com topo de grama (faixa vertical texturizada), dando a sensação de arena fechada. | P–M | `drawTerrain` |
| 5 | **Oclusão translúcida:** prop que cobre o jogador cai para alpha ~0,35. | P | loop de props |
| 6 | **Efeitos:** sprites de projétil por tipo (chama, gota, folha, raio) com rastro; vórtice e áreas como decalque no chão; números de dano menores em fonte pixel; morte achatando no chão. | M | `drawProjectiles`, `drawEffects`, `drawFloaters` |
| 7 | **Água e platôs decorativos:** lagoas com borda de espuma (colisão opcional) e platôs elevados desenhados com face de penhasco. Primeiro só visuais/obstáculos; subir no platô fica para depois. | G | terreno + `run.js` (colisão) |
| 8 | **Minimapa com pontos de interesse** (altar, baú, loja, boss, Poké Bola) e bússola. | P | `hud.js` |
| 9 | **Tela de nível:** fundo desfocado (`backdrop-filter`), faixa "Nível N!", cor por raridade. | P | `levelup` + `styles.css` |
| 10 | **Perspectiva real com horizonte** (câmera inclinada, rotação). | G | exige WebGL; ver decisão abaixo |

P = até meio dia, M = 1–2 dias, G = vários dias.

## Decisão pendente do dono

O item 10 é a maior diferença e não cabe no Canvas 2D sem um "mode 7" caro e frágil. As opções são:
(a) ficar no 2,5D e fechar a distância com os itens 1–9 (o grosso do ganho); (b) migrar o render para
WebGL — three.js vendorizado no bundle mantém o jogo offline, mas quebra a regra "sem dependências" e
muda todo o `src/render`. A avaliação abaixo detalha (b).

## Avaliação: render em WebGL com three.js vendorizado

### O que muda

- **Só o mundo.** `Renderer` é lido por um único ponto (`main.js`: `new Renderer(canvas)`, `resize()`,
  `render(run)`) e só lê o estado da run (`player`, `enemies`, `allies`, `projectiles`, `effects`,
  `floaters`, `pickups`, `events`, `eggs`, `biome`, `weather`, `time`, `shakeAmount`). A simulação já
  trabalha em `x, y, z` (`ring(x, y, z…)`, `floater(x, y, z…)`, pulo em `p.y`), então `src/game/*` não
  muda. HUD, menus, cartas e retratos são DOM e continuam iguais (inclusive o recorte CSS de
  `sprites.js`, que funciona em `file://`).
- **Reescrito:** os 986 linhas de `renderer.js` viram cena three.js: câmera em perspectiva que segue o
  jogador (e pode girar), chão como malha com textura pixel-art (`NearestFilter`), criaturas como
  billboards com UV do quadro PMD e a linha de direção calculada relativa à câmera, sombras como
  decalques, projéteis/anéis/áreas como malhas planas, névoa e luz no lugar de `drawNightTint`/clima,
  vinheta em CSS, números de dano em overlay DOM ou sprites de texto.
- **Ganho que só o WebGL dá:** horizonte, câmera inclinada e girando, névoa de distância, relevo
  (platôs/rampas) com ordenação por profundidade de graça, milhares de sprites com `InstancedMesh`.
- **O que o WebGL não dá:** a arte. Texturas de chão, paredões, atlas de props e sprites de projétil
  têm de ser feitos do mesmo jeito nas duas opções. E platôs onde se sobe são mudança de simulação
  (altura do chão em `run.js`) em qualquer render.

### Riscos (verificados ou medidos)

1. **`file://` bloqueia textura do disco — verificado.** No Edge headless, `texImage2D` com um
   `assets/pmd/4.png` carregado por `<img>` em `file://` lança `SecurityError: … contains cross-origin
   data`, e `fetch("4.png")` é rejeitado. O mesmo PNG como data URI vindo de um `<script src="4.js">`
   sobe sem erro (`gl.getError() = 0`). Saída: o build gera `dist/pmd/<id>.js` com o PNG em base64
   (+33 %: 21,6 KB → 28,8 KB no Charmander; ~30 MB → ~40 MB nas 971 sheets, carregadas sob demanda
   como hoje). O Canvas 2D atual não sofre disso porque só desenha, nunca lê pixels.
2. **Bundle num escopo só.** `build.mjs` concatena os módulos e remove `import/export`; o
   `three.module.js` tem centenas de nomes no topo (`clamp`, `lerp` inclusive, que já existem em
   `src/core`). Precisa entrar embrulhado numa função que devolve o namespace (~30 linhas no build e
   no `check-bundle`). O three não publica mais o build UMD.
3. **Tamanho.** three minificado é ~0,7 MB (estimativa, não medido aqui) contra 1,9 MB do bundle atual.
   Sem tree-shaking no nosso build, entra inteiro.
4. **Regra "sem dependências" do AGENTS.md** deixa de valer para o render. Licença MIT: copiar o
   `LICENSE` para `vendor/` e citar em "Provenance".
5. **Máquinas sem WebGL / GPU fraca.** Ou se mantém o render 2D como reserva (dois renders para
   manter), ou se aceita que o jogo não abre sem WebGL.
6. **Testes.** Nenhum teste toca o render hoje (o bot e os testes rodam só a simulação), então a
   suíte segue verde, mas também não pega regressão visual. O `npm run e2e` precisa subir o navegador
   com WebGL em software (`--use-angle=swiftshader --enable-unsafe-swiftshader`, que funcionaram no
   teste acima) e conferir que o canvas desenhou algo.

### Custo estimado

| Etapa | Esforço |
|---|---|
| Vendorizar three + embrulho no build + `dist/pmd/*.js` + e2e com WebGL | 1–2 dias |
| Paridade com o render atual (chão, criaturas 8 direções, sombras, projéteis, efeitos, floaters, clima, noite, tremor) | 4–6 dias |
| Arte nova (texturas, paredões, atlas de props, projéteis) — igual nas duas opções | 3–5 dias |
| Relevo jogável (altura do chão na simulação, colisão com paredão) — igual nas duas opções | 2–4 dias |

Total para chegar perto do PokéBonk em WebGL: ~10–17 dias, contra ~6–10 no 2,5D sem horizonte nem
câmera girando.

### Alternativa intermediária

WebGL puro sem three (um shader de sprite + um de chão, ~800–1500 linhas próprias): mantém "sem
dependências" e o bundle pequeno, mas é código de motor para manter; só compensa se o escopo 3D ficar
restrito a chão + billboards.

### Recomendação

1. Fazer primeiro a arte em formato neutro (canvases/atlas gerados por código): serve aos dois renders.
2. Aplicar no 2D os itens baratos (1, 2, 3, 5) — ganho imediato e pouco descartável.
3. Fazer um *spike* de 1–2 dias atrás de `?gl=1`: three vendorizado, chão + criaturas billboard + câmera
   inclinada, rodando em `file://` com `dist/pmd/*.js`. Decidir a migração vendo o spike, não a tabela.

## Limites deste mapeamento

- Só ~1 minuto jogado, na Floresta Verde, sem boss, sem santuário e sem outros biomas.
- Câmera e ângulos estimados por screenshot, não lidos do código deles.
