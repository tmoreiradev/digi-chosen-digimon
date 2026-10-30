# Backlog — Digi Chosen

Itens levantados no code review de 23/10/2026 e **não** tratados na etapa de estabilização
(renomeação + três bugs confirmados + achados críticos). Nada aqui expande o escopo daquela
etapa; é a lista para a próxima fase ("o que está faltando").

## 1. Lacunas de mecânica (código existe, mas não está ligado ou está incompleto)

| # | Item | Onde | Observação |
|---|------|------|------------|
| 1 | ~~Modo Clássico sem guardiões, santuário e vitória~~ | `run.js` | **Feito na fase 2 (23/10):** `updateClassic`/`onBossDefeated`/`enterSanctuary`. Falta validar o balanceamento em jogo (HP do boss sai da curva de zona, não só do orçamento de DPS). |
| 2 | ~~Teto de burst e exaustão do boss nunca aplicados~~ | `run.js` `hitEnemy` | **Feito na fase 2:** `capDamage(amount * hitMul())` para o boss ativo (vale também para os guardiões da Torre). |
| 3 | ~~Só alfas ficam capturáveis~~ | `run.js` `hitEnemy`, `capture.js`, `boss.js` | **Feito na fase 9 (24/10):** guardiões de zona, lendário e guardiões da Torre (tiers `boss`/`totem`/`summoner`) enfraquecem abaixo de 10 % como os alfas; o boss para de atacar enquanto está "down"; captura = derrota para a progressão (`Boss.onCaptured`), sem o banner de abate; recruta com vínculo 1,5. Mesma chance dos alfas — validar em jogo se o lendário (captureRate 3 → 45 %) precisa de penalidade. |
| 4 | ~~Torre: director continua spawnando~~ | `run.js`, `tower.js` | **Feito na fase 6 (23/10):** director não roda na Torre; ondas e guardiões escalam pela curva do andar (`vmin`), não pelo tempo de parede (e não mais ao quadrado). ⚠ Bot honesto nível 50 morre sempre nos andares 5–7 — validar em jogo; ajuste candidato: `curve.min`/`curve.stage` dos andares 5–7 em `rules.json`. |
| 5 | ~~Conquistas sem recompensa~~ | `achievements.js` | **Feito na fase 3 (23/10):** `need` decide os unlocks a partir de um snapshot; `gold` pago ao run ou guardado em `profile.data.pendingGold`; tarefas também pagam e anunciam. Tela "Conquistas" na pausa desde a fase 4. |
| 6 | ~~Duas listas de capturados no perfil~~ | `profile.data.pokedex` | **Feito na fase 3:** `profile.data.caught` removido (saves antigos migrados por `normalizeProgress`); parceiro jogado conta como *visto*, capturas e ovos como *capturado*; título mostra `Caught: X / 1025`. |
| 7 | ~~Evolução re-sorteada a cada checagem~~ | `run.js` | **Feito na fase 7 (23/10):** `player.evoPlan` decidido ao definir a espécie (e após cada evolução); HUD mostra "→ Alvo at Nv N". |
| 8 | ~~Eventos de mundo consumidos ao abrir~~ | `events.js` | **Feito na fase 5 (23/10):** spawn a 12–24 u do jogador; baú consumido ao abrir, altar ao curar, loja só expira; loot do baú sorteado uma vez. Desbloqueio de parceiros do roster (captura por família + próximo parceiro a cada conquista/tarefa) entrou na mesma fase. |
| 9 | ~~Pausa durante o level-up~~ | `main.js` `onKeyDown` | **Feito na fase 7:** P/Esc são ignorados com as cartas abertas (elas já param o jogo); a pausa volta a funcionar assim que a carta é escolhida. |
| 10 | ~~Stats do upstream sem efeito~~ | `run.js`, `director.js`, `rules.js` | **Feito na fase 10 (24/10):** `shieldMax` (escudo que recarrega após 2,5 s sem dano), `thorns` (dano fixo de volta ao atacante), `bounces` (ricochete extra em todo golpe), `flinch` (chance de parar o alvo 0,5 s; boss imune), `powerup` (alarga as faixas de drop), `eliteSpawn` (ondas de elite maiores) e `enemyAmount` (teto populacional do director). `knockback` e `slam` não têm nenhuma carta que os altere e saíram do bloco (`STAT_NAMES` mantém os rótulos). |
| 11 | ~~Upgrades só com tags ficam fora do pool~~ | `run.js` `itemPool`, `scripted.js` | **Feito na fase 11 (24/10):** 22 dos 38 itens scriptados do upstream implementados (`src/game/scripted.js`) e oferecidos; a tag `type:` dos 18 itens de tipo passou a valer (+30 %/cópia em `typeBoost`). Na fase 17 entraram mais 14 e na fase 23 os dois últimos (Secret Key e Dowsing Machine, adaptados ao Altar Antigo e aos baús): todos os 38 no pool. |
| 12 | ~~Música de batalha nunca ativa~~ | `main.js` `loop` | **Feito na fase 12 (24/10):** o loop chama `music.setTheme(tema, run.boss.alive)` a cada frame (idempotente); tema de batalha enquanto guardião/lendário/guardião da Torre luta. |
| 21 | ~~Torre: HP dos guardiões ignora a curva de boss~~ | `boss.js` `spawn` | **Feito na fase 6:** guardiões usam a curva do andar com tier próprio (totem/summoner/boss) e HP = `clamp(orçamento, curva/4, curva)`. Os multiplicadores `totem ×2.2`/`summoner ×1.4` do `boss` config seguem sem uso: não cabem na fórmula de HP deste engine (floor 1 daria ~80k HP). |
| 22 | ~~Barra de HP do boss no HUD~~ | `hud.js` | **Feito na fase 4 (23/10):** `.hud-boss` sob o bloco de região com nome, tipo (Guardian/Legendary), fase e HP. |
| 23 | ~~`playerExpectedDps` subestima o jogador~~ | `run.js` | **Feito na fase 15 (24/10):** estimativa por golpe com `moveDamage × damage × físico/especial × STAB × item de tipo × crítico médio × projéteis ÷ recarga`, mais aliados; velocidade de ataque contada uma vez. Medido contra alvo único parado: erro de 2–5,6× → 0,74–1,32×. Guardião da zona 1 (nv 7) 4115 → 4815 HP. |

