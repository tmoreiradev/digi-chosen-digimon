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
| Boss (`boss.js`) | fases, telegrafia, 8 ataques, teto de burst e exaustão | Clássico (guardiões, lendário) e Torre; teto/exaustão ligados desde a fase 2 (§11) |
| Torre (`tower.js`) | 7 andares, ondas, guardiões, vitória | funcional desde a §14 (6.ª/7.ª rodadas): o andar 5 travava na onda de meta 0 e um guardião recusado pelo teto ficava pendente para sempre; subida completa pelo bot (§15) |
| Captura/aliados (`capture.js`) | enfraquecer alfa, lançar bola, até 3 aliados que atacam | funcional |
| Eventos de mundo (`events.js`) | baú, loja (4 itens), altar; painel com teclado | funcional |
| Progressão (`achievements.js`) | 8 conquistas, 5 tarefas por espécie, ovos por passos, recompensas em ouro, tela na pausa | funcional desde as fases 3–4 (§12–13) |
| UI (`ui/*`) | título, perfis locais, roster, setup, HUD (com barra do boss), cartas de level-up, Pokédex (1025 espécies), pausa com conquistas/apelido/item/volume, resultados | funcional |
| Render/áudio | sheets PMD com 8 direções + fallback procedural; SFX e música sintetizados | funcional |
| Modo Clássico | 3 zonas de 5 min com guardião, santuário com lendário, vitória | funcional desde a fase 2 (§11); vencido de ponta a ponta pelo bot (§15) |

(Linhas desta tabela refletem o estado **atual**; o histórico de cada mudança está nas seções 11–15.)

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
| 3 | Upgrades de golpe mostrados na carta **nunca eram aplicados** (`rollChoices` não enviava `ups` a `applyChoice`) | `run.js` | `regressions.test.mjs`; **parcial até a 9.ª rodada** (§14): pierce/crit/status/bounce só chegavam a `mv.mods`, sem efeito no combate — hoje `effectiveDef` os aplica (`tests/moveups.test.mjs`) |
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
| Spawns **paravam para sempre** depois do 260.º inimigo da run: `spawnEnemy` recusava com `enemies.length ≥ 260` contando os mortos, e a compactação só acontecia acima de 520 (inalcançável) | `spawnEnemy` compacta os mortos antes de recusar. **Incompleto** (5.ª rodada): o teto populacional do director (≤ 240) também contava mortos e parava os spawns normais antes dos 260; desde então os mortos são removidos a cada frame em `updateEnemies`. |
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

**Terceira rodada** (`94acc78..23ad823`, `reviews/codex-2026-10-23-22-57-94acc78..HEAD.md`): **Aprovado com
ressalvas**, 2 achados, ambos aceitos:

| Achado | Decisão |
|---|---|
| `endRun` não fechava o painel de level-up: subir de nível no instante em que a run acaba deixava as cartas sobre os resultados e, com `levelup.active` preso, a run seguinte ficava congelada (P2) | Corrigido: `LevelUpPanel.close()` (usado também por escolher/pular) e `endRun` fecha o painel e zera `pendingLevelUps`. O teste `tests/levelup-panel.test.mjs` cobre só `close()`; `endRun` vive em `main.js` (não importável no Node) e foi validado no navegador: vitória com 32 level-ups pendentes → resultados limpos e run seguinte destravada. |
| P/Esc com baú/loja/altar aberto alternava `state.paused` e reiniciava a música com o painel ainda aberto (P2); invalida parte da afirmação da §4 sobre música | Corrigido: com painel de evento aberto, Esc fecha o painel e P é ignorado; a §4 passa a valer com essa regra. |

**Quarta rodada** (`94acc78..807db61`, `reviews/codex-2026-10-23-23-00-94acc78..HEAD.md`): **Aprovado com
ressalvas**, 2 achados, ambos aceitos:

| Achado | Decisão |
|---|---|
| Abrir um evento e morrer no restante do mesmo passo deixava o painel (e seu listener de teclado) sobre os resultados, vendendo itens de uma run encerrada (P2) | Corrigido duas vezes: `Run.update` para o passo assim que um painel abre (teste: inimigo colado não acerta no mesmo passo) e `endRun` fecha `run.events.panel` antes de parar a música (o fechamento religa a música; a ordem evita que ela toque nos resultados). |
| Rerolls gastos ficavam gastos nas runs seguintes (`LevelUpPanel` é um só; `rollsLeft` nunca voltava) (P2) | Corrigido: `LevelUpPanel.reset()` chamado em `startRun`; teste. |
| "O teste da 3.ª rodada cobre só `close()`" | Verdadeiro; a linha da 3.ª rodada foi corrigida para dizer isso e apontar a validação no navegador. |

