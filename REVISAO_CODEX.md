# Digi Chosen — Revisão, Correções e Validação

**Pasta raiz do projeto:** `C:\Users\thex\Documents\Projeto Padrão` (mantida; o nome do projeto passou a ser **digi-chosen**)
**Build final:** `dist/digi-chosen.html` (1,75 MB, 971 sprites animados + 54 estáticos em `dist/pmd/` e `dist/front/`)
**Data:** 23/10/2026
**Tecnologia:** JavaScript vanilla (ES modules), Canvas 2D, Web Audio, localStorage — 100 % offline, sem dependências
**Versionamento:** Git local, branch `main`, sem remote (ver §8)

Este documento substitui o relatório anterior (que ainda afirmava coisas que o código não fazia). Cada
comportamento listado como corrigido aqui tem um teste automatizado ou foi exercitado no navegador — a
coluna "Como foi verificado" diz qual.

---

## 1. Estado do projeto

Jogo de sobrevivência/roguelite (clone local do PokéBonk) com ~7 800 linhas em `src/`:

| Área | O que existe | Etapa |
|---|---|---|
| Loop/simulação (`run.js`) | jogador (andar, pular, dash, i-frames), 26 arquétipos de golpe, status, clima, ultimate, pickups, XP/nível, evolução, upgrades/vitaminas/fusão/slots | funcional |
| Inimigos (`director.js`) | pool por bioma/zona, cartas, timeline (alfas, enxames, estouros, ondas de elites), 8 tiers | funcional |
| Boss (`boss.js`) | fases, telegrafia, 8 ataques, teto de burst e exaustão | só usado pela Torre; teto/exaustão não ligados (backlog) |
| Torre (`tower.js`) | 7 andares, ondas, guardiões, vitória | funcional |
| Captura/aliados (`capture.js`) | enfraquecer alfa, lançar bola, até 3 aliados que atacam | funcional |
| Eventos de mundo (`events.js`) | baú, loja (4 itens), altar; painel com teclado | funcional |
| Progressão (`achievements.js`) | 8 conquistas, 5 tarefas por espécie, ovos por passos | funcional; recompensas não concedidas (backlog) |
| UI (`ui/*`) | título, perfis locais, roster, setup, HUD, cartas de level-up, Pokédex (1025 espécies), pausa com apelido/item/volume, resultados | funcional |
| Render/áudio | sheets PMD com 8 direções + fallback procedural; SFX e música sintetizados | funcional |
| Modo Clássico | zonas a cada 5 min | **incompleto**: sem guardiões de zona, santuário ou vitória (backlog) |

---

## 2. Os três problemas confirmados — corrigidos