## 2. Qualidade / robustez

| # | Item | Onde |
|---|------|------|
| 13 | ~~HUD reconstrói slots e ult a cada frame (DOM churn)~~ | `hud.js` `update` | **Feito na fase 13 (24/10):** slots reconstruídos só quando golpes/vagas mudam, ult só quando o nome muda; por frame só classe `ready` e largura das barras. |
| 14 | ~~UI mista inglês/português, `lang="en"`, sem i18n~~ | **Feito na fase 8 (23/10):** `src/core/i18n.js` + literais traduzidos em todos os módulos de UI/jogo; `lang="pt-BR"`. Nomes próprios dos dados seguem em inglês. |
| 15 | ~~Passphrase das contas em texto puro no `localStorage`~~ | `account.js` — **Feito na fase 14 (24/10):** `passHash` (FNV-1a salgado pelo nome, 2000 iterações; só tira o texto puro de vista, não é proteção real); saves antigos migram no login; campo de senha mascarado. |
| 16 | ~~`screens.js` acessa `globalThis.__PB__.run`~~ | `screens.js` — **Feito na fase 14:** `Screens.getRun` injetado por `main.js` (o global `__PB__` fica só para depuração). |
| 17 | ~~URL malformada derruba o servidor de desenvolvimento~~ | `server.mjs` — **Feito na fase 14:** `%`-escape inválido responde 400; a checagem de raiz usa `path.relative` (o `startsWith` deixava passar uma pasta irmã `<raiz>2`); `handle` exportado e testado. |
| 18 | ~~`Capture.attempts` nunca é limpo; capturar incrementa `stats.items`~~ | `capture.js`, `run.js` — **Feito na fase 14:** bônus de tentativa apagado ao capturar ou quando o alvo morre enfraquecido; captura não conta mais como upgrade. |
| 19 | ~~`showResults` adiciona a espécie jogada a `caught`~~ | `screens.js` — **Já resolvido na fase 3:** o parceiro jogado conta como *visto*. |
| 20 | ~~Loop continua até 4 passos depois de um level-up~~ | `main.js` `loop` — **Feito na fase 14:** o laço de recuperação para (e zera o acumulador) quando abre carta, painel de evento ou a run termina. |