**Quinta rodada** (`94acc78..8b4b826`, `reviews/codex-2026-10-23-23-03-94acc78..HEAD.md`): **Aprovado com
ressalvas**, 2 achados, ambos aceitos:

| Achado | Decisão |
|---|---|
| A compactação só rodava em `spawnEnemy` com 260 entradas, mas o teto do director (≤ 240) contava mortos: a arena esvaziava até um evento da timeline forçar spawns (P2); invalida parte da linha da §11 sobre spawns | Corrigido: `updateEnemies` remove os mortos a cada frame; teste pelo `Director.update` após 240 mortes. A linha da §11 foi anotada. |
| Lendário morto e jogador morto no mesmo passo: `boss.update` sobrescrevia `dead` com `victory` e os dois timeouts corriam (P2) | Corrigido: `onBossDefeated` ignora bosses derrotados quando a run já não está `running`; teste de morte simultânea. (A 6.ª rodada fechou a ordem inversa — ver abaixo.) |

**Sexta rodada** (`94acc78..d4a1844`, `reviews/codex-2026-10-23-23-06-94acc78..HEAD.md`): **Reprovado**, 2
achados, ambos aceitos:

| Achado | Decisão |
|---|---|
| **A Torre travava no 5.º andar** (P1, pré-existente): `waves: [34, 40, 0]` nos dados; a 3.ª onda com meta 0 nunca satisfazia `target > 0`, o guardião não acordava e não havia avanço nem vitória. A afirmação da §1 ("Torre funcional") estava errada para o andar 5. | Corrigido em `tower.js`: meta 0 significa "sem onda" e vai direto ao guardião. Teste percorre os 7 andares só pelas ondas (sem chamar `awakenGuardian`) até a vitória. |
| Timer de boss (meteoro) disparado **depois** de `boss.update` no mesmo passo matava o jogador já com a vitória declarada: os dois encerramentos eram agendados e a vitória chegava primeiro, contra o "derrota prevalece" da 5.ª rodada (P2) | Regra fechada: **o primeiro estado terminal do passo é final**. Morte antes do boss cair = derrota (5.ª rodada); boss caído antes do dano = vitória — `hitPlayer` ignora dano quando a run já não está `running`. Teste da ordem inversa. |

**Sétima rodada** (`94acc78..49e9ff8`, `reviews/codex-2026-10-23-23-09-94acc78..HEAD.md`): **Reprovado**, 1 achado,
aceito:

| Achado | Decisão |
|---|---|
| `pendingGuardian` ficava `true` mesmo quando `Boss.spawn()` era recusado pelo teto de 260 inimigos (corpos ainda em animação ocupam vaga): concluir a onda nessa condição travava o andar para sempre (P1) | Corrigido: `awakenGuardian()` devolve o inimigo e `pendingGuardian = !!e` — sem vaga, tenta de novo a cada passo. Teste: arena cheia → recusado e não pendente → horda some → guardião nasce. |
| §1 tinha linhas desatualizadas (boss só na Torre, teto desligado, conquistas sem recompensa, Clássico incompleto) | Tabela da §1 atualizada para o estado atual, com ponteiros para as seções. |

**Oitava rodada** (`94acc78..fffce5b`, `reviews/codex-2026-10-23-23-15-94acc78..HEAD.md`): **Aprovado com
ressalvas**, 2 achados, ambos aceitos:

| Achado | Decisão |
|---|---|
| Nos 900 ms entre a vitória/morte e os resultados, P/Esc ainda abria a pausa e "Quit to menu" chamava `endRun(false)`: uma vitória virava derrota sem Campeão (P2) | Corrigido em `main.js`: `endRun` deriva o resultado de `run.state` (`victory`) e `togglePause` não abre a pausa quando a run já terminou. Validado no navegador (P após a vitória não pausa; resultados "Victory!"). |
| O teste do bot honesto aceitava `dead` (P3) — a §15 anunciava "sobrevive" sem proteger a propriedade | Corrigido: o teste exige run viva (ou vitória) após os 600 s, nível ≥ 10, > 200 kills e zona ≥ 2. Se um rebalanceamento matar o bot, esse teste avisa. |

**Nona rodada** (`94acc78..3affa6f`, `reviews/codex-2026-10-23-23-18-94acc78..HEAD.md`): **Aprovado com
ressalvas**, 2 achados, ambos aceitos:

| Achado | Decisão |
|---|---|
| Cartas de upgrade de golpe ofereciam `pierce`, `crit`, `status` e `bounce`, mas o combate só lia `def.pierce`/`def.critBonus`/`def.statusChance` e ricochete não existia — a correção do item 3 da §3 era parcial (P2) | Corrigido: `Run.effectiveDef(mv)` funde os mods no def usado por cada disparo e acerto (`pierce` soma, `critBonus` soma, `statusChance` multiplica, `bounces`); `spawnProjectile` usa `def.pierce` (antes dobrava o valor); ricochete implementado (`bounceProjectile`: redireciona ao inimigo mais próximo ainda não atingido, até `bounces` vezes). |
| O teste dos upgrades só verificava `mv.mods` (P3) | `tests/moveups.test.mjs` testa efeitos observáveis: 2.º inimigo em linha atingido só com pierce, inimigo fora da linha atingido só com bounce, dano × `critDamage` com +crit, status aplicado com +status. |

**Décima rodada** (`94acc78..a8168ce`, `reviews/codex-2026-10-23-23-21-94acc78..HEAD.md`): **Aprovado com
ressalvas**, 4 achados no mesmo tema (upgrades sem efeito), todos aceitos:

| Achado | Decisão |
|---|---|
| `+dur` sem efeito: `dur` era calculado e não usado; rastro sempre 3 s, armadilha 6 s (P2) | `life = base × mods.dur × stats.duration` nas zonas de trail/trap. |
| `+count` ignorado por strike, beam, dash e smite (P2) | strike/dash: `count` golpes extras; beam: leque de `count` raios (±0,35 rad); smite: `count` quedas, cada uma no próximo inimigo mais próximo. |
| Ticks de zona usavam chance fixa de 25 %, ignorando `+status` (P2) | A zona guarda `statusChance = 0,25 × mods.status` e o tick usa esse valor (zonas hostis de boss mantêm 25 %). |
| Teste de upgrades só olhava `mv.mods` (P3) | `moveups.test.mjs` ganhou: golpe com `+count` dá o dobro, `+dur` estica as zonas, `+status` muda o resultado do tick. |

Com isso o item 3 da §3 fica integral para os stats que o engine consegue honrar; os demais deixaram de ser
oferecidos (11.ª rodada, abaixo).

**Décima primeira rodada** (`94acc78..1616fba`, `reviews/codex-2026-10-23-23-25-94acc78..HEAD.md`): **Aprovado
com ressalvas**, 4 achados, todos aceitos:

| Achado | Decisão |
|---|---|
| Regressão minha: com `+count`, os dois raios do beam desviavam ±0,175 rad e erravam um alvo a 20 unidades (P2) | O raio mirado fica no centro; os extras abrem em leque ao redor (±0,35, ±0,70…). Teste com alvo a 20 unidades. |
| `+dur` sem efeito em beam, cone, orbit, vortex e buff (instantâneos) (P2) | Não têm duração possível: `NO_EFFECT_UPS` tira essas opções das cartas (`rollMoveUps`). Clima passou a durar `12 s × dur`. |
| `+count` ignorado por trap, vortex, wave e random (P2) | trap: armadilhas extras em anel; vortex/wave: puxões/ondas extras; random: projéteis extras em leque. |
| `+speed` sem efeito em dash/wave/orbit e `+area` em chain/smite (P2) | orbit: rotação mais rápida; chain: alcance do salto = `area × 2` (base 16); smite: respingo de raio `area` em volta de cada queda; dash/wave: `+speed` não é oferecido. |
| (achado pelo teste novo do chain, pré-existente) o chain **nunca encadeava**: a cada salto procurava o inimigo mais próximo *a partir do alvo atual* sem excluí-lo — acertava o mesmo inimigo `count` vezes | Corrigido: cada salto vai ao inimigo mais próximo ainda não atingido; teste A → C e, com `+area`, B. |

Testes: `moveups.test.mjs` cobre beam fan, traps/waves extras, alcance do chain, respingo do smite e a
filtragem das cartas. Regra registrada: **toda carta de golpe oferecida tem efeito observável; o que o engine
não consegue honrar não aparece na carta.**

**Décima segunda rodada** (`94acc78..05a7932`, `reviews/codex-2026-10-23-23-46-94acc78..HEAD.md`): **Aprovado
com ressalvas**, 2 achados, ambos aceitos — e a última rodada desta série: doze rodadas, as três últimas só
com refinamentos do mesmo subsistema (cartas de golpe). Novas rodadas: `npm run review:codex -- <range>`.

| Achado | Decisão |
|---|---|
| `random` (Metronome) recebia `+area`/`+dur` mas disparava com `radius: 0.4` e `life: 1.5` fixos (P2) | Projétil usa `0,4 × mods.area × stats.area` e `1,5 s × dur`; teste com o disparo real. |
| `+status` era oferecido a golpes sem status (ex.: Dragon Pulse), onde multiplicar a chance não faz nada; o helper de teste injetava `burn` e escondia isso (P2) | `rollMoveUps` não oferece `status` quando `def.status` é nulo; teste com um golpe real sem status; o helper só injeta status quando o teste pede e diz. |

---