| # | Problema | Correção | Como foi verificado |
|---|---|---|---|
| A | **Primeiro ovo não era garantido** (`capture.js`): `markCaught()` rodava antes de `alreadyCaught`, que ficava sempre `true`; até a 1ª captura dependia dos 25 %. | "Primeira captura" definida **por run**: `run.capturesThisRun` (zera a cada `new Run`), lido **antes** de registrar a captura. 1ª captura da run → ovo garantido se não houver ovo ativo; seguintes → 25 %; ovo ativo nunca é sobrescrito (`giveEgg` recusa). | `tests/egg.test.mjs` (5 testes; falham no código antigo) + navegador: captura de alfa → "Você recebeu um ovo!", `profile.data.eggs.active = true`, eclosão após andar, aliado recrutado |
| B | **Rare Candy da loja deixava `xpNext` desatualizado** (`events.js`): subia o nível sem recalcular `xpNext` (ficava 15 no nível 2 em vez de 22), contava 1 nível mesmo se subisse vários, e usava `xpForLevel(level+1)` enquanto o resto do jogo usa `xpForLevel(level)`. | Caminho único em `run.js`: `addXp(amount)` resolve todos os níveis (level, xp, xpNext, `recompute`, `learnKitMoves`, `stats.levels`, `onLevelUp` por nível) e `useRareCandy()` chama `addXp(xpNext)`. Orbe de XP, Candy do chão e Candy da loja usam esse caminho. `MAX_LEVEL = 50` em `rules.js`; no teto `useRareCandy()` devolve `false`, a loja não aplica nem cobra e o botão fica desabilitado. Loja: `buy()` aplica o efeito e só então desconta. **Achado junto:** a loja e os baús usavam `player.stats.gold` (multiplicador de moedas ≈ 1, zerado a cada `recompute`) em vez da carteira `run.stats.gold` — nada era comprável; corrigido. | `tests/levelup.test.mjs` (6 testes) + navegador: compra no nível 4 com xp 5 → nível 5, xp 5, xpNext 54 = `xpForLevel(5)`, 2.º golpe do kit, ouro 500 → 400, cartas de level-up abrem **sobre** a loja (z 70 > 60), simulação congelada, tecla `1` escolhe a carta sem comprar o item 1, `0` fecha a loja, ouro inalterado |
| C | **Indicador ✓ do item segurado desatualizado** (`screens.js`): `current` era calculado fora de `refresh()`. | `current` lido dentro de `refresh()` (do `player`, ou do perfil quando não há run). | `tests/helditem.test.mjs` (4 testes, DOM mínimo) + navegador: Leftovers → Choice Band → Nenhum, ✓ acompanha, `localStorage` reflete, nova run restaura |

**Regra do Rare Candy adotada:** concede exatamente `xpNext` de XP → sobe **um** nível e **preserva** o XP
acumulado dentro do nível (antes, o Candy do chão zerava o XP e o da loja somava um valor errado).
**Regra do primeiro ovo adotada:** por run. Um ovo ainda chocando de uma run anterior bloqueia o ovo
garantido da run nova (sem sobrescrita).
**Caminho de persistência do ovo:** `profile.data.eggs` — `profile.data` já **é** o objeto `progress`
da conta (`account.js`), então não existe `profile.data.progress.eggs`; o relatório anterior estava errado.

---

## 3. Achados do code review — corrigidos nesta etapa

| # | Achado | Arquivo | Como foi verificado |
|---|---|---|---|
| 1 | `index.html` não tinha `<div id="ui">`: abrir baú/loja/altar pelo servidor local lançava `TypeError` (só o bundle tinha o elemento) | `index.html` | navegador (http): os três painéis abrem |
| 2 | Loja/baú usavam `player.stats.gold` (multiplicador) como carteira | `events.js` | teste + navegador |
| 3 | Upgrades de golpe mostrados na carta **nunca eram aplicados** (`rollChoices` não enviava `ups` a `applyChoice`) | `run.js` | `regressions.test.mjs` |
| 4 | Reroll descontado duas vezes (painel e handler) — 2 rerolls viravam 1 | `main.js` | leitura + código |
| 5 | `endRun` podia rodar duas vezes (timeout de morte após Quit) e quebrar em `showResults(null)` | `main.js` | leitura + código |
| 6 | Tecla 1–3 com as cartas abertas sobre a loja também comprava o item 1–3 (dois listeners em `window`) | `main.js` (`stopImmediatePropagation`) | navegador |
| 7 | `.levelup` (z 40) ficava **atrás** do painel de evento (z 60): Candy da loja abria as cartas escondidas | `styles.css` | navegador |
| 8 | `enemyById` devolvia `enemies[0]` quando o id não existia (alvo errado) | `run.js` | teste |
| 9 | Boss derrotado mantinha `index`; após compactar a lista o id resolvia para outro inimigo, que começava a usar ataques de boss | `boss.js` | teste |
| 10 | `markSeen` gravava no `localStorage` **a cada spawn** | `run.js` | teste |
| 11 | `eggs.save()` gravava no `localStorage` **a cada frame** (60×/s) | `run.js` | teste (0 gravações em 120 frames parados) |
| 12 | `recordSeen` gravava a cada chamada | `achievements.js` | teste |
| 13 | Inimigo enfraquecido (capturável) continuava perseguindo e dando dano de contato | `run.js` | teste |
| 14 | Projétil de aliado especial recebia `power` como **velocidade** e dava 10 de dano fixo | `capture.js`/`run.js` | teste |
| 15 | Time cheio: slots da formação ficavam com buraco após remover o mais antigo | `capture.js` | teste |
| 16 | `setInterval` da música recebia segundos (≈0,27) em vez de ms → sequenciador ~1000× rápido | `music.js` | teste (intervalo 273 ms) |
| 17 | HUD não refletia apelido novo até trocar de espécie | `hud.js` | navegador |
| 18 | Cartas de vitamina nunca recebiam o rótulo VITAMIN (`kind` é `newVit`/`upVit`) | `levelup.js` | leitura |
| 19 | Pokédex "Fechar" deixava a tela vazia (pausado sem menu) em vez de voltar à pausa | `screens.js` | `pause.test.mjs` + navegador |
| 20 | Volume salvo não era aplicado no boot (`accounts.load()` vinha depois da leitura) | `main.js` | navegador (recarga: 0,3) |
| — | Código morto removido: `closePanel`, `shopRow`, `ALLIES`, cálculo duplicado de chance, `SAVE_KEY`, imports sem uso | vários | `node --check` |

