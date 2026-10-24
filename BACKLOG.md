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
| 11 | ~~Upgrades só com tags ficam fora do pool~~ | `run.js` `itemPool`, `scripted.js` | **Feito na fase 11 (24/10):** 22 dos 38 itens scriptados do upstream implementados (`src/game/scripted.js`) e oferecidos; a tag `type:` dos 18 itens de tipo passou a valer (+30 %/cópia em `typeBoost`). Fora do pool, por falta de subsistema: soda-pop, adrenaline-orb, metal-powder, ice-heal, secret-key, old-rod, eviolite, shed-shell, cell-battery, dowsing-machine, griseous-orb, electirizer, silph-scope, max-ether, tm-case, poke-flute. |
| 12 | ~~Música de batalha nunca ativa~~ | `main.js` `loop` | **Feito na fase 12 (24/10):** o loop chama `music.setTheme(tema, run.boss.alive)` a cada frame (idempotente); tema de batalha enquanto guardião/lendário/guardião da Torre luta. |
| 21 | ~~Torre: HP dos guardiões ignora a curva de boss~~ | `boss.js` `spawn` | **Feito na fase 6:** guardiões usam a curva do andar com tier próprio (totem/summoner/boss) e HP = `clamp(orçamento, curva/4, curva)`. Os multiplicadores `totem ×2.2`/`summoner ×1.4` do `boss` config seguem sem uso: não cabem na fórmula de HP deste engine (floor 1 daria ~80k HP). |
| 22 | ~~Barra de HP do boss no HUD~~ | `hud.js` | **Feito na fase 4 (23/10):** `.hud-boss` sob o bloco de região com nome, tipo (Guardian/Legendary), fase e HP. |
| 23 | **`playerExpectedDps` subestima o jogador** | `run.js` | Ignora crítico, aliados, bônus de tipo e itens; o orçamento de HP do boss sai baixo e a luta fica na curva — validar em jogo. |

## 2. Qualidade / robustez

| # | Item | Onde |
|---|------|------|
| 13 | ~~HUD reconstrói slots e ult a cada frame (DOM churn)~~ | `hud.js` `update` | **Feito na fase 13 (24/10):** slots reconstruídos só quando golpes/vagas mudam, ult só quando o nome muda; por frame só classe `ready` e largura das barras. |
| 14 | ~~UI mista inglês/português, `lang="en"`, sem i18n~~ | **Feito na fase 8 (23/10):** `src/core/i18n.js` + literais traduzidos em todos os módulos de UI/jogo; `lang="pt-BR"`. Nomes próprios dos dados seguem em inglês. |
| 15 | Passphrase das contas em texto puro no `localStorage` (local, mas vale aviso) | `account.js` |
| 16 | `screens.js` acessa `globalThis.__PB__.run` para apelido/item (acoplamento com `main.js`) | `screens.js` |
| 17 | `decodeURIComponent` de URL malformada derruba o servidor de desenvolvimento | `server.mjs` |
| 18 | `Capture.attempts` nunca é limpo; capturar incrementa `stats.items` ("upgrades" nos resultados) | `capture.js`, `run.js` |
| 19 | `showResults` adiciona a espécie jogada a `profile.data.caught` ("Caught: X / 40" mistura jogados e capturados) | `screens.js` |
| 20 | Loop principal continua até 4 passos no mesmo frame depois de um level-up | `main.js` `loop` |

## 3. Funcionalidades futuras (do README e da especificação)

- Santuários, mercadores ambulantes e lojas de renovação de itens.
- Tarefas/conquistas avançadas com recompensas aplicadas de verdade (ver item 5).
- Nome de jogador permanente (hoje só apelido do Pokémon).
- Mais itens segurados com efeito (hoje Leftovers e Choice Band).
- Roster completo de espécies/golpes/upgrades além das 40 da liga e 126 upgrades.
- ~~Tradução completa para pt-BR~~ — feito na fase 8 (23/10); a escolha de idioma segue em aberto.
- Testes de interface no navegador automatizados (hoje: `node --test` + validação manual via console).