## 2b. Do mapeamento do PokéBonk (25/10)

- ~~Sobrecura sem efeito~~, ~~estados com nome dos dados mortos~~, ~~Molhado/Confuso/Encantado/Heal Block~~, ~~reações elementais~~, ~~mergulho~~ — fase 25.
- Pendentes: cargas de veneno (até 10) e de resfriamento (3); chance de paralisia travar; Laboratório/Stardust; Mochila; tarefas diárias/semanais; Contra o relógio; Poké Bolas pagas, Máquina do Bill, altares Unown/de guardiões, frutas; remapear teclas, mando e toque.

- Visual (mapa, sprites, efeitos, câmera): plano em 10 itens em `docs/VISUAL_POKEBONK.md`; avaliação do WebGL/three.js no mesmo doc, pendente a decisão (recomendado: spike `?gl=1`).
- Mecânicas e números do PokéBonk (diretor, chefes, interagíveis, eventos, Sobrevivência, Torre) com prioridades em `docs/MAPEAMENTO_POKEBONK.md`.
  - ~~Altar do guardião sob demanda + enxame final~~, ~~diretor por linha do tempo~~, ~~mapa da zona com bússola~~ — fase 26.
  - Pendentes da fase 26: portal depois do guardião; totem e invocador na linha do tempo da zona; ~~eventos de mundo (Eclipse, Névoa, Tempestade, Meowth dourado)~~ — fase 38 (`zoneevents.js`; falta céu/nuvens por evento e o elite tardio do eclipse); ícones dos eventos no minimapa; marcas livres no mapa (até 3).

## 2c. Fork em outro universo (Digimon)

- ~~Separar engine e pacote de conteúdo~~ — fase 27 (`src/content/pack.js`, `docs/PACOTE_DE_CONTEUDO.md`).
- Pendentes: efeitos de itens/habilidades e reações como dados; faixas de nível da evolução como dado (5 estágios); repositório do fork Digimon (20 espécies + 1 bioma para validar).

## 2d. Fork Digimon

- ~~Adventure, 02 e Tamers~~, ~~portraits do NSS~~, ~~procedural com cores do portrait~~ — fases 29–30.
- ~~Sprites de overworld para todos~~ — fase 31 (folhas de andar geradas pelo Codex).
- ~~Itens/vitaminas com nomes Digimon~~, ~~Torre fácil demais~~ — fase 34.
- ~~Mais regiões do Digimundo~~, ~~triângulo Vacina/Data/Vírus~~ — fase 35.
- ~~Folhas de ação, portraits ausentes, Numemon~~ — fase 36. Arte com resíduos de efeito em alguns quadros (45, 76, 89,
  106): refazer com `--kind action --redo --only <id>` se incomodar em jogo.
- ~~Idle de verdade~~ — fase 37. Sem idle próprio (o modelo desenha largo demais para a altura do andar, duas
  tentativas): 8, 25, 27, 41, 47, 108, 114, 126 — `--kind idle --redo --only <id>` de vez em quando. Clássico talvez fácil (10/10 seeds sobrevivem 10 min — validar com humano).

## 3. Funcionalidades futuras (do README e da especificação)

- Santuários e mercadores ambulantes: o santuário do Clássico (fase 2) e a loja ambulante (fase 5) existem; ~~renovação do estoque~~ feita na fase 20 (24/10).
- Tarefas/conquistas avançadas com recompensas aplicadas de verdade (ver item 5).
- ~~Nome de jogador permanente~~ — fase 21 (24/10): o nome da conta aparece como "Treinador" no título e nos resultados (convidado = "Convidado").
- ~~Mais itens segurados com efeito~~ — fase 18 (24/10): 13 itens (Leftovers, Choice Band, Life Orb e 10 de atributo).
- Roster completo de espécies/golpes/upgrades além das 40 da liga e 126 upgrades.
- ~~Tradução completa para pt-BR~~ — fase 8 (23/10); ~~escolha de idioma~~ — fase 22 (24/10): pt-BR / English no título; espanhol na fase 24.
- ~~Testes de interface no navegador automatizados~~ — fase 19 (24/10): `npm run e2e` joga o bundle por `file://` num Chromium headless. Fica fora do `npm test` porque precisa de um navegador instalado.