Total: **3 problemas confirmados + 20 correções do code review** (+ limpeza), todos com verificação.

---

## 4. Comportamentos preservados (regressão)

| Comportamento | Verificação |
|---|---|
| Captura recruta aliado e preserva shiny | `regressions.test.mjs` + navegador |
| Primeira conquista de captura desbloqueia | teste + navegador (`first_catch`, banner "Conquista: Primeiro Passo") |
| `AchievementTracker` usa o banner da run | teste |
| Leftovers e Choice Band na seleção (só itens com efeito) | teste + navegador |
| Passos de ovo gravados no perfil | teste (`profile.data.eggs.steps`) |
| Ovo concedido eclode após os passos e recruta aliado | teste + navegador |
| Equipe cheia (cap 3): mais antigo sai, slots contíguos | teste |
| Pausa mantida ao abrir Pokédex, Apelido e Item Segurado | `pause.test.mjs` (onResume nunca chamado) + navegador |
| Salvar, Cancelar e Fechar voltam à pausa | teste + navegador |
| Música acompanha os estados de pausa/eventos | navegador: `music.started` true em jogo, false em pausa/loja, true ao retomar (ver limitação de áudio) |
| Atalhos de baú (1/2), loja (1–3/0) e altar (1/2) sem execução duplicada | navegador |
| Listeners removidos ao fechar eventos | navegador (`_panelKey === null`, tecla 1 após fechar não compra) |
| Apelido e item sobrevivem a nova run e recarga | teste + navegador |
| Saves anteriores continuam carregando | `pause.test.mjs` (perfil sem `eggs`/`achievements`/`nickname`); chaves `pokebonk-clone.*` inalteradas |

---

## 5. Validação executada