## 15. Playtest automatizado — um bot que joga (23/10/2026)

A pedido do dono: `tests/_bot.mjs` joga runs inteiras pelas mesmas superfícies que `main.js` usa — o objeto
`input` (WASD, Shift, R, E), `rollChoices`/`applyChoice` nos level-ups, `tryEvolve` a cada nível, e os
**botões** dos painéis de baú/loja/altar no DOM mínimo. Decide a cada 6 quadros (100 ms) e segura as teclas:
foge de inimigos próximos, vai a orbes de XP quando está seguro, anda até baú/loja/altar quando vale (altar
com HP < 60 %, loja com ouro), dasha quando encurralado, usa o ultimate em multidão, lança a bola em alfa
enfraquecido, fica longe das paredes; compra Rare Candy/poções/vitaminas com critérios simples. Não é bom
no jogo; é consistente (`Math.random` do jogo é substituído por um RNG com semente durante a partida).

Invariantes conferidos a cada meio segundo de jogo (`checkInvariants`): nenhum NaN em jogador/inimigos/
estatísticas, `0 ≤ hp ≤ maxHp`, `xp < xpNext` abaixo do teto, `stats.levels = level − 1`, jogador dentro
da arena, ≤ 260 inimigos e nenhum morto na lista, aliados ≤ cap, boss vivo com inimigo.

`tests/playtest.test.mjs` (parte do `npm test`; uma run de 20 min de jogo leva < 1 s de CPU):

| Cenário | Resultado (semente fixa) |
|---|---|
| Bot honesto, Clássico, 600 s, sementes 11–20 | **5 / 10 sobrevivem** os 600 s (todos esses passam da zona 1: guardião derrotado por conta própria, nível 25–30, 843–945 kills, 1–4 lojas e 1–4 baús usados); as 5 mortes acontecem entre 317 e 334 s, na luta contra o guardião da zona 1. Nenhuma morte antes dos 4 min; zero falhas de invariante. O teste exige exatamente isso (≥ 3 sobreviventes, nenhuma morte antes de 240 s) — é a linha de base de balanceamento (números após a fase 5). |
| Clássico até o fim (god mode: só imunidade a dano) | **vitória em 1179 s**: 3 guardiões, santuário, lendário; nível 50, 1844 kills |
| Torre até o fim (god mode) | **vitória em 331 s**: 7 andares pelas ondas reais |

O bot achou um bug na primeira execução: o empurrão de contato (`p.x -= dx/d·0.4` em `updateEnemies`)
acontecia **depois** do clamp da arena, e o jogador encurralado na parede saía do mapa (`x = -180.4`).
Corrigido com clamp após o empurrão. Limitação: o bot não lê o HUD nem a música; valida regras e
estabilidade, não aparência.

---

## 16. Fase 5 — Eventos de mundo ao alcance e desbloqueio de parceiros (23/10/2026)

**Eventos** (`events.js`, BACKLOG 8): nasciam em qualquer ponto de uma arena de 360 u (o bot ficou 10 min sem
encontrar um); agora aparecem a 12–24 u do jogador (dentro da arena). Olhar é grátis: `interact()` não
consome mais; o baú é consumido ao **abrir**, o altar ao **curar**, a loja só expira. O loot do baú é
sorteado uma vez por baú (sair e voltar não re-sorteia). Testes: `tests/events.test.mjs` (posição, baú
olhar/abrir, loja comprar/sair/expirar, altar cheio/curar).

**Parceiros** (`achievements.js`, `account.js`, `screens.js`): `profile.data.unlocked` nunca crescia e o
roster prometia "unlocked partners grow as you complete challenges". Regras: capturar (ou chocar) uma
espécie desbloqueia o parceiro do roster da **mesma família evolutiva** (Pidgeot → Pidgey; cada entrada do
roster é uma família distinta); cada conquista ou tarefa concluída desbloqueia o **próximo** parceiro
bloqueado na ordem do roster. Banner "Novo parceiro: X (captura|conquista)". Saves antigos sem `unlocked`
ganham os iniciais em `normalizeProgress`. Título mostra `Partners: X / 40`. Testes em
`achievements.test.mjs` e `pause.test.mjs`.

Navegador: baú a 21,5 u; sair mantém o baú com o mesmo loot ("37 gold" duas vezes); abrir consome e paga;
capturar Pidgeot → "Novo parceiro: Pidgey (captura)", `unlocked [1,4,7,16]`, roster com 4 cartas abertas e
36 travadas, título `Partners: 4 / 40`. Zero erros de console.

O bot (`_bot.mjs`) ganhou memória de eventos visitados — sem isso ele reabria a mesma loja a cada decisão
(1543 aberturas em 10 min numa semente) e morreu mais no guardião por andar atrás de lojas que não podia
pagar.
