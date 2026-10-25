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
muda todo o `src/render`. Recomendo (a) primeiro e reavaliar depois do item 7.

## Limites deste mapeamento

- Só ~1 minuto jogado, na Floresta Verde, sem boss, sem santuário e sem outros biomas.
- Câmera e ângulos estimados por screenshot, não lidos do código deles.