| Verificação | Resultado |
|---|---|
| `node --check` em todos os módulos de `src/`, `build.mjs`, `server.mjs`, `scripts/`, `tests/` | ✅ |
| `npm test` (`node --test`, 5 arquivos, **29 testes**, dados reais do jogo, DOM mínimo em `tests/_dom.mjs`) | ✅ 29/29 — os testes dos bugs A/B/C e dos achados 3, 8–16, 19 **falham** contra o código antigo (conferido com `git stash`) |
| `npm run build` | ✅ `dist/digi-chosen.html` 1,75 MB, 971 sprites |
| `npm run check:bundle` (`scripts/check-bundle.mjs`: `node --check` no script gerado + script, dados e CSS idênticos aos fontes atuais) | ✅ — substitui o `check_bundle.mjs` citado pelo relatório anterior, que não existia |
| Navegador (embutido no Claude), servidor local `http://localhost:8080/` | ✅ fluxos acima exercitados pelo console (`__PB__`); **zero erros de console** |
| Bundle pelo servidor (`http://localhost:8080/dist/digi-chosen.html`) | ✅ dados embutidos (1025 espécies), 0 fetch de JSON, sprites carregados de `dist/pmd/`, run inicia, perfil restaurado |
| Bundle por `file://` (Edge headless, `--dump-dom`) | ✅ tela inicial renderizada ("Digi Chosen", "Runs/Best/Caught"), sem o banner "Failed to start", sem erros no log |

---

## 6. Limitações

- **Áudio não foi ouvido.** A correção do tempo da música é matemática (`setInterval` em ms, 273 ms a 110 bpm) e testada; o som em si não foi validado por escuta.
- **`file://` só foi validado no boot** (tela inicial, sem erro). Os dois navegadores de automação bloqueiam `file:`; os fluxos de jogo do bundle foram exercitados pelo mesmo arquivo servido por HTTP, que usa o mesmo caminho de código (`__POKEBONK_DATA__`, sem fetch, sprites relativos).
- **Validação visual foi feita por estado e screenshots pontuais**, não por um playtest humano. Balanceamento não foi avaliado.
- **Torre:** a linha que deveria suprimir os spawns do director (`this.spawnAccum = 0` em `run.js`) zera uma propriedade inexistente; não foi corrigida porque muda o ritmo das ondas (ver BACKLOG #4).
- A estrutura dos testes de UI usa um DOM mínimo próprio (`tests/_dom.mjs`); layout/CSS não são cobertos por testes.

---

## 7. Decisões e suposições registradas

| Decisão | Motivo |
|---|---|
| Nome `digi-chosen`; pasta, chaves do `localStorage` (`pokebonk-clone.*`) e o global `__POKEBONK_DATA__` mantidos | preservar saves e caminhos externos; o global é interno ao bundle |
| Créditos, licença CC BY-NC 4.0 das sheets e a proveniência dos dados mantidos no README | exigido pela especificação |
| Primeiro ovo **por run** | é o que o comentário do código pretendia; mais generoso e testável sem depender do perfil |
| Rare Candy = `+xpNext` (preserva progresso) para chão e loja | unifica os dois caminhos e cumpre a descrição "Gain 1 level worth of XP" |
| `MAX_LEVEL = 50` | a loja e o plano de evolução já assumiam 50 |
| Carteira = `run.stats.gold` (o que o HUD mostra) | `player.stats.gold` é o multiplicador de moedas |
| Moedas de baú entram sem multiplicador | regra simples; revisar se quiser aplicar `stats.gold` |
| `dist/` fora do Git (reproduzível com `npm run build`); `assets/` (30 MB de PNG) versionado | o bundle offline precisa das sheets ao lado |
| `.claude/` (launch.json local) ignorado no Git | ferramenta local |
| Commits sem trailer de coautoria | preferência registrada do dono |

---

## 8. Git

- Repositório inicializado nesta etapa (`git init -b main`), sem remote, nada enviado.
- `.gitignore` revisado antes do primeiro commit (node_modules, dist, data, logs, caches, saídas de teste, `.env`, `.claude/`); `.gitattributes` força LF.
- Histórico (mais antigo primeiro):

| Commit | Conteúdo |
|---|---|
| `94acc78` | estado inicial recebido (antes das correções) |
| `5473d26` | renomeação para digi-chosen |
| `57fdcd4` | correções A, B, C + carteira da loja + testes |
| `5e98953` | achados do code review (§3) + testes |
| último de `git log` | documentação (README, este arquivo, BACKLOG), `scripts/check-bundle.mjs`, `build.mjs` exportável |

---

## 9. Como executar

```bash
cd "C:\Users\thex\Documents\Projeto Padrão"
npm start            # servidor local → http://localhost:8080/
npm test             # 29 testes (node:test)
npm run build        # dist/digi-chosen.html + dist/pmd + dist/front
npm run check:bundle # bundle íntegro e igual aos fontes
```

Offline: abrir `dist/digi-chosen.html` com dois cliques (manter a pasta `dist/` inteira).

**Fluxo de teste manual sugerido:** iniciar uma run → `P` → Pokédex / Apelido / Item Seg. / Volume →
Resume → aproximar de um baú/loja/altar e apertar `E` → comprar Rare Candy (cartas abrem sobre a loja) →
enfraquecer um alfa (< 10 % HP), `E` para capturar → andar para chocar o ovo.

---

## 10. Pendências

Estão em [`BACKLOG.md`](BACKLOG.md): lacunas de mecânica (captura só de alfas, pacing da Torre,
recompensas de conquistas, duas listas de capturados), itens de qualidade e as funcionalidades futuras.
Nenhuma pendência bloqueia a execução do jogo.

---

## 11. Fase 2 — Modo Clássico (23/10/2026)

Implementa o item 1 do backlog (e o 2, que ele exige): guardiões de zona, santuário com lendário e
condição de vitória. Tudo usa dados que já estavam em `rules.json` (`biome.guardians`, `biome.bosses`,
`biome.legendaries`, `boss.fightSecs/zoneHp/guardianCurveMinutes/legendaryHpMul`).

**Fluxo** (`run.js`: `updateClassic`, `onBossDefeated`, `enterSanctuary`; `boss.js` chama
`run.onBossDefeated(kind)` em `onDefeat`, que também passou a ser o caminho da Torre):

1. Cada zona dura `STAGE_SECS` (300 s). No fim, em vez de avançar pelo cronômetro, nasce o **guardião**
   da zona — sorteado de `biome.guardians[zona]` (fallback `biome.bosses[zona]`; biomas sem nenhum dos
   dois mantêm o avanço por tempo). O director continua spawnando durante a luta.
2. Guardião derrotado → "Zone N cleared!" → `advanceStage()` (pool/timeline da zona seguinte).
3. Guardião da zona 3 derrotado → **santuário**: `run.sanctuary = true`, horda em fade, director
   suspenso, HUD mostra "Sanctuary"; 2,5 s depois chega o **lendário** (`biome.legendaries`, fallback
   Mewtwo). Stage fica em 3 (o santuário não é a zona 4).
4. Lendário derrotado → `run.state = "victory"` → `onVictory` → tela "Victory!" e conquista `champion`.
   Endless não muda (zonas por tempo, sem guardião).

**Correções que a fase exigiu/encontrou**

| Achado | Correção |
|---|---|
| Teto de burst/exaustão do boss nunca aplicados (backlog #2) | `hitEnemy`: `amount = boss.capDamage(amount * boss.hitMul())` para o boss ativo — no máximo 3 s de orçamento por rajada, ×0,15 durante a telegrafia, 2^(excesso/20) após 2× a duração prevista. Vale também para os guardiões da Torre. |
| `Boss.spawn` calculava `hpMult` da curva de boss e **nunca usava**; o HP vinha da curva viva da zona via `spawnEnemy` (no navegador: Mew com ~155 000 HP no minuto 5 da zona 3) | Guardiões/lendário são redimensionados pela curva de boss (`zoneHp`, `guardianCurveMinutes`, `legendaryHpMul`) × dificuldade; a Torre mantém a curva viva (seus multiplicadores nunca valeram e os andares estão calibrados assim — ver BACKLOG #21). |
| Spawns **paravam para sempre** depois do 260.º inimigo da run: `spawnEnemy` recusava com `enemies.length ≥ 260` contando os mortos, e a compactação só acontecia acima de 520 (inalcançável) | `spawnEnemy` compacta os mortos antes de recusar. |
| `main.js` chamava `tower.onGuardianDown()` no callback `onBossDown` | movido para `Run.onBossDefeated`; o callback só toca o jingle. |

**Validação**

- `npm test`: **36 testes** (7 novos em `tests/classic.test.mjs`: guardião nasce e segura a zona;
  zonas 1→2→3 → santuário → lendário → vitória única; Endless inalterado; Torre avança andar pelo
  novo caminho; teto de burst e exaustão; HP do boss independe do minuto da zona; lista de inimigos
  compacta).
- Navegador (servidor local, simulação acionada por `run.update` porque a aba do painel fica em
  segundo plano e o `requestAnimationFrame` não roda): Golduck (zona 1) → Pinsir (zona 2) → Nidoking
  (zona 3) → "Sanctuary" no HUD com a horda zerada → Mew → "Victory!" na tela de resultados,
  `champion` desbloqueada, zero erros de console. Rajada de 10⁹ contra o guardião tirou exatamente
  900 HP (3 s × `capRate` 300). Repetido após a correção do HP (jogador nível 1, dificuldade Normal):
  Golduck 4 203 HP (`capRate` 105/s, 40 s), Poliwrath 18 551, Nidoking 37 326, Mew 32 760
  (`capRate` 546/s, 60 s) — o lendário sai um pouco abaixo do guardião da zona 3 por desenho da
  curva (`zoneHp` 0,5 × 1,6 no minuto 0 contra o minuto 2,5 do guardião).
- `npm run build` + `npm run check:bundle`: ✅.

**Limitações:** balanceamento não jogado por humano — HP dos bosses segue `max(curva, DPS esperado × duração)`
e `playerExpectedDps` ignora crítico, aliados e bônus de tipo, então lutas podem passar da duração
prevista até a exaustão entrar. Sem barra de HP do boss no HUD (a barra sobre o sprite existe).

---

## 12. Fase 3 — Recompensas das conquistas e lista única de capturados (23/10/2026)

Itens 5 e 6 do backlog.

**Conquistas** (`achievements.js`)
- Cada conquista tem `gold` (20–300) e seu `need(snapshot)` passou a decidir o unlock: `check()` monta um
  snapshot (`caught`/`seen` da Pokédex, `shinyCaught`, `runs`, `wins`, `towerFloors`) e desbloqueia tudo
  que vale. `recordCatch`/`recordRun`/`recordSeen` só atualizam contadores e chamam `check()`; as
  checagens hardcoded sumiram. As 5 tarefas de espécie ganharam `gold` (40–60) e agora anunciam
  "Tarefa concluída: …" (antes desbloqueavam em silêncio).
- Pagamento: ao run em andamento (`run.stats.gold`); quando a run já acabou (`recordRun` — morte,
  vitória **ou Quit**, em que `run.state` continua `running`), o ouro vai para `profile.data.pendingGold`
  e o próximo `new Run` paga com o banner "Recompensas pendentes: +NG". O caso do Quit foi pego no
  navegador: a primeira versão pagava ao run que acabava de terminar (ouro perdido).
- Contadores: `runs`/`wins` vivem no perfil (`showResults` conta a run, `recordRun` a vitória); saves que
  tinham `achievements.runsCompleted/wins` maiores são migrados no construtor. Os inits mortos
  `profile.data.shinyCaught/runsCompleted/wins/towerFloors` sumiram.

**Lista única de capturados**
- `profile.data.caught` não existe mais; `profile.data.pokedex.{seen,caught}` é a fonte (captura e ovo
  eclodido entram em `caught`; o parceiro jogado entra só em `seen` ao fim da run — antes entrava na
  lista de capturados e teria contado para "Primeiro Passo").
- `normalizeProgress()` em `account.js` roda em `load`/`login`/`playAsGuest`: funde o antigo `caught` em
  `pokedex.seen` (as capturas reais já estavam em `pokedex.caught`) e apaga a chave. Título mostra
  `Caught: X / 1025` (antes dividia por 40, o tamanho do roster). Métodos mortos `Pokedex.markSeen/markCaught`
  removidos.

**Validação**
- `npm test`: **44 testes** (7 novos em `tests/achievements.test.mjs` + 1 em `pause.test.mjs`; os
  existentes ajustados para a lista única).
- Navegador: perfil antigo com `caught: [1,16]` carregou com `Caught: 1 / 1025` e a chave sumiu do
  `localStorage` no save seguinte; captura de Vulpix entrou em `pokedex.caught`; Quit numa run da Torre
  com `floor = 3` → "Subidor da Torre" desbloqueada, `pendingGold = 150`, run seguinte começa com 150 G
  e o banner "Recompensas pendentes: +150G". Zero erros de console. (Desde a §14 o `endRun` passa os
  andares **concluídos**, `floor - 1`; o mesmo teste manual exige `floor = 4`.)
- `npm run build` + `npm run check:bundle`: ✅.

**Limitações:** `unlocked` do roster (parceiros destravados) continua sem nenhum caminho que o aumente
(BACKLOG). A tela de conquistas chegou na fase 4 (§13).

---

## 13. Fase 4 — Tela de conquistas e barra de HP do boss (23/10/2026)

- **Conquistas** (`screens.js` `showAchievements`, botão "Conquistas" na pausa): lista as 8 conquistas e as
  5 tarefas com ✓, descrição, barra e texto de progresso (`atual / meta`) e a recompensa; cabeçalho com
  `X / 8 conquistas · Y / 5 tarefas · ouro pendente`. Para expor o progresso, `ACHIEVEMENTS[]` trocou o
  predicado `need` por `stat` + `goal` (unlock = `snapshot[stat] >= goal`) e o snapshot virou a função pura
  `progressSnapshot(progress)`, usada pelo tracker e pela tela. "Fechar" volta à pausa sem retomar.
- **Barra do boss** (`hud.js`): `.hud-boss` sob o bloco de região, visível só com `run.boss.alive`:
  nome + tipo (`· Guardian` / `· Legendary`), `Phase N · hp / max`, preenchimento proporcional.
- Testes: `tests/hud.test.mjs` (2; o DOM mínimo ganhou `getContext()` no-op, `style.setProperty` e
  `classList.toggle`) e a tela em `pause.test.mjs` — **47 testes**.
- Navegador: menu de pausa com "Conquistas"; tela com 13 linhas, 4 desbloqueadas no perfil de teste
  (Primeiro Passo, Veterano, Campeão, Subidor da Torre), "Dex 50" em 28 / 50; Fechar → "Paused"; barra do
  boss oculta sem boss e, com o guardião Golduck a 42 % na fase 2, "Golduck · Guardian" + "Phase 2 ·
  1766 / 4203", largura 42 %, posicionada a 132 px do topo sob a região. Zero erros de console.
- `npm run build` + `npm run check:bundle`: ✅.

---

## 14. Revisão externa (Codex CLI) e correções (23/10/2026)

A pedido do dono, todo o entregue (`94acc78..d509872`) foi submetido ao Codex CLI
(`codex exec -s read-only -c windows.sandbox=unelevated`, worktree limpo do HEAD). Relatório bruto em
`reviews/codex-2026-10-23-1947-94acc78..d509872.md`. Veredito dele: **Reprovado** — com razão no P1.

| Achado do Codex | Decisão |
|---|---|
| `.gitignore` `data/` ignorava também `src/data/`: **`game-data.js` e as 9 tabelas JSON nunca entraram no Git** — um clone não roda, não testa nem builda (P1) | **Verdadeiro e grave.** A regra veio do estado recebido e passou despercebida porque os arquivos existem na pasta de trabalho e `git status` fica "limpo" com ignorados. Corrigido em `199ccb5`: regra ancorada `/data/` e `src/data` versionado (10 arquivos). As afirmações de §7/§9 ("build reproduzível a partir do repositório") só valem a partir desse commit. |
| `endRun` só checava se havia *alguma* run: morrer, sair e começar outra em < 900 ms deixava o timeout antigo encerrar a run nova (P1) | Corrigido: `endRun(victory, expected)` recebe a run que agendou o fim e ignora se `state.run` já é outra. |
| `tower.floor` é o andar atual, não os concluídos: sair no início do 3.º andar dava "Complete 3 andares" (P2) | Corrigido: `endRun` passa `floor - 1` (ou `floor` com a torre limpa). O exemplo da §12 foi anotado. |
| `champion` conta vitórias na Torre, mas a descrição dizia "modo clássico" (P2) | Decisão: vitória na Torre também vale; descrição passou a "Vença uma run (Clássico ou Torre)". |
| Exaustão multiplicava o dano **antes** do teto: com o orçamento consumido, o dano efetivo continuava preso a `capRate` (P2) | **Verdadeiro.** `capDamage` agora escala a taxa por `exhaust()`; teste reforçado (dano efetivo medido). A afirmação da §11 sobre a exaustão só vale a partir daqui. |
| Burn/poison tiravam HP direto, fora do orçamento do boss (P2) | Corrigido: os ticks passam por `capDamage(dmg × hitMul())`; teste novo. |
| Eclosão registrava `caught` mas não `seen` (P2) | Corrigido em `Run.markCaught` (marca `seen` também); teste ajustado. |
| Tarefa "Faça um aliado evoluir" era concluída pela evolução do **jogador** (P2) | Aliados não evoluem; descrição ajustada ("Evolua seu parceiro durante uma run"), chave mantida pelos saves. |
| Teste de exaustão só consultava `hitMul()` (P3) | Reforçado: compara HP perdido antes/depois da exaustão. |
| "Resultados de teste não puderam ser reconfirmados: `npm test` bloqueado por `spawn EPERM`" | Limite do sandbox do Codex no Windows (não executa `node`). O script `scripts/codex-review.mjs` roda `npm test` e `check:bundle` **fora** do sandbox e anexa a saída ao prompt. |

**Como o Codex passa a ser chamado:** `npm run review:codex -- <range>` → worktree descartável do commit
revisado, `npm test` + build + `check:bundle` executados **nesse worktree** e colados no prompt, prompt
enviado por stdin sem argumento (com o prompt como argumento o `codex exec` fica preso em "Reading
additional input from stdin"; o `-` literal é rejeitado), `-c windows.sandbox=unelevated` no Windows,
relatório em `reviews/` (a mensagem final vem do stdout — o `-o` do codex 0.164 não gravou arquivo),
exit 1 em "Reprovado". `AGENTS.md` dá ao Codex (e a qualquer agente) comandos e regras do repositório.

**Segunda rodada** (`94acc78..17f341f`, `reviews/codex-2026-10-23-2254-94acc78..17f341f.md`): **Aprovado
com ressalvas**, 3 achados, todos aceitos:

| Achado | Decisão |
|---|---|
| Andares 5–7 da Torre acordam `kind: "boss"`, que `awakenGuardian` converte em `"guardian"`; o redimensionamento pela curva de boss (feito para o Clássico) os apanhava — regressão contra "a Torre mantém a curva viva" (P2) | Corrigido: a decisão passa a ser pelo modo (`run.tower`), não pelo tipo; teste com o andar 7. |
| O script rodava testes/bundle no checkout, não no worktree do commit revisado (P3) | Corrigido: tudo roda dentro do worktree (inclusive o build, já que `dist/` não é versionado). |
| Teste de DoT só cobria burn (P3) | Corrigido: casos separados para burn e poison. |
