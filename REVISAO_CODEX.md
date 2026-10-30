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
com ressalvas**, 2 achados, ambos aceitos — e a última rodada da série inicial: doze rodadas, as três últimas só
com refinamentos do mesmo subsistema (cartas de golpe). Cada fase nova ganha a sua rodada por `npm run review:codex -- <range>`
(a 13.ª, da fase 8, está abaixo).

| Achado | Decisão |
|---|---|
| `random` (Metronome) recebia `+area`/`+dur` mas disparava com `radius: 0.4` e `life: 1.5` fixos (P2) | Projétil usa `0,4 × mods.area × stats.area` e `1,5 s × dur`; teste com o disparo real. |
| `+status` era oferecido a golpes sem status (ex.: Dragon Pulse), onde multiplicar a chance não faz nada; o helper de teste injetava `burn` e escondia isso (P2) | `rollMoveUps` não oferece `status` quando `def.status` é nulo; teste com um golpe real sem status; o helper só injeta status quando o teste pede e diz. |

**Décima terceira rodada** (fase 8, `4177152..76ce28d`, `reviews/codex-2026-10-24-00-42-4177152..HEAD.md`):
**Aprovado com ressalvas**, 1 achado (P3), aceito, e uma afirmação da §19 contestada com razão:

| Achado | Decisão |
|---|---|
| Pausa → Item segurado mostrava as descrições de Leftovers e Choice Band em inglês, direto do `items.json` (P3) | Corrigido: `HELD_ITEM_DESC_PT` em `src/core/i18n.js` descreve **o efeito que este engine implementa** ("Recupera cerca de 1/16 do HP máximo por segundo.", "+50% de dano em todos os golpes."), não o texto dos jogos (que falava em "só permite um golpe", algo que não existe aqui). `heldItemDesc(key, def)` cai no `desc` dos dados para um item sem tabela. Teste em `tests/helditem.test.mjs` (falha no código antigo). Verificado no navegador. |
| "§19 diz que *todos* os textos foram traduzidos; as descrições dos itens segurados não foram" | Verdadeiro; fechado pela correção acima. Os únicos textos em inglês que restam na tela são nomes próprios dos dados (espécies, golpes, itens, habilidades, papéis do roster, ultimates), por decisão. |

**Décima quarta rodada** (fases 9–11, `4b7f46e..e7907de`, `reviews/codex-2026-10-24-02-18-4b7f46e..HEAD.md`):
**Reprovado**, 5 achados, todos aceitos; três afirmações da §20/§22 contestadas com razão (corrigidas no lugar):

| Achado | Decisão |
|---|---|
| Poké Doll tem `mods: []` e nenhuma tag: escolhê-lo não recalculava os stats, a passiva ×1,5 só valia no próximo recálculo (P2) | `applyChoice` recomputa em **todo** item (é barato). Teste: aliado recrutado, pegar o Poké Doll muda `player.stats.damage` de `1 + 0,04` para `1 + 0,06` na hora. |
| Grip Claw e Awakening aplicam root/sleep, mas `updateEnemies` só amortecia a velocidade e voltava a perseguir: dormindo/congelado/enraizado andava a ~36 % e mordia (P2) | Pré-existente e verdadeiro para freeze/sleep/root de qualquer golpe. Os quatro estados (com `flinch`) agora param o inimigo: sem perseguição e sem dano de contato até o timer acabar. Teste com inimigo encostado: 30 frames sem mover nem morder, volta a morder depois. |
| Fire Stone/Leaf Stone (`hitAround`) podiam deixar alfa/boss abaixo de 10 % sem `capture.weaken` — e o mesmo valia para burn/poison e espinhos (P2) | `Run.maybeWeaken(e)` é o único ponto da checagem; chamado por `hitEnemy`, `hitAround`, os ticks de DoT e os espinhos. Teste cobre os três caminhos novos. |
| Enfraquecer o boss zerava `windup`/`active`, mas os meteoros já agendados (`run.later`) continuavam chamando `hitPlayer`, inclusive depois de capturar o guardião e avançar a zona (P2) | `Boss.cancelAttacks()`: incrementa `attackGen` (cada meteoro agendado guarda a geração e não cai se ela mudou), remove as poças e os projéteis hostis com `owner` igual ao boss (campo novo em `zonesHostile`/`spawnHostileProjectile`), zera telegraph e padrão. Chamado ao enfraquecer (uma vez por janela), em `onCaptured` e em `onDefeat`. **15.ª rodada:** a chamada ao enfraquecer saiu de `Boss.update` para `Capture.weaken` (no instante do golpe) e passou a marcar `cancelled` em vez de remover. Testes: controle (meteoros caem no boss ativo), enfraquecido (nenhum cai, poças somem), capturado (zona 2 começa limpa). |
| O teste do Poké Doll só olhava `Allies.mods()` (P3) | Substituído pelo teste de `player.stats.damage` acima. |

Afirmações corrigidas: §20 "boss down não luta" agora inclui os ataques em voo; §22 Poké Doll vale na hora; o teste
dos 16 itens fora do pool cobre os 16 (`tests/review14.test.mjs`), não quatro. Suíte **122 / 122**; build +
`check-bundle` OK.

**Décima quinta rodada** (correção da 14.ª, `e7907de..93cfe58`, `reviews/codex-2026-10-24-04-00-e7907de..HEAD.md`):
**Reprovado**, 2 achados, ambos aceitos:

| Achado | Decisão |
|---|---|
| O cancelamento ao enfraquecer esperava `Boss.update`, mas projéteis e poças rodam **antes** dele no passo (`updateProjectiles` → `updateEnemies` → … → `boss.update`): o golpe que deixa o boss capturável podia ver os ataques dele ainda acertarem no mesmo passo (P2) | `Capture.weaken` chama `boss.cancelAttacks()` na hora em que aceita um boss; o ramo em `Boss.update` ficou como reserva. E `cancelAttacks` passou a **marcar** (`cancelled`) em vez de remover: ele pode rodar de dentro do laço de projéteis ou de zonas (um acerto que enfraquece), e um `splice` ali faria o laço reprocessar o item atual; os laços descartam os marcados no topo, antes de colidir ou tiquetear. Testes: controle (projétil hostil a 1,4 u acerta em 5 frames); enfraquecer com projétil e poças no ar → tudo marcado no instante, nada acerta em 10 frames, laços limpam. |
| Freeze/sleep/root paravam só `updateEnemies`; uma investida ativa (`tickActive`, `charge`) seguia movendo o boss e acertando o jogador (P2) | `Boss.update` para junto: com freeze/sleep/root/flinch no inimigo, zera `windup`/`active`/`nextMove` e não avança `fightT`/`moveT`; retoma quando o status acaba. Testes: controle (investida move > 1 u e acerta em 30 frames); nos quatro estados a investida é abortada, o boss não se move nem acerta, e o controlador volta a andar depois. |

Afirmações corrigidas: §20 e 14.ª rodada agora dizem "no instante do enfraquecimento" com razão (`Capture.weaken`), e a
parada por status cobre o controlador do boss. Suíte **126 / 126**; build + `check-bundle` OK.

**Décima sexta rodada** (correção da 15.ª, `93cfe58..2c1cd58`, `reviews/codex-2026-10-24-06-03-93cfe58..HEAD.md`):
**Reprovado**, 1 achado, aceito — e a raiz era maior que o achado:

| Achado | Decisão |
|---|---|
| Uma poça hostil podia enfraquecer o próprio boss no laço de inimigos (marcando-se `cancelled`) e ainda acertar o jogador no mesmo tick, porque a marca só era lida no topo da iteração (P2) | Raiz: poças **hostis** passavam pelo laço de inimigos via `hitEnemy` — a poça do boss feria a horda e o próprio boss **como dano do jogador** (`stats.damage`, roubo de vida, Shell Bell, enfraquecimento). Poça hostil agora só fere o jogador; o dano ao jogador também checa `!z.cancelled`. Teste `tests/review16.test.mjs` (falha no código antigo): boss a 10,1 % dentro da própria poça, jogador e um inimigo comum dentro — jogador leva dano, boss e inimigo não, boss não fica capturável. |

Afirmação corrigida: "antes de tiquetear" passa a valer — nada dentro do tick de uma poça hostil pode mais cancelá-la.
Suíte **127 / 127**; build + `check-bundle` OK.

**Décima sétima rodada** (`2c1cd58..bcd6d79`, `reviews/codex-2026-10-24-06-14-2c1cd58..HEAD.md`): **Aprovado com
ressalvas**, 1 achado P3, aceito: o teste da 16.ª passava mesmo sem o dano da poça, porque o contato do boss e do
inimigo encostados também tirava HP no mesmo frame. O passo do teste virou só `run.updateProjectiles(1 / 60)` (onde
as zonas tiquetam); conferido por mutação — removendo `hitPlayer` da poça, o teste falha.

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
| Bot honesto, Clássico, 600 s, sementes 11–20 | Até a fase 6: **5 / 10 sobreviviam** (mortes entre 317 e 334 s, no guardião da zona 1). Desde a fase 7 (§18 — empurrão de contato preso ao acerto): **10 / 10 sobrevivem**, todos passam da zona 1, nível 26–30, 887–952 kills, 0–3 lojas e 0–4 baús usados. Nenhuma morte antes dos 4 min; zero falhas de invariante. O teste exige ≥ 3 sobreviventes e nenhuma morte antes de 240 s — linha de base de balanceamento. |
| Bot honesto, Torre, 600 s, sementes 31–35 | Fase 6: 0 / 5 (nível 50, mortes nos andares 5–7). Fase 7: **5 / 5** — 2 vitórias (547 e 556 s) e 3 runs vivas no 7.º andar aos 600 s. O teste exige sobreviver 2 min e passar dos 3 primeiros andares. |
| Clássico até o fim (god mode: só imunidade a dano) | **vitória em 1167 s**: 3 guardiões, santuário, lendário; nível 50, 1826 kills |
| Torre até o fim (god mode) | **vitória em 592 s**: 7 andares pelas ondas reais (sem o director) |

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

---

## 17. Fase 6 — Torre: director em repouso e escala pela curva do andar (23/10/2026)

BACKLOG 4 e 21. O que estava errado, confirmado por leitura e por teste:

- `Run.update` zerava `this.spawnAccum` (propriedade inexistente): o director continuava spawnando e
  disparando a timeline (alfas, enxames) durante os andares, e **qualquer** morte contava para a onda.
- `spawnWave` multiplicava o HP e o dano dos inimigos pela curva viva **de novo** (já aplicada em `spawnEnemy`),
  com a dificuldade também em dobro — escala ao quadrado e presa ao tempo de parede do andar 1 (`run.stage`
  nunca avança na Torre). Os getters `vmin`/`curveStage`, feitos para isso, não eram usados.
- Os guardiões vinham da curva viva com tier `boss` em todos os andares; os multiplicadores de totem/summoner
  do `boss` config não cabem na fórmula de HP deste engine (floor 1 daria ~80 000 HP).

**Agora:** o director não roda na Torre (nem no santuário). `Director.hpMultAt/dmgMultAt(stage, minutos)` expõem
as curvas para um estágio/minuto arbitrário; `Tower.scale()` devolve `{ hpMult, dmgMult, effSeconds }` da curva
do andar em seus minutos virtuais (`curve.min + onda × step`, + progresso), e `spawnEnemy` aceita essa escala
(inclusive para o falloff de toughness). Ondas e guardiões usam a mesma escala. Guardiões: tier próprio
(`totem`/`summoner` nos andares 1–4, `boss` nos 5–7) e HP = `clamp(orçamento de DPS × duração, curva/4, curva)` —
na Torre a curva é **teto** e o orçamento o alvo (no Clássico continua: curva como piso, orçamento pode subir
até 4×). Sem isso o guardião do cume teria ~300 000 HP para um jogador baixo.

Testes (`classic.test.mjs`): `director.elapsed` fica 0 na Torre; HP de onda independe do tempo de parede e é
`base × curva do andar` uma vez só; tiers dos guardiões por andar e HP dentro de `[curva/4, curva]`.

Bot: Torre em god mode vence em **531 s** (antes 331 s, com director ajudando a matar). **Torre honesta
(5 sementes, 600 s): o bot chega ao nível 50 no andar 3–4 e morre em todos os casos nos andares 5–7**
(316–580 s). Sobrevive sempre os 2 primeiros minutos e passa dos 3 primeiros andares — é o que o teste exige.
⚠ Sinal de balanceamento para o playtest humano: os andares 5–7 usam a curva da zona 3 (`hpMult` 48–129)
contra um jogador já no teto de nível; se um humano também travar ali, o ajuste natural é `curve.min` /
`curve.stage` desses andares em `rules.json` (não mexi: dado do jogo original).
**Atualização (fase 7, §18):** as mortes nos andares 5–7 eram, na verdade, o empurrão de contato por frame
prendendo o jogador entre inimigos; com o empurrão preso ao acerto o bot honesto passou a 5 / 5 na Torre
(2 vitórias). O alerta sobre as curvas fica, mas rebaixado: validar em jogo.

---

## 18. Fase 7 — Plano de evolução fixo, pausa durante as cartas e o empurrão de contato (23/10/2026)

- **Evolução (BACKLOG 7):** `tryEvolve` re-sorteava o alvo a cada verificação (`evolutionPlan` com rng), então
  linhas com várias evoluções (Eevee: 8; Poliwhirl, Gloom, Slowpoke: 2) mudavam de alvo e de nível-limiar entre
  níveis. Agora `player.evoPlan` é decidido ao definir a espécie (`createPlayer`) e recalculado após cada
  evolução (`null` no fim da linha); o HUD mostra "→ Ivysaur at Nv 24". Testes em `tests/evolution.test.mjs`:
  Eevee mantém um único alvo/limiar em todas as checagens e evolui exatamente nele; Bulbasaur planeja Ivysaur e
  depois Venusaur; mesma semente, mesmo plano.
- **Pausa com cartas abertas (BACKLOG 9):** P/Esc eram repassados a `togglePause` e a tela de pausa (z 30)
  ficava atrás das cartas (z 70), com a música parada. Agora as cartas engolem P/Esc (já param o jogo) e a
  pausa volta assim que a carta é escolhida. Navegador: P/Esc com cartas → nada; depois → "Paused"; P → retoma.
- **Empurrão de contato (achado do bot):** ao re-rodar a linha de base depois da mudança de evolução (que
  desloca a sequência do `rng`), a semente 15 morreu aos 19 s e a 31 (Torre) aos 15 s. O rastro mostrou o
  jogador parado em (19, −6) com 3–5 inimigos colados: o empurrão de contato (`p.x -= dx/d·0,4`) rodava **a cada
  frame** enquanto houvesse toque — 24 u/s por inimigo encostado, bem acima dos 4,6 u/s de andar — e dois
  inimigos em lados opostos **pregavam** o jogador no lugar até a morte. O empurrão passou a acompanhar o
  acerto (a cada 0,4 s, 0,6 u), como o comentário "discrete hits" do próprio código pedia. Efeito na linha de
  base: Clássico honesto 5 / 10 → **10 / 10** sobreviventes; Torre honesta 0 / 5 → **5 / 5** (2 vitórias).
  ⚠ É uma mudança grande de sensação de jogo — o contato deixa de "vibrar" o jogador para longe; o playtest
  humano decide se o dano de contato (inalterado) basta como punição.

## 19. Fase 8 — Interface em pt-BR (23/10/2026)

- **Escopo:** todos os textos que o jogador lê — título, telas de perfil/parceiro/setup, HUD (zona, santuário,
  ameaça, barra do boss, dica de evolução), cartas de level-up (títulos, subtítulos, linhas, raridades, botões),
  painéis de evento (baú, loja, altar, itens à venda), resultados, pausa e todos os banners (zona, guardião,
  lendário, Torre, director, captura, evolução, fusão, loja). `lang="pt-BR"` no `index.html` e no template do
  bundle. Idioma único: não há seletor (continua no BACKLOG como "escolha de idioma").
- **O que fica em inglês, por decisão:** nomes próprios dos dados — espécies, golpes, itens, habilidades, papéis
  do roster (`Healer`, `Blaze Assault`), nomes dos ultimates (`ultimateName`) e os nomes dos andares da Torre no
  dado (`rules.json`). Os nomes de andar, biomas e arquétipos **são traduzidos na exibição** por tabela, sem
  tocar nos dados. As `key`s dos itens da loja (`heal-small`, `xp-boost`…) e todas as chaves do `localStorage`
  seguem iguais; o perfil convidado já gravado mantém o nome "Guest" (sem migração), convidados novos nascem
  "Convidado".
- **Onde:** novo módulo `src/core/i18n.js` (sem dependências; entra no `MODULE_ORDER` do bundle logo após
  `dom.js`) com as tabelas `TYPE_PT`, `ARCH_PT` (os rótulos de arquétipo do `rules.json` estão em **espanhol**:
  `Proyectil`, `Ráfaga`, `Embestida`…), `BIOME_PT` (nome + descrição), `RARITY_PT`/`RANK_PT`, `VITAMIN_DESC_PT`
  (as 25 vitaminas; `vitaminGainText` usava `def.desc.toLowerCase()` em inglês), `TOWER_FLOOR_PT`, `THREAT_PT` e
  os helpers `typeName`/`archLabel`/`biomeName`/`biomeDesc`/`rankName`/`vitaminDesc`/`towerFloorName`.
  Literais traduzidos no lugar em `screens.js`, `hud.js`, `levelup.js`, `account.js`, `pokedex.js` (chips de
  tipo), `main.js`, `run.js` (banners e rótulos de upgrade: "+12% de dano", "+1 projétil", "+2 perfuração"),
  `rules.js` (`STAT_NAMES`, `RARITY_NAMES`, dificuldades Normal/Difícil/Pesadelo, `describeUpgrade`),
  `events.js` (`SHOP_ITEMS`: Poção, Restaurador, Vitamina, Doce Raro), `boss.js` (golpes do boss e banners),
  `tower.js`, `director.js`, `capture.js`, `vitamins.js`, `fusion.js`. O flutuante de esquiva passou de "miss"
  para "errou".
- **Testes:** as expectativas de texto acompanharam a tradução — `pause` ("Pausado", "Capturados: 1 / 1025",
  "Parceiros:"), `helditem`, `hud` ("Scyther · Guardião", "Fase 1 · …", "Mew · Lendário"), `events` e o bot
  (`/^Abrir/`, `/^Sair/`, `/^Comprar/`, `/^Curar/`, títulos `/Baú/`, `/Loja/`, nomes "Doce Raro", "Poção",
  "Restaurador", "Vitamina"), `evolution` ("Evoluiu para X!"), `classic` e `playtest` ("Zona N limpa!",
  `/guardião da Floresta Verde/`, `/santuário/i`, `/o lendário!/`). Suíte: **86 / 86**; `node build.mjs` +
  `check-bundle` OK (27 módulos, o `i18n.js` incluído).
- **Navegador (`http://localhost:8080/`, `document.documentElement.lang === "pt-BR"`):** título ("▶ Jogar",
  "Partidas/Melhor/Capturados/Parceiros"), perfis ("Escolha um perfil", "Jogar como convidado"), parceiro
  (chips PLANTA/VENENO, raridade COMUM), setup (biomas e descrições em pt-BR, Clássico/Infinito/Torre), HUD
  ("→ Ivysaur no Nv 24", "Floresta Verde", "CALMO", "0:00 · Zona 1"); pausa com P ("Pausado", Continuar / Pokédex /
  Conquistas / Apelido / Item segurado / Sair para o menu; P retoma); cartas ("Subiu de nível!", "Escolha um upgrade",
  "Nível 1 → 2", "-2% de recarga", "+3% de área", VITAMINA, INCOMUM/COMUM, Re-sortear/Pular/Banir); resultados
  ("Você desmaiou", "Bulbasaur · Floresta Verde · Normal", SOBREVIVIDOS/ABATES/NÍVEIS/UPGRADES/MOEDAS/DANO, "Jogar
  de novo", "Menu principal"); painéis de evento abertos com `openPanel` — baú ("Baú do Tesouro", "Um baú empoeirado. O que
  tem dentro?", "16 de ouro", Abrir 1 / Sair 2), loja ("Loja Ambulante", "Mercadorias à venda. Seu ouro: 300G", Poção /
  Restaurador / Doce Raro com descrições, Comprar 1-3, Sair 0) e altar ("Altar Antigo", "Um altar antigo vibra com poder.",
  "Você já está com o HP cheio.", Sair 2); "Sair para o menu" na pausa encerra a partida.
- **Codex (13.ª rodada, §14):** Aprovado com ressalvas — 1 achado P3: as descrições dos itens segurados (pausa → Item
  segurado) ainda vinham do `items.json` em inglês. Fechado com `HELD_ITEM_DESC_PT` (descreve o efeito implementado) +
  teste; a frase "todos os textos que o jogador lê" acima passou a valer com essa correção — o que resta em inglês
  são só os nomes próprios dos dados.

## 20. Fase 9 — Bosses capturáveis (BACKLOG 3) (24/10/2026)

- **Decisão:** boss **é** capturável, como `Capture.weaken` e o README já diziam. Vale para o guardião de zona, o
  lendário do santuário e os guardiões da Torre — tudo que o `Boss` controla (tiers `boss`, `totem`, `summoner`), além
  dos alfas. `CAPTURABLE_TIERS` em `capture.js` é a única lista; `hitEnemy` (antes `e.tier === "alpha"`) e `weaken`
  leem dela. Elite e normal seguem fora.
- **Boss "down" não luta:** `Boss.update` zera `windup`/`active` e não avança `fightT`/`moveT` enquanto
  `e.captureReady`; o inimigo já não perseguia nem dava dano de contato (`updateEnemies`). Se a bola falha
  (`breakFree`, HP volta a 30 %) ou a janela de 8 s fecha (`recovered`, 25 %), a IA retoma de onde parou.
  **14.ª rodada:** `cancelAttacks()` derruba também o que já estava no ar — meteoros agendados (contador
  `attackGen`), poças e projéteis do boss — no instante do enfraquecimento (`Capture.weaken`, 15.ª rodada), ao capturar
  ou morrer; antes os meteoros caíam até depois da zona avançar. Com freeze/sleep/root/flinch o controlador também
  para (investida abortada).
- **Captura = derrota para a progressão:** `Capture.caught` marca `e.captured` e chama `Boss.onCaptured()` na hora
  (não espera `Boss.update` ver `!alive`, que depende de a compactação dos mortos rodar antes ou depois): `dead`,
  `index = -1`, `opts.onBossDown` (sfx) e `run.onBossDefeated(kind)` — zona limpa / santuário / vitória / próximo
  andar — **sem** o banner "X foi derrotado!" nem o burst de abate; o "Pegou!" do `caught` é o anúncio. O boss
  recruta com vínculo 1,5 (`isBossTier`, antes só `tier === "boss"`), entra no Pokédex e nas conquistas como
  qualquer captura; não há XP/ouro de abate (`killEnemy` não roda), a recompensa é o aliado.
- **Chance:** a mesma dos alfas (`0,45 + captureRate/255 × 0,35 + 0,2 por tentativa`, teto 0,95). Para o lendário
  (captureRate 3) são ~45 % na primeira bola — e como capturar já vence, o único custo de errar é o boss voltar a
  30 % de HP. ⚠ Decisão de balanceamento para o playtest humano: se for fácil demais, uma penalidade por tier
  (`× 0,5` para boss, por exemplo) entra em `Capture.throw`.
- **Testes** (`tests/capture-boss.test.mjs`, 6; 5 falham no código antigo): guardião enfraquecido para de atacar
  (120 frames sem telegraph/padrão, `moveT` congelado, ainda capturável); captura limpa a zona (stage 2, "Zona 1
  limpa!", sem "foi derrotado", aliado com vínculo 1,5, Pokédex, `onCaught`, e a compactação do corpo não conta
  uma segunda derrota); captura do lendário = vitória; bola falha → 30 % de HP e a IA retoma; Torre: capturar o
  guardião avança o andar; elite/normal continuam incapturáveis. Suíte **93 / 93**; build + `check-bundle` OK.
- **Navegador (`localhost:8080`, página recarregada — a 1.ª tentativa rodou módulos antigos em cache):** guardião
  Scyther a 5 % + um acerto → "Scyther está enfraquecido! Aperte E para lançar a bola", `windup 0`/`active null`;
  tecla E com `Math.random` fixo em 0 → "Pegou! Scyther foi capturado!" + "Zona 1 limpa!", `stage 2`, boss morto,
  aliado `Scyther@1.5`, nenhum "foi derrotado". Bot (`playtest.test.mjs`) continua vencendo Clássico e Torre.

## 21. Fase 10 — Stats do upstream sem efeito (BACKLOG 10) (24/10/2026)

- **Inventário (fontes reais nos dados):** `shieldMax` ← Zinc; `thorns` ← Rocky Helmet (+25), Protector (+40),
  Sticky Barb; `bounces` ← Smooth Rock; `flinch` ← King's Rock (+6 %); `powerup` ← Poké Radar; `eliteSpawn` ← Super
  Lure; `enemyAmount` ← White Flute (×1,12), Repel (×0,92). **`knockback` e `slam` não têm nenhuma carta nem
  vitamina que os altere** — saíram do `basePlayerStats` (nada os lia; `STAT_NAMES` mantém os rótulos para dados
  futuros). Os sete restantes passaram a ter efeito, pela regra da 11.ª rodada: carta oferecida = efeito observável.
- **Como cada um age (`run.js`, `director.js`):** *escudo* — com `shieldMax > 0`, `p.shield` recarrega até o teto em
  ~6 s depois de 2,5 s sem levar dano (`p.lastHitT`), absorve antes do HP e aparece no HUD como "108 / 108 +20"; sem
  `shieldMax`, o decaimento antigo de 0,6/s fica como estava. *Espinhos* — todo acerto que entra (não esquivado,
  mesmo se o escudo absorveu tudo) devolve `thorns` de dano fixo ao `source`, passando pelo orçamento do boss
  (`capDamage × hitMul`) e matando por `killEnemy` se zerar. *Ricochetes* — `effectiveDef` soma
  `def.bounces + mods.bounce + stats.bounces` (antes `mods.bounce` sobrescrevia um `def.bounces` nativo).
  *Recuo* — em `hitEnemy`, chance `flinch` de `statuses.flinch = 0,5 s`; o inimigo para (sem perseguir, sem contato),
  bosses (`isBossTier`) são imunes. *Power-ups* — `roll / powerup` alarga as três faixas de drop (cura 5,5 %, moeda
  3 %, ímã 1 %) e o doce raro de alfa/boss (40 %). *Elites* — a `elitewave` do director spawna
  `round((4 + 2·zona) × eliteSpawn)`. *Quantidade* — o teto populacional virou `Director.popCap(eff)` e multiplica
  também `player.stats.enemyAmount` (ondas da Torre não mudam: contagem fixa por andar, decisão).
- **Testes** (`tests/stats.test.mjs`, 9; 8 falham no código antigo): escudo cheio aos 7 s, absorve, não recarrega
  em 2,5 s, volta a recarregar; espinhos 100 → 75 e matam (`killEnemy` só inicia o `dying` — o `alive` cai no
  frame seguinte, a 1.ª versão da asserção errou nisso); esquiva não reflete; ricochetes somam carta + stat;
  recuo para o inimigo por 0,5 s e boss não recua (o teste zera `p.moves`: o auto-ataque re-atordoava o alvo em
  50 % das rodadas — flake de 4/10 antes); `powerup` 3 transforma um roll 0,15 em cura; `eliteSpawn` 2 dobra a
  onda; `popCap(0)` 10 → 11 (×1,12) → 9 (×0,92); bloco sem `knockback`/`slam`. Suíte **102 / 102**; build +
  `check-bundle` OK.
- **Navegador (`localhost:8080`, recarregado):** `shieldMax 20` → HUD "108 / 108 +20"; golpe de 10 → HP intacto,
  escudo 11,7, HUD "+12"; `thorns 25` → inimigo 100 → 75; `flinch` → `statuses.flinch 0,3` após 12 frames e
  deslocamento 0; `popCap(0)` 10 → 11 com `enemyAmount 1,12`.
- ⚠ Balanceamento para o playtest: espinhos de 25/40 por acerto matam inimigos comuns no contato (HP de zona 1 na
  faixa de 30–60); `flinch` 6 % com rajadas pode travar alvos frequentemente. Números são os do upstream.

## 22. Fase 11 — Itens scriptados entram no pool (BACKLOG 11) (24/10/2026)

- **O que era:** dos 126 upgrades do `rules.json`, 38 não têm `mods` (são os itens *scriptados* do upstream: Shell
  Bell, Focus Sash, Revive…) e `rollChoices` só oferecia entradas com `mods.length` — logo nunca apareciam, e o
  único gancho que existia no engine (`poke-doll` → vaga de aliado) era inalcançável. Além disso a tag `type:` dos
  18 itens de tipo (Charcoal…) **nunca foi aplicada**: `hitEnemy` lia `s.typeBoost[tipo]`, mas nada o preenchia —
  a carta dizia "fortalece golpes de Fogo" e só o `+3 % dano` do `mods` valia. E, com `tags: []`, o peso de sorteio
  desses itens caía para 0,35 (`!u.tags` falso para array vazio).
- **Decisão:** implementar os scriptados que cabem nos ganchos que o engine já tem (acerto, abate, dano recebido,
  aliados, loja) e manter os demais fora, de forma explícita. Novo módulo `src/game/scripted.js`: `SCRIPTED` (22
  chaves) e os ganchos `itemDamageMul` (Metronome +2 %/s sem levar golpe até +40 %, lendo `lastHitT`; Binding
  Band +20 % em para/root/freeze/sleep/flinch; Full Heal +6 % por status distinto até +30 %; Reaper Cloth +1 % por
  100 abates até +30 %; Thick Club físico +1 % por 2 de armadura até +50 %), `itemBonk` (Stick 3 % → ×8, "Bonk!"),
  `itemOnHit` (Shell Bell cura 0,8 % do dano × `healing`; Grip Claw 4 % root 2 s; Awakening 2,5 % sleep 3 s; Razor
  Fang executa inimigo **comum** abaixo de 8 % + 4 %/cópia — alfas e bosses ficam de fora por causa da captura),
  `itemOnKill` (Berry Juice 5 % → cura 2 %; Fire Stone: vítima queimada explode, 40 % do HP dela em 3 u; Leaf
  Stone 10 % → redemoinho 30 % em 3 u + cura 1 %), `itemBlockHit` (Guard Spec. bloqueia um golpe a cada 14 s,
  flutuante "bloqueado") e `itemSurvive` (Focus Sash 1×/zona; Focus Band 15 %/cópia a cada 20 s; Max Revive 60 %
  e Revive 35 %, uma vez por cópia, 1,5 s de invulnerabilidade). Em `capture.js`: S.S. Ticket +1 vaga (antes era
  o Poké Doll ÷ 3), Lemonade aliados ×1,25 dano e ÷1,15 recarga, Poké Doll passiva ×1,5. (14.ª rodada: `applyChoice`
  recomputa os stats em todo item, então a passiva vale na hora — com `mods: []` ela só valia no próximo recálculo.) Em `events.js`: Gold
  Teeth −8 %/cópia (teto −24 %) em `price()`, usado no rótulo, na checagem e na cobrança. Área fixa dos itens:
  `Run.hitAround` (sem multiplicadores do jogador, passa pelo orçamento do boss, mata por `killEnemy`).
- **Pool e cartas:** `Run.itemPool()` = `mods.length || SCRIPTED.has(key)`, não banido, abaixo do `max` (o dado
  tem `max` por item: Focus Sash 1, Revive 2…). Peso: `!u.tags?.length`. `describeUpgrade` cai em `ITEM_DESC_PT`
  (`i18n.js`, 22 descrições do que **este** engine faz) em vez do espanhol do dado. Tag `type:` aplicada em
  `recompute`: `typeBoost[tipo] += 0,3 × cópias`. **Ficam fora (16):** soda-pop, adrenaline-orb, metal-powder,
  ice-heal, secret-key, old-rod, eviolite, shed-shell, cell-battery, dowsing-machine, griseous-orb, electirizer,
  silph-scope, max-ether, tm-case, poke-flute — cada um pede um subsistema próprio (altares Unown, pesca, marca,
  tetos de nível) ou um estado dinâmico de velocidade/armadura que o engine não tem.
- **Testes** (`tests/items.test.mjs`, 13; o arquivo nem carrega no código antigo): pool inclui todos os
  `SCRIPTED` e Charcoal, exclui 4 dos 16 (os 16 inteiros em `tests/review14.test.mjs`, 14.ª rodada), respeita `max`; cada chave tem descrição pt-BR; tag de tipo ×1,3 (×1,6 com
  duas) só no tipo; Metronome 1,4 → 1,0 → 1,2; Binding Band/Full Heal; Reaper/Thick Club (e especial ignora o
  Club); Stick ×8 + "Bonk!"; Shell Bell/Grip Claw/Awakening; Razor Fang (comum sim, alfa não, 12 % com duas);
  Berry Juice/Fire Stone (só queimado, só em 3 u)/Leaf Stone; Guard Spec.; Sash/Band/Revive/Max Revive;
  S.S. Ticket/Lemonade/Poké Doll; Gold Teeth 25 → 23 → 19. Pegadinhas do teste: o dado traz `mods: []` (array
  vazio é truthy — `applyChoice` recomputava e restaurava a evasão zerada; o `if` virou `mods?.length`), o Bulbasaur
  tem `healing 1,25` pela habilidade, e o bundle concatena módulos num escopo só (o helper local de `capture.js`
  colidiu com o `itemCount` exportado e virou `upgradeCount`). Suíte **115 / 115**; build + `check-bundle` OK
  (28 módulos).
- **Navegador (`localhost:8080`, recarregado):** pool 110 (88 + 22), scriptados presentes e os 16 ausentes; cartas
  "Charcoal — +3% dano · fortalece golpes de Fogo" e "Gold Teeth — A loja cobra 8% menos (até −24%)."; Guard
  Spec. bloqueia o 1.º golpe (HP intacto, flutuante "bloqueado") e deixa o 2.º passar; Revive devolve 38 / 108 com
  o banner "Revive! De volta com 35% do HP".
- ⚠ Balanceamento: Fire Stone em cadeia e Razor Fang com rajadas podem acelerar demais o abate de hordas;
  Metronome dá +40 % desde o 1.º segundo (nunca levou golpe). Números do upstream, para o playtest.

## 23. Fase 12 — Música de batalha (BACKLOG 12) (24/10/2026)

- **O que era:** `Music.setTheme(tema, battle)` e o sequenciador já tinham o modo batalha (caixa extra, oitava
  acima, arpejo), mas o único caller (`startRun`) passava `false`.
- **Mudança:** uma linha no `loop` de `main.js`, depois do HUD: `state.music.setTheme(state.music.theme,
  run.boss.alive)`. `setTheme` retorna cedo quando nada mudou, então chamar a cada frame é barato; `startRun`
  continua zerando para `false`.
- **Verificação:** sem teste automatizado (o `loop` de `main.js` não é importado pelos testes). Navegador
  (`localhost:8080`): zona 1 com o timer no fim → guardião vivo, `music.battle === true`; guardião derrotado →
  `false`, zona 2. Suíte 127 / 127; build + `check-bundle` OK. O som em si não foi ouvido.

## 24. Fase 13 — HUD sem reconstrução por frame (BACKLOG 13) (24/10/2026)

- **O que era:** `Hud.update` fazia `clear(this.slots)` e `ult.innerHTML = ""` e recriava todos os elementos a cada
  frame (60×/s).
- **Mudança:** chave da composição (`nome|tipo` de cada golpe + `moveSlots`) e nome do ultimate; só reconstrói quando
  mudam (golpe novo, vaga, fusão, evolução). A cada frame atualiza apenas a classe `ready` e a largura das barras de
  recarga e de carga do ult, guardando referências aos elementos.
- **Verificação:** teste em `tests/hud.test.mjs` (falha no código antigo): mesmo elemento de slot e de ult entre
  frames, barra de recarga 100 % e ult 50 %, classe `ready` liga, e uma vaga nova reconstrói (3 → 4 slots).
  Navegador: 30 frames reais com o mesmo elemento de slot e de ult, ult avançando (1,75 %). Suíte 128 / 128;
  build + `check-bundle` OK.

## 25. Fase 14 — Qualidade: itens 15–20 do BACKLOG (24/10/2026)

- **15 senha:** `passHash(nome, senha)` em `account.js` (FNV-1a de `rng.js`, salgado pelo nome, 2000 iterações) no
  lugar de `profile.pass`; login de save antigo confere o texto puro uma vez e migra; `<input type="password">`. É
  ofuscação, não segurança (comentário `shortcut:` no código). `tests/account.test.mjs` (4).
- **16 acoplamento:** `Screens.getRun()` injetado por `main.js` substitui `globalThis.__PB__.run` em apelido e item
  segurado; testes de pausa/item usam o callback.
- **17 servidor:** `handle(req, res)` exportado, `listen` só quando executado direto; `decodeURIComponent` em
  `try` → 400; checagem de raiz por `path.relative`. `tests/maintenance.test.mjs` sobe o handler numa porta livre:
  `/%E0%A4%A` → 400 e o servidor segue respondendo; pasta irmã e `../../windows/win.ini` não servem.
- **18 captura:** `Capture.attempts` perde a entrada ao capturar e quando o alvo enfraquecido morre (inclusive
  durante o `dying`); o lançamento pela tecla E não soma `stats.items`. Testes no mesmo arquivo.
- **19:** já resolvido na fase 3.
- **20 loop:** depois de cada passo, se abriu carta, painel ou a run acabou, o laço sai e zera o acumulador. Sem
  teste automatizado (`main.js` não é importado); revisado por leitura.
- **Navegador:** campos da conta `text,password`; pausa → Item segurado lista e grava `leftovers` na run viva pelo
  `getRun`; nenhuma conta com `pass` em texto puro. Suíte **136 / 136**; build + `check-bundle` OK.

## 26. Fase 15 — Estimativa de DPS do jogador (BACKLOG 23) (24/10/2026)

- **O que era:** `playerExpectedDps` (orçamento de HP do boss) usava só `def.dmg × mods × 1,3 × nível ÷ recarga`, sem
  `damage`, físico/especial, STAB, item de tipo, crítico, projéteis extras nem aliados, e multiplicava a velocidade
  de ataque duas vezes (dividia a recarga e multiplicava o total). O argumento `secs` não era usado.
- **Agora:** por golpe `moveDamage(m) × damage × (físico|especial) × STAB 1,25 × typeBoost × (1 + crit × (critDamage − 1))
  × projéteis ÷ recarga`, mais `power ÷ cooldown × damage` de cada aliado. Alvo único, como numa luta de boss.
- **Medição** (nível 9, um alvo parado com 1e9 HP, 30 s): Bulbasaur 1,32×, Charmander 0,77×, Squirtle 0,99×,
  Pikachu 1,10×, Haunter 0,74× (medido ÷ estimado); a fórmula antiga dava 5,62×, 1,96×, 3,44×, 4,52×, 2,63×.
  `tests/dps.test.mjs` exige a faixa 1/1,5–1,5 nos cinco e velocidade de ataque contada uma vez; aliado aumenta.
- **Efeito:** cedo a curva de zona ainda é o piso — guardião da zona 1 no nível 7: 4115 → 4815 HP, teto de dano
  103 → 120/s. Bots do playtest seguem vencendo Clássico e Torre. Suíte **138 / 138**; build + `check-bundle` OK.

**Décima oitava rodada** (fases 12–15, `a59470c..42d0825`, `reviews/codex-2026-10-24-06-31-a59470c..HEAD.md`): **Aprovado
com ressalvas**, 6 achados, todos aceitos:

| Achado | Decisão |
|---|---|
| A estimativa multiplicava todo golpe por `count`, mas `chain` acerta cada inimigo uma vez (P2) | Medido por arquétipo contra alvo único sem tipo (30 golpes de 10 espécies): `chain` 1 acerto, `orb` e `boomerang` **2** (impacto + explosão; corrigido na 19.ª rodada: não é "ida + volta", e contra alvo do tamanho do boss o boomerang acerta 1), `barrage` ~3 de 4 (×0,75; contra o boss acerta os 4 — fator removido na 19.ª), `vortex` 35 % do dano. Com isso todos os golpes ficam entre 0,92× e 1,09× do medido; a exceção é Sleep Powder (1,58×), porque alvo dormindo leva ×1,8 — situacional, fora da estimativa. |
| DPS dos aliados ignorava físico/especial, STAB, crítico e Choice Band (P2) | `Run.expectedHitMul(cls, tipo, critBonus)` é o multiplicador comum de golpes e aliados (inclui Choice Band, que faltava nos golpes também). |
| `new URL` fora do `try`: `//[` derrubava o servidor (P3) | Construção da URL dentro do `try` → 400. |
| Tentativas retidas quando o alvo escapa e morre depois (P3) | `killEnemy` apaga a entrada (caminho central de morte). |
| Teste do servidor aceitava 404 sem arquivo externo (P3) | `makeHandler(root)` exportado; o teste monta `tmp/site` + `tmp/site2/secret.txt` + `tmp/outside.txt` e exige **403** para os dois. |
| "Still alive" testado em outra instância (P3) | Todas as requisições do teste vão ao mesmo servidor. |

`tests/dps.test.mjs` agora usa alvo sem tipo e faixa ±25 % para 7 espécies; testes novos de chain, aliado e
tentativa. 3 falham no código anterior. Suíte **140 / 140**; build + `check-bundle` OK.

**Décima nona rodada** (`42d0825..4803caa`, `reviews/codex-2026-10-24-06-35-42d0825..HEAD.md`): **Aprovado com ressalvas**, 1 achado
(P2) + 1 explicação contestada, ambos aceitos — e o achado escondia um bug de jogo:

| Achado | Decisão |
|---|---|
| `orb`/`boomerang` com 2 acertos fixos ignoravam `+count` (P2) | Ao medir `+1` projétil o dano caiu a **zero**: o leque de `orb`/`lob`/`meteor`/`boomerang`/`drain` (e do `random`) era simétrico, sem projétil central com contagem par — um alvo à frente não era atingido por nenhum. Mesmo defeito do raio na 11.ª rodada. O 1.º projétil agora mira o alvo e os extras abrem alternando (±0,45 rad; ±0,3 no `random`). A estimativa foi recalibrada contra **alvo do tamanho do boss a 3 u** (o uso real): `chain` 1 acerto, `orb` 2 por projétil, demais 1 por projétil, `vortex` 35 %; o fator da `barrage` saiu (contra o boss acertam os 4). 30 golpes de 10 espécies: 0,92–1,10×, exceto Sleep Powder (1,68×, alvo dormindo leva ×1,8). |
| §26 dizia "boomerang acerta na ida e na volta" | Errado: `pr.hits` não é limpo no retorno; eram impacto + explosão, e contra alvo grande só 1. Texto corrigido acima. |

Testes: `dps.test.mjs` usa alvo-boss; novo teste mede `orb`/`boomerang` antes e depois de `+1` (estimativa e dano
medido sobem > 1,5×; no código anterior o medido ia a 0). Suíte **141 / 141**; build + `check-bundle` OK.

**Regressão pega pelo bot depois da 19.ª rodada.** O commit `c69537d` entrou com **um teste vermelho** (o playtest da
Torre): o encadeamento do comando não barrou o commit. Causa, achada com rastreio do bot: desde a 15.ª rodada o
`Boss.update` parava o relógio da luta (`fightT`) enquanto o boss estava dormindo/enraizado; com Sleep Powder e Grip
Claw o guardião passava a maior parte do tempo assim, o anti-stall (`exhaust`, depois de 2× a duração) nunca disparava
e as lutas dos andares 5–7 (115k–179k HP, com o orçamento de DPS agora fiel) passavam de 5 minutos — o bot não
chegava ao topo em 30 min. Agora o relógio anda mesmo com o boss parado; o bot vence a Torre em 1023 s. Teste novo em
`tests/review15.test.mjs` (falha no código anterior). Suíte **142 / 142**; build + `check-bundle` OK. A partir daqui
o commit só roda depois de `npm test` com exit 0 verificado no mesmo comando.

**Vigésima rodada** (`4803caa..feda03a`, `reviews/codex-2026-10-24-06-39-4803caa..HEAD.md`): **Aprovado com ressalvas**, 2 achados,
aceitos: (P2) com o leque progressivo, o 4.º projétil sai a 0,9 rad e passa ao lado do boss a 3 u — a estimativa conta
agora só os projéteis do leque com desvio ≤ 0,7 rad (`FAN_STEP` em `run.js`, mesmo passo do `fireMove`); teste mede
`orb`/`boomerang` com +3 e +5 dentro de ±25 %. (P3) o teste do anti-stall atravessa `2 × fightSecs + 25 s` com o boss
dormindo e exige `exhaust() > 2`. Suíte **142 / 142**; build + `check-bundle` OK.

**Vigésima primeira rodada** (`feda03a..7a340ee`, `reviews/codex-2026-10-24-06-41-feda03a..HEAD.md`): **Aprovado com ressalvas**,
1 achado (P2), aceito — e de novo um bug de jogo por trás: a bomba (`lob`, ex.: Rock Throw) **não andava em x/z**;
subia e descia no lugar e explodia no pé do jogador, como uma onda em volta dele. Agora é lançada para cair no alvo
(velocidade horizontal = distância ÷ 0,72 s de voo, entre 2 e 20 u/s) e **não colide no ar** (ao andar, ela passou
a acertar tudo no caminho, ~3 acertos por bomba); explode só ao cair. `lob` saiu do limite angular do leque (a
explosão de raio 2,2 × √área cobre o desvio). Medido a 3 u: 0,94–1,00× com +0 a +5 bombas. Teste novo: a bomba cai
a < 2,5 u do alvo a 8 u, o inimigo sob o arco não é atingido, e +3/+5 ficam em ±25 %. ⚠ Mudança de jogo: Rock
Throw deixa de ser uma área em volta do jogador. Suíte **143 / 143**; build + `check-bundle` OK.

**Vigésima segunda rodada** (`7a340ee..e96a946`, `reviews/codex-2026-10-24-06-43-7a340ee..HEAD.md`): **Aprovado com ressalvas**,
1 achado (P2), aceito: o teto de 20 u/s só levava a bomba a ~14,7 u, mas a mira escolhe alvos até 26 u. Teto 40 u/s
(26 ÷ 0,72 ≈ 36). Teste com alvos a 14, 20 e 25 u (a 20 u o código anterior caía em x = 15,3). Suíte **144 / 144**; build +
`check-bundle` OK.

**Vigésima terceira rodada** (`e96a946..2fa9f16`, `reviews/codex-2026-10-24-06-45-e96a946..HEAD.md`): **Aprovado com ressalvas**,
1 achado (P2), aceito: o tempo de voo fixo de 0,72 s valia só do chão; lançada no alto de um pulo (`p.y ≈ 0,8`) a bomba
voava ~0,87 s e passava 5 u do alvo a 25 u. O tempo agora sai da altura real: `(6 + √(36 + 36·(p.y + 0,8))) ÷ 18`. Teste
com alvos a 14/20/25 u do chão e 10/25 u no pulo (o código anterior caía em x = 30,1). Suíte **144 / 144**; build +
`check-bundle` OK.

## 27. Fase 16 — Auditoria dos arquétipos de golpe (24/10/2026)

- **Por quê:** os bugs da bomba (`lob`) e do leque só apareceram medindo. Disparei dois golpes de cada arquétipo contra
  um alvo parado a 3 u e a 8 u por 10 s.
- **Achados:** `orbit` (Petal Dance, Bone Rush) e `random` (Metronome) davam **dano zero**. O orbit testava a posição
  das esferas uma vez por lançamento (a cada ~5 s), então quase nunca acertava; o Metronome tem poder 0 no dado (é um
  golpe de status). Os demais zeros são esperados: corpo a corpo (`strike`, `spin`, `aura`, `dash`, `trap`) a 8 u,
  `trail` com o jogador parado, `buff`/`weather` sem dano.
- **Correções:** o orbit cria esferas (projéteis com `orbit`, `pierce` infinito) que giram em volta do jogador durante
  `dur` (raio `1,6 + área × 0,5`, 3 rad/s × `+speed`) e acertam cada inimigo no máximo a cada 0,5 s por esfera; `+dur`
  passou a valer para orbit (saiu de `NO_EFFECT_UPS`). O Metronome, como no original, chama um golpe de dano aleatório
  (`Run.metronomePool()`), disparado pelo arquétipo dele com o nível e as cartas do Metronome, e mostra o nome sorteado.
- **Estimativa de DPS:** orbit conta `projéteis × dur` acertos (≈ 1/s por esfera contra o boss); Metronome usa o dano
  médio do sorteio. Medido contra alvo-boss em 60 s: Petal Dance 41,7 estimado / 42–43 medido, Bone Rush 17,7 / 17,5–17,8,
  Metronome 6,0 / 5,7–6,4.
- **Testes:** `tests/archetypes.test.mjs` exige dano de todo arquétipo de dano a 3 u (no código anterior falham orbit e
  random); em `moveups.test.mjs` o teste antigo do projétil do Metronome virou "chama golpes diferentes com as cartas
  dele", e há teste de `+dur`/`+count` no orbit. Navegador: três esferas verdes girando em volta do Bulbasaur com
  Petal Dance. Suíte **146 / 146**; build + `check-bundle` OK.

**Vigésima quarta rodada** (fase 16, `fdd92fb..fc40d6a`, `reviews/codex-2026-10-24-06-51-fdd92fb..HEAD.md`): **Aprovado com
ressalvas**, 3 achados (P2), aceitos: (1) no teto de 600 projéteis `spawnProjectile` recusava em silêncio e o orbit
pegava `.at(-1)` — **outro** projétil, até hostil, virava esfera. `spawnProjectile` agora devolve o criado (ou `null`) e o
orbit para no teto. (2) A limpeza global de `hits` a cada 0,5 s permitia acertar de novo logo após a limpeza; agora
cada esfera guarda o instante do último acerto por inimigo (`orbit.hitT`) e só libera depois de 0,5 s. Com isso o orbit
acerta menos e a estimativa foi recalibrada para 0,6 passagem/s por esfera (Petal Dance 25,0 estimado / 24,3–25,0
medido; Bone Rush 10,6 / 10,8–10,9). (3) A estimativa do Metronome usava só o dano base médio com classe/tipo do
próprio Metronome; agora é a média de `castDamage(def, m)` — o lançamento completo de cada golpe sorteável, com as
cartas e o nível do Metronome — sobre a recarga dele. `castDamage` virou o cálculo único por lançamento. Testes em
`tests/archetypes.test.mjs` (teto, intervalo por esfera, estimativa do Metronome; dois falham no código anterior — o do
intervalo passa nos dois, fica como guarda). Suíte **149 / 149**; build + `check-bundle` OK.

**Vigésima quinta rodada** (`fc40d6a..9a40bfc`, `reviews/codex-2026-10-24-06-58-fc40d6a..HEAD.md`): **Aprovado com ressalvas**,
1 achado P2 + 2 P3, aceitos: (P2) `trap`/`trail` contavam um acerto por zona, mas tiquetam a cada 0,4 s pela vida toda.
Medido contra alvo-boss **encostado** (2 u — um boss que persegue fica assim; a 3 u o rastro nem o alcança): rastro =
`3 × dur` acertos-equivalentes por lançamento (0,4 × dano, 3 s), armadilha = `5,25 × dur` (0,35 × dano, 6 s; do anel só
a central fica sob o boss). Spikes 0,97/0,89×, Flame Wheel 1,08/0,99×, Steel Roller 1,04/0,96× com dur 1/2; Spore
1,6–1,7× porque adormece o alvo (×1,8), como Sleep Powder. (P3) o teste de intervalo do orbit agora instrumenta o
`hitT` de cada esfera e exige que nenhum par esfera/inimigo seja reatingido antes de 0,5 s. (P3) o teste do Metronome
não usa mais `castDamage`: simula 290 s com aleatório determinístico (mulberry32) e compara o dano no alvo com a
estimativa (o primeiro rascunho media `stats.damage` por 600 s e contava o guardião da zona, que nasce aos 300 s).
Suíte **150 / 150** (o texto dizia 151 por engano — apontado na 26.ª rodada); build + `check-bundle` OK.

**Vigésima sexta rodada** (`9a40bfc..7a55da3`, `reviews/codex-2026-10-24-07-02-9a40bfc..HEAD.md`): **Aprovado com ressalvas**,
2 achados (P2), aceitos: (1) os tiques de zona entram como golpe **especial** e sem o crítico das cartas (o tique em
`updateProjectiles` não usa `def.cls` nem `critBonus`); a estimativa agora usa `expectedHitMul("special", tipo, 0)`. (2) Com
`+count`, armadilhas do anel também ficam sob o boss: a estimativa reproduz a geometria do `fireMove` (central no jogador,
as demais a 2,5 u em `i/count` de volta) e conta cada uma cujo raio alcança o boss encostado a 2 u. Teste cobre Spikes
com +0/+1/+3 e dur 1/2, Flame Wheel com dur 1/2 e com crítico de carta, sempre com bônus físico ×3 que não pode vazar
para os tiques. Corrigida também a contagem da 25.ª rodada (150, não 151). Suíte **150 / 150**; build + `check-bundle` OK.

**Vigésima sétima rodada** (`7a55da3..7c26f4b`, `reviews/codex-2026-10-24-07-03-7a55da3..HEAD.md`): **Aprovado com ressalvas**,
1 achado (P2), aceito: o anel de armadilhas tem orientação fixa no mundo e a conta supunha o boss sempre a leste. A
cobertura agora é a média sobre 16 direções do boss encostado. Spikes já nasce com 2 armadilhas, então todo caso dele foi
para um teste que mede a média de 8 direções (+0 dur 1/2, +1, +2, +3: 0,89–0,94×); o teste de rastro ficou só com
Flame Wheel. O teste novo também passa com a fórmula anterior (0,84–1,01× — a média por direção não se afastava muito); fica
como guarda. Suíte **151 / 151**; build + `check-bundle` OK.

## 28. Fase 17 — Segunda leva de itens scriptados (24/10/2026)

- **Entram 14 dos 16** que ficaram fora na fase 11: Soda Pop (onda de bolhas no dash), Adrenaline Orb (+20 % velocidade /
  +12 % ataque por 3 s após levar golpe), Metal Powder (parado 0,5 s: +30 % armadura / +8 % ataque), Ice Heal (alvo
  congelado: +60 %, descongela e paralisa os vizinhos), Old Rod (Magikarp a cada 9 s; 10 %/cópia de Gyarados ×5/1,5),
  Eviolite (+50 % armadura / +25 % HP enquanto a espécie ainda evolui), Shed Shell (dash com 0,35 s de invulnerabilidade e
  recarga −10 %), Cell Battery (+1,5 % ataque a cada 10 abates sem levar golpe, até +25 %), Griseous Orb (12 %/cópia por
  abate: sombra que fere e amaldiçoa em 3 u), Electirizer (raio a cada 2,5 s nos 2 + cópias inimigos mais próximos, 30 %
  de paralisia), Silph Scope (marca o mais forte em 14 u a cada 6 s: +40 % de dano; remarca na hora se ele cair), Max
  Ether (+2 níveis de vitamina), TM Case (+2 níveis de golpe), Poké Flute (ult carrega 25 % mais rápido; ao usar, todos
  os golpes recarregam e +30 % de ataque por 6 s).
- **Ficam fora:** Secret Key e Dowsing Machine (altares Unown e Poké Balls extras — o jogo não tem esses sistemas).
- **Onde:** `scripted.js` ganhou `itemPower` (dano dos ataques criados por item: `(10 + 2 × nível) × damage`),
  `itemAtkMul`, `itemMoveMul`, `itemArmorMul`, `itemTick` (Electirizer, Silph Scope, Old Rod), `itemOnDash`,
  `itemOnUltimate`, e os ramos de Ice Heal/Silph Scope em `itemDamageMul`/`itemOnHit` e de Griseous Orb em `itemOnKill`;
  `run.js` chama os ganchos (velocidade, recarga, armadura, dash, ult, abate, dano recebido, tetos de nível, Eviolite no
  `recompute`). Descrições pt-BR em `ITEM_DESC_PT`.
- **Fora da estimativa de DPS:** os bônus temporários (Adrenaline, Metal Powder, Cell Battery, Flute) e os ataques de
  item (Electirizer, Old Rod, Soda Pop, Griseous) não entram em `playerExpectedDps` — são condicionais; o orçamento de boss
  fica um pouco baixo para quem os pega.
- **Testes:** `tests/items2.test.mjs` (12; Max Ether só passou a ser exercitado na 28.ª rodada) cobre os itens; `items.test.mjs` e `review14.test.mjs` passam a exigir só
  Secret Key e Dowsing Machine fora do pool. Navegador: pool 124 itens, carta "Old Rod — A cada 9 s um Magikarp salta
  sobre um inimigo…", Electirizer acerta. Suíte **163 / 163**; build + `check-bundle` OK.

**Vigésima oitava rodada** (fase 17, `0f237b7..825bae5`, `reviews/codex-2026-10-24-07-09-0f237b7..HEAD.md`): **Aprovado com ressalvas**,
2 achados P2 + 1 P3, aceitos: (1) a marca do Silph Scope (+40 % "de tudo") só valia em `hitEnemy`; agora vale também no
dano de área dos itens (`hitAround`), nos tiques de queimadura/veneno e nos espinhos. (2) A 2.ª cópia não fazia nada;
agora cada cópia marca mais um dos inimigos mais fortes em 14 u (descrição atualizada). (3) O teste de TM Case/Max Ether
não exercitava o Max Ether nem os tetos finais: viraram dois testes, golpe 8 → 9 → teto 10 e vitamina 10 → 11 → teto 12.
Suíte **165 / 165**; build + `check-bundle` OK.

**Vigésima nona rodada** (`825bae5..fb579e9`, `reviews/codex-2026-10-24-07-11-825bae5..HEAD.md`): **Aprovado com ressalvas**, 1 P2 +
1 P3, aceitos: (P2) queimadura/veneno aplicados por um golpe no alvo marcado guardavam o DPS já com o +40 % e o tique
multiplicava de novo (×1,96); agora o DPS é guardado sem a marca e ela entra só no tique. (P3) o teste prometia espinhos
sem exercitá-los; o teste novo aplica a queimadura por `hitEnemy` real em alvo marcado e desmarcado (mesmo DPS guardado,
tique ×1,4 uma vez) e compara o dano dos espinhos (×1,4 no marcado). Suíte **166 / 166**; build + `check-bundle` OK.

**Trigésima rodada** (`fb579e9..500de72`, `reviews/codex-2026-10-24-07-13-fb579e9..HEAD.md`): **Aprovado com ressalvas**, 1 P2, aceito:
a base da queimadura/veneno era tirada **depois** do teto do boss — um golpe limitado guardava um DPS minúsculo (e
diferente com e sem marca). Agora a base (sem a marca) é tirada antes do teto; os tiques passam pelo teto por conta
própria, então o orçamento do boss segue respeitado. Efeito colateral intencional: queimadura em boss deixa de ser
derivada do golpe já cortado. Teste: golpe de 1000 com o teto quase vazio guarda o mesmo DPS de base com e sem marca
(no código anterior: 0,06). Suíte **167 / 167**; build + `check-bundle` OK.

## 29. Fase 18 — Mais itens segurados (24/10/2026)

- **Antes:** só Leftovers e Choice Band tinham efeito. **Agora 13:** Life Orb (×1,3 de dano; cada golpe lançado custa 2 %
  do HP máximo, nunca o último ponto) e dez itens de atributo em `HELD_MODS` (`scripted.js`): Scope Lens +10 % crítico,
  Muscle Band +15 % físico, Wise Glasses +15 % especial, Expert Belt +25 % super-efetivo, Quick Claw +10 % velocidade de
  ataque, Bright Powder +8 % evasão, Rocky Helmet +20 espinhos, Big Root +30 % cura, Lucky Egg +30 % XP, Amulet Coin +50 %
  moedas. Os mods entram no `recompute`; a tela de pausa recalcula na hora ao trocar o item (antes só valia no próximo
  recálculo — sem efeito para Leftovers/Choice Band, que são lidos direto). `HELD_ITEMS` é a lista única da tela.
- **Testes** (`helditem.test.mjs`, 3 novos/alterados; 4 falham no código anterior): lista oferecida = `HELD_ITEMS`,
  descrições pt-BR, Scope Lens vale na hora, persiste na próxima run e sai ao escolher "Nenhum", Life Orb ×1,3 e 2 %
  por lançamento sem matar. Navegador: 13 itens + "Nenhum", Scope Lens +0,1 de crítico na hora. Suíte **169 / 169**;
  build + `check-bundle` OK.

**Trigésima primeira rodada** (fase 18, `67df2fd..bc02e7a`, `reviews/codex-2026-10-24-07-16-67df2fd..HEAD.md`): **Aprovado com
ressalvas**, 2 P2 + 1 P3, aceitos: (1) `healing` (Big Root, habilidades) só valia em alguns caminhos — dreno e três itens
multiplicavam, mas coleta, ult, roubo de vida e poções não. Agora `healPlayer` aplica `healing` uma vez e é o único
caminho de cura (poção e loot do baú passaram a usá-lo; os chamadores perderam suas multiplicações). Efeito: a poção cura
30 × `healing` (37,5 para o Bulbasaur, que tem 1,25) — o teste da carteira da loja foi ajustado para isso. (2) Life Orb
com HP entre 0 e 1 subia para 1; agora nunca aumenta o HP. (3) O teste da lista comparava a tela com a própria lista; o
teste novo prova que **cada** item oferecido muda algo observável (atributos, dano de um golpe ou HP após 1 s). Suíte
**172 / 172**; build + `check-bundle` OK.

**Trigésima segunda rodada** (`bc02e7a..af6e08f`, `reviews/codex-2026-10-24-07-18-bc02e7a..HEAD.md`): **Aprovado com ressalvas**,
1 P2 + 1 P3, aceitos: a regeneração (e o Leftovers) ainda somava HP direto — agora os pontos inteiros acumulados passam
por `healPlayer`, que vira de fato o único caminho de cura. Teste novo pelos caminhos reais: regeneração em 2 s e dreno
de um golpe, ambos ×1,3 com Big Root (a regeneração falha no código anterior). Suíte **173 / 173**; build + `check-bundle` OK.

## 30. Fase 19 — Teste de ponta a ponta do bundle offline (24/10/2026)

- **Por quê:** o requisito "funciona offline por `file://`" só tinha sido conferido à mão (Edge `--dump-dom` uma vez; os
  navegadores de automação desta sessão bloqueiam `file://`).
- **O que é:** `scripts/e2e-bundle.mjs` (`npm run e2e`) sobe um Edge/Chrome headless com `--remote-debugging-port` e
  conversa pelo DevTools Protocol usando `fetch` e `WebSocket` nativos do Node (nenhuma dependência). Abre o bundle por
  `file://` e, dentro da página, verifica: `lang=pt-BR`, dados embutidos, seletor de parceiro, setup com biomas em pt-BR,
  run começando e avançando, canvas, cartas de level-up, escolha por tecla, pausa, lista de itens segurados e saída para
  o menu. Qualquer `exception` ou `console.error` da página reprova.
- **Verificado:** passa no bundle atual; com um erro injetado no bundle (`setTimeout(() => { throw … })`) reprova com a
  mensagem e a linha. Fica fora do `npm test` porque depende de um navegador local; está em `AGENTS.md` e no README.

**Trigésima terceira rodada** (fase 19, `d6bef3c..a29850c`, `reviews/codex-2026-10-24-07-22-d6bef3c..HEAD.md`): **Aprovado com
ressalvas**, 3 P3, aceitos: o script exige Node ≥ 22 (o `WebSocket` global não existe no 18 mínimo do projeto) e diz isso;
o avanço da run é conferido **antes** de qualquer `update` manual (prova o loop real por `requestAnimationFrame`); a
escolha da carta é só pela tecla `1`, e o teste exige que o painel feche e que o upgrade tenha sido aplicado. Os textos da
§30 sobre "escolha por tecla" e "avança" passam a valer com isso. `npm run e2e` OK.

## 31. Fase 20 — Estoque da loja e renovação (24/10/2026)

- **Bug de passagem:** `openPanel` sorteava o estoque da loja a cada abertura — sair e entrar renovava de graça. O
  estoque agora é do evento (`ev.stock`, sorteado uma vez).
- **Renovação:** botão "Renovar NG" (tecla `R`) sorteia outro estoque por 20G, +15G a cada renovação daquela loja,
  com o desconto do Gold Teeth (`renewPrice` usa `price`). Banner "Estoque renovado por NG."; o painel reabre com o
  estoque novo; o botão fica desabilitado sem ouro.
- **Teste** (`events.test.mjs`, falha no código anterior em "same stock on every visit"): 6 visitas com o mesmo estoque,
  renovação cobra 20, reabre com `ev.stock`, próxima custa 35, sem ouro o botão desabilita. Suíte **174 / 174**; build,
  `check-bundle` e `npm run e2e` OK.

**Trigésima quarta rodada** (fase 20, `459923e..3612bd6`, `reviews/codex-2026-10-24-07-25-459923e..HEAD.md`): **Aprovado com
ressalvas**, 1 P3 aceito: o teste da renovação só comparava a tela com o próprio `ev.stock`. Agora `shopSelection` é
substituído por um estoque conhecido e o teste exige exatamente um sorteio e esses títulos na tela reaberta.

## 32. Fase 21 — Nome do treinador (24/10/2026)

- O nome da conta (permanente, já existia em `accounts`) passa a aparecer no título ("Treinador: Ash") e na linha de
  resultados ("Ash · Bulbasaur · Floresta Verde · Normal"); convidado aparece como "Convidado". Teste em `pause.test.mjs`.
  Suíte **175 / 175**; build, `check-bundle` e `npm run e2e` OK.

**Trigésima quinta rodada** (fase 21, `17f89e6..df00b00`, `reviews/codex-2026-10-24-07-27-17f89e6..HEAD.md`): **Aprovado com
ressalvas**, 1 P2 aceito: convidados de saves antigos (nome gravado "Guest") apareciam como "Treinador: Guest". O rótulo
agora vem do tipo da conta (`kind === "guest"` → "Convidado"), sem tocar no nome salvo; teste com um convidado chamado
"Guest". **Achado de passagem:** `src/ui/account.js` tinha um byte NUL cru dentro da string do `passHash` (escrito pelo
shell na fase 14); funcionava, mas o git e o `grep` tratavam o arquivo como binário. Trocado pelo escape `\u0000` — mesma
string, mesmo hash (`passHash("Ash", "pikachu123")` = `f1:1tifgc5` antes e depois). Suíte **176 / 176**; build e
`check-bundle` OK. ⚠ Correção deste registro: `npm run e2e` **falhou** nesta rodada, na limpeza (EPERM ao apagar o perfil
temporário do navegador ainda aberto), e o encadeamento do meu comando não barrou porque a saída passava por `tail`. O
script agora espera o navegador sair antes de apagar o perfil e trata a limpeza como aviso; três execuções seguidas OK.

**Trigésima sexta rodada** (`4db5b6c..957f65c`, `reviews/codex-2026-10-24-07-30-4db5b6c..HEAD.md`): **Aprovado com ressalvas**, 1 P3
aceito: o temporizador de 5 s da espera pelo navegador segurava o Node aberto mesmo quando o navegador já tinha saído; agora
é `unref()`. `npm run e2e` OK.

**Trigésima sétima rodada** (`957f65c..2bc5512`, `reviews/codex-2026-10-24-07-31-957f65c..HEAD.md`): **Aprovado com ressalvas**, 1 P3
**não aceito, por decisão**: pede teste de regressão em `tests/` para o `unref()` do temporizador. O código é do script de
e2e, que depende de um navegador instalado e por isso fica fora do `npm test`; um teste de subprocesso simulando o
navegador custaria mais que a linha que protege. Evidência registrada: a execução completa do e2e termina em 4 s (sem o
`unref`, o Node esperaria os 5 s do temporizador após o fim). A regra do `AGENTS.md` (correção com teste) vale para o jogo;
scripts de ferramenta são verificados por execução.

## 33. Fase 22 — Seletor de idioma pt-BR / English (24/10/2026)

- **Desenho (estilo gettext):** o texto pt-BR continua no código e é a chave. `src/core/lang.js` (`getLang`, `setLang`,
  `tr`) traduz nos pontos onde o texto chega à tela — `el()` de `dom.js` (filhos de texto, `placeholder`, `title`), os
  `textContent` do HUD, banners (passam por `el`), flutuantes e rótulos no canvas, erro de conta e de boot. `lang-en.js`
  tem `EN` (texto exato, ~230 entradas) e `EN_PATTERNS` (~55 regras para texto com números/nomes, que podem traduzir
  partes aninhadas — item da loja, dificuldade, nome de atributo); compostos com " · " são traduzidos parte a parte. Os
  rótulos derivados dos dados (tipos, biomas, arquétipos, raridade, vitaminas, andares, descrições de itens) saem de
  `i18n.js` já no idioma ativo; em inglês, biomas/vitaminas/andares usam o próprio texto do `rules.json`.
- **Por que não chaves:** trocar ~300 literais por chaves espalharia o texto longe do código e não mudaria o resultado; o
  risco do desenho escolhido é um texto novo esquecido, coberto pela varredura abaixo.
- **Seletor:** botão no título ("🌐 English" / "🌐 Português", cada um no próprio idioma); a escolha fica em
  `pokebonk-clone.lang.v1` (chave nova; as de save não mudam) e `<html lang>` acompanha. Padrão continua pt-BR, então os
  testes antigos não mudaram.
- **Varredura:** `scripts/collect-strings.mjs` liga o inglês e percorre todas as telas, as cartas de level-up (40 sorteios
  × 6 espécies), os três painéis de evento, conquistas e **runs inteiras do bot** (Clássico, Torre e Infinito), e lista o
  texto que chegou à tela sem tradução. Da primeira passada (1815 textos, 642 sem contar nomes dos dados) até zero em
  português; o que sobra é inglês ou nome próprio. `tests/lang.test.mjs` roda a mesma varredura e reprova qualquer texto
  com cara de português (acentos ou palavras como "de", "para", "golpe"), mais testes pontuais de padrões, persistência
  e do botão do título. O `npm run e2e` passou a trocar o idioma no bundle por `file://` e seguir em inglês.
- **Navegador:** título "Survivor roguelite… ▶ Play… Trainer: Guest", HUD "Lv 1 … → Ivysaur at Lv 24 · Green Forest ·
  CALM · Zone 1". Suíte **180 / 180**; build, `check-bundle` e `npm run e2e` OK. A regra de texto novo entrou no `AGENTS.md`.

**Trigésima oitava rodada** (fase 22, `351fb97..0ef55f0`, `reviews/codex-2026-10-24-16-27-351fb97..HEAD.md`): **Aprovado com
ressalvas**, 3 P2 + 2 P3, todos aceitos: (1) o saldo da loja era reescrito por `textContent` direto, em português, a cada
atualização — agora passa por `tr`. (2) O HUD guardava o bloco da espécie (chips de tipo, dica de evolução) e ignorava o
idioma; o idioma entrou na invalidação. (3) A tradução nos pontos de saída alcançava nomes digitados pelo jogador (conta
"Campeão" virava "Champion") e consultava chaves herdadas (`toString`): `lit()` em `dom.js` marca texto que nunca é
traduzido (nome da conta no título, na lista de perfis e nos resultados) e o dicionário só responde por chaves próprias
(`Object.hasOwn`). (4) A varredura só via o que passava por `tr`; agora lê também os nós de texto realmente renderizados
(incluindo `textContent` direto) depois de cada tela e de uma compra na loja. (5) O bot reconhecia baú, loja e botões só
em português e, em inglês, fechava os painéis sem usá-los; agora lê os dois idiomas e o teste exige baú aberto e compra
feita nas runs em inglês. Correção do registro da §33: "zero em português" só passou a valer com esta rodada. Suíte **181 / 181** no meu ambiente (no worktree do Codex, 181 / 182 — ver a 39.ª rodada);
build, `check-bundle` e `npm run e2e` OK.

**Trigésima nona rodada** (`0ef55f0..33f3323`, `reviews/codex-2026-10-24-16-30-0ef55f0..HEAD.md`): **Aprovado com ressalvas**, 2 P3,
aceitos, e um registro meu corrigido:
- O total de testes da 38.ª rodada saiu como um texto de código (`"+process.env.N+"`) por erro de escape no comando que
  gravou o registro; o mesmo comando já tinha deixado um byte NUL cru no texto da 35.ª rodada (`REVISAO_CODEX.md` virou
  "binário" para o `grep`). Os dois foram reparados com um script em arquivo.
- No worktree do Codex a suíte deu **181 / 182**: o teste de calibração do DPS (`dps.test.mjs`) reprovou. Medi 20 repetições:
  Gastly ia de 1,10× a 1,23× (limite 1,25×) porque seus golpes fantasma amaldiçoam o alvo (×1,25 de dano), amplificador
  situacional que a estimativa deixa de fora de propósito, como o sono. O teste agora zera a chance de status para medir o
  dano base; nas mesmas 20 repetições o máximo caiu para 1,11×. Não é bug do jogo.
- A varredura de idioma passou a ler o HUD e **cada painel que o bot abre** durante as runs, antes de ele agir, além dos
  estados finais. Suíte **182 / 182**; build, `check-bundle` e `npm run e2e` OK (saídas com código de saída conferido).

## 34. Fase 23 — Secret Key e Dowsing Machine, adaptados (24/10/2026)

- **Por que adaptados:** no original eles mexem com altares Unown e com o estoque de Poké Balls, sistemas que este jogo não
  tem (a captura não gasta bolas). Em vez de deixá-los fora para sempre, agem sobre o que existe, e as descrições dizem
  exatamente isso (pt-BR e inglês):
  - **Secret Key:** o Altar Antigo, depois de curar, recarrega em vez de sumir — 45 s, 30 % mais rápido por cópia extra
    (`ev.rechargeT`; durante a recarga o altar não aparece para `findNear` e a vida do evento é estendida).
  - **Dowsing Machine:** a partir da próxima zona (Clássico/Infinito) ou andar (Torre), cada um traz 1 altar e 2 baús por
    perto, por cópia (`WorldEvents.onNewZone`, chamado em `advanceStage` e em `Tower.enterFloor` do 2.º andar em diante).
- Com isso **os 38 itens scriptados do original estão no pool**. Testes em `items2.test.mjs` (recarga, 2 cópias, zona nova,
  andar novo; os dois falham no código anterior); `items.test.mjs` passa a exigir todos no pool (o `review14.test.mjs` só passou a exigir na 40.ª rodada).
  Suíte **184 / 184**; build, `check-bundle` e `npm run e2e` OK.
- ⚠ O primeiro registro desta seção perdeu os trechos de código: um heredoc sem aspas fez o shell tratar os acentos
  graves como comandos (nenhum efeito além de erros "No such file" e um `npm run` inexistente). Reescrito por script.

**Quadragésima rodada** (fase 23, `b8a6d16..748aca3`, `reviews/codex-2026-10-24-16-58-b8a6d16..HEAD.md`): **Aprovado com ressalvas**,
1 P2 + 1 P3, aceitos: o altar em recarga (Secret Key) seguia mostrando "Altar — E" sem aceitar o E; agora mostra a contagem
("Altar — 45 s", `WorldEvents.hintFor`). E o `review14.test.mjs`, com a lista de excluídos vazia, não verificava mais nada;
virou "todo item scriptado dos dados está em SCRIPTED e no pool" (38). Suíte **184 / 184**; build, `check-bundle` e `npm run e2e` OK.

## 35. Fase 24 — Espanhol e partida longa no Infinito (24/10/2026)

- **Espanhol:** `src/core/lang-es.js` com as mesmas 199 entradas e 54 padrões do inglês (nomes de topo únicos — `ES`,
  `ES_PATTERNS`, `STAT_ES`… — porque o bundle junta os módulos num escopo só). `lang.js` escolhe o dicionário pelo idioma
  ativo (`DICTS`); `i18n.js` ganhou tabelas em espanhol (tipos, arquétipos, biomas, raridade, vitaminas, andares, itens
  segurados e os 38 itens scriptados). O botão do título agora cicla pt-BR → English → Español, sempre nomeando o próximo
  idioma nele mesmo. O bot de teste lê os painéis nos três idiomas.
- **Teste:** `tests/lang.test.mjs` varre o espanhol também, com um detector de português que ignora o que o espanhol
  compartilha ("golpe", "de", "para", acentos agudos) e usa fronteiras por letra (`` do JavaScript quebra em "Común").
  O `npm run e2e` passa pelos três idiomas no bundle por `file://`.
- **Partida longa (item pedido como "jogo humano"):** não dá para jogar como humano daqui; o equivalente automatizado foi o
  bot jogando **60 minutos de Infinito** (nível 45, 5377 derrotas, 17 baús abertos, 6 compras) em inglês e em espanhol, com
  leitura do HUD a cada 10 s e de cada painel aberto: **nenhum texto em português** nos dois idiomas
  (`node scripts/collect-strings.mjs --lang=es --long --summary`). O jogo humano continua sendo o teste de balanço.
- Suíte **185 / 185**; build, `check-bundle` e `npm run e2e` OK.

## 36. Fase 25 — Sobrecura, estados, reações elementais e mergulho (25/10/2026)

Pedido: corrigir a sobrecura e trazer o combate que faltava, conforme o mapeamento do PokéBonk (glossário).

- **Sobrecura (bug):** a vitamina Enigma Berry oferecia "+X % sobrecura", mas `healPlayer` parava no HP máximo — sem efeito.
  Agora o excedente vira `overhealHp` até `overheal × HP máx.` e absorve dano antes do escudo; o HUD soma escudo e
  sobrecura no "+N".
- **Estados que não funcionavam (bug achado no caminho):** os golpes aplicam estados com os nomes dos dados
  (`paralysis`, `stun`, `knock`, `wet`, `confusion`, `charm`, `healblock`), mas o motor só lia `para`, `freeze`,
  `sleep`, `root`, `burn`, `poison`, `curse`. Paralisia (48 golpes), atordoamento (51) e recuo (105) não faziam nada.
  `src/game/combat.js` (novo) normaliza (`statusKey`) e aplica (`applyStatus`) com as durações do glossário:
  paralisia −50 % de velocidade 3 s; atordoamento para 0,5 s; recuo empurra 1,5 u; bosses ignoram atordoamento, recuo e
  confusão.
- **Estados novos:** Molhado 5 s (prepara reações); Confuso 3 s (anda sem rumo, não morde o jogador e fere o inimigo em
  que esbarra); Encantado 3 s (inimigos comuns param de atacar, os demais batem −40 %); Heal Block 6 s (o alfa
  enfraquecido não recupera HP ao escapar ou se recuperar — os inimigos deste motor não têm outra cura).
- **Ajustes ao glossário:** o sono acaba no golpe que dá o ×1,8 (antes todo golpe durante o sono valia ×1,8); a raiz
  passou a ser −65 % de velocidade (antes parava o inimigo e o controlador do boss).
- **Reações** (`REACTIONS`, multiplicador no próprio golpe, contadas em `stats.reactions`, com flutuante nos 3 idiomas):
  Eletrocutado (Molhado + Elétrico, ×1,5, salta para até 12 molhados a 9 u com 60 % de paralisia), Congelamento
  (Molhado + Gelo, congela na hora), Vapor (Queimado + Água, ×1,4, confunde e enraíza ao redor), Incêndio (Queimado +
  Planta/Voador, ×1,3, espalha a queimadura a 7 u), Destruição (Congelado + Lutador/Pedra/Aço, ×2,6 + estilhaços), Gás
  Venenoso (Envenenado + Fogo, ×1,4, explosão que envenena), Pesadelo (Dormindo + Fantasma/Sombrio, ×1,7 sobre o ×1,8 e
  cura 2 % do HP), Colapso Mental (Paralisado + Psíquico, ×1,6 + confusão), Fúria do Dragão (Encantado + Dragão, ×2).
- **Mergulho:** Shift no ar desce a −22 u/s; ao pousar, onda de choque de raio `2,5 + 1,5 × altura` e dano
  `(8 + 2 × nível) × dano × físico × (1 + altura)`. No chão, Shift segue sendo o deslize.
- **Fora desta fase:** cargas de veneno (até 10) e de resfriamento (3 para congelar), e a chance de paralisia "travar".
- **Testes:** `tests/combat.test.mjs` (9, todos falham no código anterior); `review14`/`review15` passaram a usar
  atordoamento no lugar da raiz. Suíte **194 / 194**; bot segue vencendo Clássico (10/10 sobrevivem) e Torre (5/5);
  build, `check-bundle` e `npm run e2e` OK. Navegador: "Eletrocutado!" sobre dois inimigos molhados e um mergulho de 3 u
  aplicado.
- ⚠ Balanço: paralisia, atordoamento e recuo passaram a valer de verdade (204 golpes), e as reações multiplicam dano —
  o jogo deve ficar mais fácil; conferir no playtest.

**Quadragésima primeira rodada** (fase 25, `fd5a19e..8ce0bde`, `reviews/codex-2026-10-25-05-36-fd5a19e..HEAD.md`): **Aprovado com
ressalvas**, 2 P2 aceitos: (1) o Encantado só abrandava o contato; investidas, ondas, meteoros, projéteis e poças do boss
batiam inteiros. `hitPlayer` ganhou o parâmetro `attacker` (quem disparou; `source` segue sendo quem encostou, para tipo
e espinhos) e aplica o −40 % a qualquer ataque; projéteis e poças passam o dono (`owner`). (2) O dano de área
(`hitAround`: itens, reações, mergulho, esbarrões de confusos) não dava o ×1,8 nem acordava o alvo dormindo; agora dá,
como qualquer golpe direto (os tiques de status seguem à parte). Dois testes novos (falham no código anterior). Suíte
**196 / 196**; build, `check-bundle` e `npm run e2e` OK.

**Quadragésima segunda rodada** (`8ce0bde..921be0e`, `reviews/codex-2026-10-25-05-38-8ce0bde..HEAD.md`): **Aprovado com ressalvas**, 1 P3
aceito: o teste do Encantado anunciava poças e investidas mas só exercitava `hitPlayer` e um projétil. Teste novo com uma
poça real (`zonesHostile` + tique) e uma investida real (`release` + `Boss.update`), ambas −40 % com o boss encantado;
conferido por mutação (sem o `owner` da poça, o teste falha). Suíte **197 / 197**.

## 37. Fase 26 — Altar do guardião, diretor por linha do tempo e mapa da zona (25/10/2026)

Itens 1 a 3 de `docs/MAPEAMENTO_POKEBONK.md`.

- **Altar do guardião (Clássico):** cada zona coloca um altar (`WorldEvents.placeGuardianAltar`) a 45–70 u do ponto de
  partida; não expira e não conta no limite de eventos. E no altar chama `Run.callGuardian` (sem painel) e o altar se
  gasta. O relógio da zona passou a 10 min (`ZONE_SECS = 600`, em `director.js`) e não chama mais o guardião: quando
  zera com o guardião dormindo, começa o **enxame final** (`Director.startFinalSwarm`): spawn 6× mais rápido, rajadas de
  6 elites, HP ×4 e dano ×2 **por minuto** sobre a curva; acaba na zona seguinte. O Infinito segue avançando a cada 5 min.
  HUD: "⏳ 9:59" ao lado da zona e "Enxame final!" quando ele começa.
- **Diretor por linha do tempo:** carta de espécie a cada 48–72 s de 1 a 9,6 min; Alfas 150/330/480 s; manada ou enxame
  em 235 s (zona 1) / 200 s; enxame 390 s; manada 520 s; ondas de elites 330 s (zona 1) / 270 s e 450 s (as zonas 2–3
  não somam mais 40 s a tudo). Cartas: uma em cada três vem dos residentes da região; depois de 4 min, 40 % das outras
  vêm do elenco tardio. **Elites livres:** um spawn comum vira elite com `1,2 % + 0,4 %/min + 3 %/zona` (× Super
  Lure), nunca nos primeiros 90 s da zona 1.
- **Dois ajustes de balanço que a mudança expôs** (o playtest pegou os dois):
  - A nova ordem de cartas abria a zona 1 com Pheromosa (BST 570): o bot morria aos 13 s em 9 de 10 seeds. Espécies sem
    linha evolutiva com BST ≥ 420 só entram no elenco da zona 3 (regra do PokéBonk).
  - Cada elite soltava um Doce Raro garantido; com elites livres o bot chegava ao nível 41–50 aos 600 s (antes 25–32).
    Elites livres (`freeElite`, do diretor e do enxame final) soltam doce com 15 % × power-ups; elites de onda, Alfas e
    chefes seguem garantidos. Bot: nível 20–30 aos 600 s, 10/10 sobrevivem; Torre 5/5 sem mudança.
- **Mapa da zona (M):** painel com a arena inteira (norte para cima), ícones dos eventos descobertos (a 30 u ou menos do
  jogador; o altar do guardião sempre), o chefe e a seta do jogador; legenda "Descoberto nesta zona" com contagem.
  Clicar num ícone o segue: **bússola** na borda da tela com o ícone e a distância em metros (`Renderer.drawCompass`),
  sobre o alvo quando ele está à vista e oculta ao chegar. O mapa pausa o jogo como o menu; M ou Esc fecha.
- **Bot:** aos 300 s de zona vai ao altar e acorda o guardião (o mesmo marco do relógio antigo); ignora o altar fora disso.
- **Fora desta fase** (BACKLOG 2b): portal depois do guardião (hoje a zona muda na hora), totem e invocador na linha do
  tempo da zona, eventos de mundo (Eclipse, Névoa…), ícones dos eventos no minimapa e marcas livres no mapa.
- **Testes:** `tests/director.test.mjs` (6), `tests/zonemap.test.mjs` (2), 2 novos em `tests/classic.test.mjs`; os
  testes que chamavam o guardião por `stageTime = 299.99` passaram a usar `run.callGuardian()`. Suíte **207 / 207**;
  build, `check-bundle` e `npm run e2e` OK (o e2e abre o mapa com M, confere que a partida fica parada e fecha com Esc).
  Navegador: mapa com o altar, bússola a 59 m, E no altar acorda o guardião (Scyther) e solta a bússola.

**Quadragésima terceira rodada** (fase 26, `d59c3bb..ef9a615`, `reviews/codex-2026-10-25-08-14-d59c3bb..HEAD.md`): **Aprovado com
ressalvas**, 3 P2 e 1 P3 aceitos, e as duas afirmações do §37 que ele contestou estavam erradas:
(1) A regra "espécie forte sem evolução só na zona 3" filtrava só o elenco principal; residentes (Tauros, Kangaskhan) e
o elenco tardio (Nihilego depois de 4 min) ainda os traziam. Agora vale para os três elencos; teste sorteia 40 cartas
aos 5 min e confere as cartas de fato sorteadas. (2) O altar era limitado à arena com `clamp` depois de sorteado: com o
jogador na borda ele podia cair a poucos metros. Agora a posição é sorteada de novo até cair dentro da arena (depois de
16 tentativas, mira o centro, que sempre cabe); teste com o jogador em quatro bordas/cantos e 20 seeds confere 45–70 u e
a arena. (3) M abria o mapa por baixo das cartas de nível, e o Esc ficava preso no bloqueio das cartas; agora M não faz
nada com as cartas abertas, e o e2e aperta M sobre as cartas. (4) O teste do doce só exercitava elite e Alfa; ganhou o
chefe. Os testes 1 e 2 falham no código anterior; o passo do e2e falha com o `main.js` anterior. Suíte **208 / 208**;
build, `check-bundle` e `npm run e2e` OK.

**Quadragésima quarta rodada** (`ef9a615..5c91ec5`, `reviews/codex-2026-10-25-08-18-ef9a615..HEAD.md`): **Aprovado**, sem achados
nem afirmações contestadas. Fase 26 encerrada.

## 38. Fase 27 — Separação engine / pacote de conteúdo (25/10/2026)

Preparação para um fork em outro universo (Digimon, repositório à parte); o jogo daqui não muda.

- **`src/content/pack.js` (`PACK`)**: o manifesto da franquia. A engine passou a ler dele: prefixo do
  `localStorage` (`pokebonk-clone`, mesmo valor — saves intactos), pastas de sprites (`pmd`, `front`: `sprites.js` e o
  build), iniciais `[1, 4, 7]` (`account.js`, `achievements.js`), lendário de reserva 150 (`run.js`), espécies da Old
  Rod 129/130 (o flutuante usa o nome da tabela) e os 18 tipos (cor e nome pt-BR/es). `TYPE_COLORS`, `TYPE_RGB`,
  `TYPE_PT`, `typeName` e o mapa de nomes de tipo do espanhol derivam do pacote; o mapa RGB duplicado em `run.js` sumiu.
- **`PACK.terms`**: troca de palavras por idioma, aplicada por `tr()` depois da tradução, em pt-BR também. Vazia no
  pacote Pokémon (o texto da engine já é de Pokémon); um fork troca "Pokémon", "Pokédex"…
- **Fora desta fase** (documentado em `docs/PACOTE_DE_CONTEUDO.md`): efeitos de itens e habilidades por chave,
  reações por tipo, loja, captura e evolução seguem sendo mecânica com chaves de Pokémon; os nomes das tabelas são o
  esquema da engine; `__POKEBONK_DATA__` fica.
- **Verificação:** as cores, o RGB e os nomes do pacote foram conferidos contra as três tabelas antigas antes da troca
  (18 tipos, 0 diferenças). `tests/pack.test.mjs` (4): tipos do pacote = `types.json`, tabelas da engine derivadas do
  pacote, iniciais = `start: true` do roster, espécies e pastas existem, troca de termos nos três idiomas (testada só em pt-BR e inglês; ver 45.ª rodada), e uma guarda
  que reprova o código da engine com os IDs/chaves do pacote de volta (falha com `run.js`/`account.js` anteriores).
  Suíte **212 / 212**; build, `check-bundle` (34 módulos) e `npm run e2e` OK.

**Quadragésima quinta rodada** (fase 27, `6d58996..a50c800`, `reviews/codex-2026-10-25-08-33-6d58996..HEAD.md`): **Aprovado com
ressalvas**, 1 P3 aceito, e a afirmação contestada estava errada: o teste da troca de termos usava "Pokédex" (igual em
inglês) e um mapa vazio no espanhol, então não provava a troca *depois* da tradução nem cobria o espanhol. Agora cada
idioma troca uma palavra que só existe na frase traduzida ("Catch", "Captura") e "Pokémon" → "Digimon", conferindo a
frase final nos três idiomas. Suíte **212 / 212**.

## 39. Fase 28 — Engine pronta para o fork Digimon (25/10/2026)

- `rules.evolution.levelByStage` (opcional): nível fixo de evolução por estágio do alvo; sem ele valem as faixas de
  sempre. `rules.ultimateBySpecies` (opcional): nome da ultimate por espécie; sem ele, o nome por tipo.
- `scripts/collect-strings.mjs` varre os iniciais do pacote mais Pikachu/Gastly/Eevee quando existem (no pacote
  Pokémon o conjunto é o mesmo de antes).
- Testes novos em `tests/pack.test.mjs` (2). Suíte **214 / 214**.
- **Fork criado** em `../digi-chosen-digimon` (clone local, remote `engine` → este repositório; sem GitHub ainda):
  pacote Digimon (tipos renomeados como elementos, iniciais Agumon/Gabumon/Patamon, termos Digimon/DigiDex/Digivice,
  prefixo de save próprio), 22 Digimon gerados por `scripts/make-digimon-data.mjs`, Ilha File, digivolução 12/26/40,
  arte de Pokémon removida (desenho procedural). No fork: `npm test` (conteúdo + playtest + idiomas) **14 / 14**, build,
  `check-bundle` e `npm run e2e` OK; Clássico 9/10 seeds sobrevivem 10 min; Torre fácil demais (anotado no README do fork).

## 40. Fase 29 — Arte do NotSpriteCollab no fork Digimon (26/10/2026)

- **Engine (`src/render/sprites.js`):** uma entrada de `sprites.json` pode vir de uma pasta no estilo SpriteCollab —
  cada animação com seu `file` (`Walk-Anim.png`…, quadros em `y = linha × fh`) em `<SHEET_DIR>/<id>/` — e `portrait`
  aponta um rosto 40×40 que o HUD, a escolha de parceiro e a DigiDex preferem. Espécie só com portrait desenha o
  procedural no mapa. Correção junto: a escala de cada animação passou a vir da altura em pé (idle, senão walk); antes
  cada animação era escalada pela própria altura visível e o desmaio deitado ficava gigante e o ataque minúsculo
  (visto no navegador com as folhas do NSS; o Pokémon tinha o mesmo efeito, mais discreto).
- **`scripts/nss.mjs`:** `import <pasta>` copia os portraits e as pastas de overworld usados (mapa espécie → id NSS)
  para `assets/portraits` e `assets/sprites/<id>`; `spriteTables()` lê o `AnimData.xml` (com `CopyOf`), decodifica os
  PNGs (RGBA 8 bits, sem dependência) para contar quadros/linhas e calcular as bordas, e gera `sprites.json` e
  `sprite-bounds.json` dentro de `make-digimon-data.mjs`.
- **Conteúdo:** linhas novas Guilmon → Growlmon → WarGrowlmon → Gallantmon e Salamon → Gatomon → Angewomon →
  Magnadramon (ambas iniciais) e Gigimon selvagem; 10 golpes de assinatura; 31 portraits, 3 folhas animadas
  (Guilmon, Gatomon, Gigimon). `CREDITS.md` com a autoria (NeroIntruder, Emmuffin, Charry).
- **Verificação:** teste novo em `tests/digimon.test.mjs` (todo Digimon com portrait 40×40; as 3 folhas com
  andar/parado/ataque/dano/desmaio, quadros e linhas preenchendo a imagem, uma duração por quadro, bordas dentro do
  quadro). Suíte do fork **15 / 15**; build, `check-bundle` e `npm run e2e` OK. Navegador: portraits na escolha de
  parceiro e no HUD; as 5 animações dos 3 desenhadas na mesma escala.

## 41. Fase 30 — Adventure, 02 e Tamers; procedural com as cores do portrait (26/10/2026)

- **Elenco:** `scripts/digimon-species.mjs` passa a ser a fonte (lido por `make-digimon-data.mjs` e `nss.mjs`), por
  chave; os ids seguem a ordem e os 31 primeiros não mudam (teste). 140 Digimon: as linhas de parceiro das três
  temporadas (17 parceiros, Veemon/Terriermon/Renamon/Monodramon/Impmon como raros), Rookies e Champions selvagens,
  Ultimates e os Megas vilões como chefes (`legendary`, fora do elenco selvagem). Elos que pulariam estágio
  (MetalSeadramon, Piedmon, MaloMyotismon, Beelzemon) ficaram sem forma anterior. 77 golpes.
- **Portraits:** o importador resolve o nome no `index.csv` do NSS (mapa de grafias japonesas em `NSS_NAMES`).
  Defeito achado e corrigido: o índice tem formas alternativas (Agumon "Black", três do Tailmon em qualquer ordem) e a
  última linha vencia — o Agumon saía preto. Agora vence a linha cuja forma é o próprio nome; sem ela, a primeira
  (teste com índice de exemplo). 131 portraits; 9 Digimon sem portrait no NSS (listados no README).
- **Procedural:** `species.palette` (corpo, barriga, destaque, contorno) extraído do portrait no build — o fundo em
  degradê é removido por preenchimento a partir das bordas — e usado por `creature.js`; `drawCreature` anima o
  procedural (salto ao andar, respiração, avanço no ataque, tremor no dano, tombo no desmaio). As formas seguem as
  genéricas do gerador.
- **Verificação:** suíte do fork **17 / 17** (playtest 10/10 no Clássico, 5/5 na Torre); build, `check-bundle` e
  `npm run e2e` OK. Navegador: grade de 24 Digimon com as cores dos portraits e as três folhas animadas.

## 42. Fase 31 — Folhas de andar geradas pelo Codex para os outros 137 Digimon (26/10/2026)

- **Geração:** `scripts/codex-sprites.mjs` chama o Codex CLI (`codex exec`, geração de imagem) por Digimon, com a folha
  de andar do Guilmon (NSS) como referência de estilo e grade (4x8 células de 32x40, ordem de direções do PMD) e o
  portrait do próprio Digimon; normaliza com ImageMagick, grava `Walk-Anim.png` + `AnimData.xml` (Idle = cópia do
  Walk) e regenera `src/data` a cada 5 folhas. Retomável; log em `assets/codex-sprites.log` (fora do Git e de
  `dist/`). Lote de 135 com 2 em paralelo: 134 de primeira; Kunemon barrado pela moderação e feito na 2.ª tentativa;
  o 71 saiu com 28 células vazias e foi refeito (o gerador agora reprova folha com célula vazia).
- **Defeitos achados na revisão visual e corrigidos:** os desenhos saíam fora da grade (pés de uma linha invadindo a
  célula de baixo, um sprite partido em duas) e com alfa 240–254 mais um "véu" de alfa 1–15 em volta. `scripts/recell.mjs`
  endurece o alfa (≥128 → 255, senão 0), separa os desenhos em blocos conectados, devolve cada bloco à célula do seu
  centroide e recoloca cada célula centrada com os pés na penúltima linha; o gerador aplica isso a toda folha nova.
  Teste com folha sintética (desenho deslocado 25 px + véu) que falha sem o recorte.
- **Render:** as folhas geradas só têm andar; `drawCreature` passa a emprestar do procedural o avanço no ataque, o
  tremor no dano e o tombo no desmaio quando a folha não tem a animação (`hasAnim`), e o movimento procedural virou a
  função `creatureMotion`, usada pelos dois caminhos.
- **Verificação:** suíte do fork **19 / 19** (novo: recorte e "todo Digimon tem folha de andar de 8 direções"); build,
  `check-bundle` e `npm run e2e` OK. Revisão visual: pranchas com os 137 primeiros quadros antes/depois do recorte;
  no navegador, Agumon no mapa e 24 folhas desenhadas pelo `drawSprite` da engine de lado e de frente. Não verifiquei
  em partida longa o empréstimo de ataque/dano/desmaio (o painel do navegador estava sem foco e o jogo não avançava) — feito na fase 32.

## 43. Fase 32 — Ataque, dano e desmaio emprestados às folhas geradas, conferidos (27/10/2026)

- **Como foi visto:** quadros de ataque, dano e desmaio do Greymon (folha gerada) desenhados pelo `drawCreature` real
  numa tela de teste, com a linha do chão e o eixo dos pés; depois partida ao vivo no navegador (Agumon, nível 2, abates,
  inimigos com flash de dano e tombo com fade), console sem erros.
- **Defeitos achados e corrigidos em `creatureMotion`:** (1) o avanço do ataque usava `clock % 30`, mas jogador e
  aliados passam o relógio de 0 a 120 em 0,22 s — o avanço repetia 4 vezes por ataque; agora é um só, com pico no meio.
  (2) Avançava só no eixo X (para a direita ao atacar para cima/baixo); agora segue `dirX`/`dirZ`. (3) No desmaio o
  corpo girava em torno dos pés e metade ficava abaixo do chão; agora sobe conforme tomba. Teste novo que falha no
  código anterior.
- **Verificação:** suíte do fork **20 / 20**; build, `check-bundle` e `npm run e2e` OK; quadros redesenhados depois da
  correção (um avanço só; para baixo avança para baixo; deitado sobre o chão).

## 44. Fase 33 — Testes das folhas geradas: quadros vazios, chefes, partida longa (29/10/2026)

- **Defeito achado:** o recorte da fase 31 deixou quadros vazios em 19 folhas (quase sempre a linha 7, baixo-esquerda;
  no Devimon um quadro da linha "direita", e por isso ele sumia ao atacar e desmaiar, que tocam o último quadro).
  Causa: desenhos que se encostam entre duas linhas viravam um blob só, levado inteiro para uma célula. Correção em
  `scripts/recell.mjs`: blob maior que 1,25 célula é cortado pela grade; quadro que ainda fique vazio copia outro
  quadro da linha ou a direção espelhada (8 − r). Recorte refeito a partir das folhas originais do Codex.
  A conferência da fase 31 só olhou os dois primeiros quadros das duas primeiras linhas, e o teste "every cell drawn"
  só contava linhas — agora confere cada quadro de cada folha; teste novo de desenhos encostados (falha no antigo).
- **Texto:** o aviso de captura dizia "Aperte E para lançar a bola" (e "throw a ball"/"lanzar la Poké Ball"); o pacote
  troca a frase por "usar o Digivice" nas três línguas, inclusive na ajuda. Teste com a frase do aviso (falha no antigo).
- **Como foi visto:** as 137 folhas inteiras (8 direções × 4 quadros) em pranchas; chefes (Devimon, MetalSeadramon,
  Apocalymon, Diaboromon, Omnimon) em pé, atacando e desmaiando pelo `drawCreature` real; partida de 4 min na Torre
  num Edge headless contra o servidor local (script de rascunho, fora do repositório: HP mantido cheio, primeira carta
  sempre), até o andar 6 — totens Bakemon, Phantomon e LadyDevimon e chefes Myotismon e VenomMyotismon desenhados
  grandes e com os pés na sombra; nenhum erro na página.
- **Verificação:** suíte do fork **21 / 21**; build, `check-bundle` e `npm run e2e` OK.
- **Fica no README (lacunas):** algumas folhas geradas não mudam de pose entre direções; os kits de guardião ainda
  gritam nomes de golpes Pokémon ("Saraivada!").

## 45. Fase 34 — Itens com nomes Digimon e a Torre equilibrada (29/10/2026)

- **Nomes:** `scripts/digimon-items.mjs` dá nome Digimon (estilo Digimon World: chips, disks, floppies, crests) às
  chaves de item da engine; o gerador grava em `rules.upgrades`, `rules.vitamins` e `items.json`, e os 18
  amplificadores de tipo viram "<elemento> Plug-in". Na engine, a carta de item usava a chave por extenso
  (`quick-claw` → "Quick Claw"): agora usa `name` quando existe (contrato atualizado). Os textos que a engine
  soletra — "Doce Raro"/"Rare Candy"/"Caramelo Raro" da loja, os avisos de Focus Sash/Band (no espanhol "Banda/Cinta
  Focus") e o Magikarp/Gyarados da vara (Gomamon/Ikkakumon, os do `PACK.oldRod`) — trocam por `PACK.terms`.
  Varredura de todas as strings de tela contra as 151 espécies e os 151 itens do jogo Pokémon: o resto está em
  textos de reserva que nunca aparecem (descrições em espanhol do `rules.json` cobertas pelos dicionários; passivas,
  cujo nome não vai à tela) ou em chaves antigas de dicionário. "Saraivada!" dos guardiões é o padrão "volley"
  (rajada), não um nome Pokémon — a lacuna do README estava errada e saiu.
- **Torre:** o andar 6 deixa de ser "Marowak's Shadow" e vira "Wizardmon's Memory" (pt/es nos dicionários); os
  subtítulos dos andares 1, 3 e 6 contam o castelo do Myotismon (hoje não vão à tela).
- **Equilíbrio da Torre — causa achada:** 15 % de cada onda são elites e cada elite soltava um Doce Raro garantido;
  o bot chegava ao nível 50 no andar 3 de 7 (141–254 s) e vencia 5/5 em 349–495 s. Cortar o XP de abate pela
  metade quase não mudou isso (medido). Correção em `tower.js`: as elites das ondas são `freeElite` como as do
  diretor do Clássico (15 % de doce). Medição com o bot honesto (sementes 31–35, 600 s): 3 vitórias em 512–584 s,
  1 viva no andar 6, 1 morte no andar 5 (299 s); nível final 25–38, o mesmo ritmo do Clássico. Referência do jogo
  Pokémon (fase 7): 2 vitórias ~550 s e 3 vivas no andar 7. Subir as curvas dos andares (+1 estágio) foi medido e
  descartado: com o fix, 2 mortes. Clássico sem mudança (10/10 sobrevivem 10 min, nível 24–35).
- **Testes novos (falham no código antigo):** cartas, vitaminas e itens segurados sem nome Pokémon e a carta mostra o
  nome dos dados; loja, avisos e vara nas três línguas; elites das ondas da Torre são `freeElite`; andares sem nome
  Pokémon em nenhuma língua. `tests/lang.test.mjs` passa a esperar "Bought XP Chip".
- **Verificação:** suíte do fork **24 / 24**; build, `check-bundle` e `npm run e2e` OK; no navegador, a carta de
  nível mostrou Fishing Pole / Mystery Meat / Speed Chip, e a descrição da vara ainda citava Magikarp — corrigido e
  coberto pelo teste.

## 46. Fase 35 — Regiões do Digimundo, triângulo de atributos e preparo da arte nova (30/10/2026)

- **Regiões:** a engine desenha 6 biomas e o fork usava só a floresta. `REGIONS` em `digimon-species.mjs` veste os
  outros 5: Continente Server (deserto, Etemon), Oceano da Rede (costa), Terra Gelada (geleira), Montanha Espiral
  (cemitério, Mestres das Trevas) e Montanha Infinita (vulcão, dragões), cada uma com tipos selvagens, residentes,
  guardiões por zona, chefes e os vilões Mega repartidos (cada um governa uma região só — teste). O visual de cada
  bioma (chão, névoa, adereços) foi copiado uma vez do `rules.json` do jogo Pokémon; o gerador acha o bioma pelo id e
  troca só o conteúdo. Na engine, `biomeName`/`biomeDesc` aceitam `biome.pt`/`biome.es` dos dados antes dos
  dicionários por id (que diziam "Torre Lavanda" para o cemitério). Playtest novo: uma run de 600 s por região, sem
  quebra de invariante nem morte antes de 4 min (Montanha Infinita morreu aos 356 s com o multiplicador 1.2; com 1.1
  sobrevive).
- **Atributos:** `species.attribute` (vaccine/data/virus/free) e `rules.attributes`; `attributeMult` na engine nos dois
  sentidos (`hitEnemy` e `hitPlayer`); sem tabela, neutro. O cartão do parceiro mostra o atributo (Vacina/Dados/Vírus/
  Livre, traduzidos) no lugar de "Digicore". Multiplicador medido na Torre (quase toda Vírus, contra um Agumon Vacina):
  1.2 voltou a 5/5 vitórias; 1.15 também; **1.1** devolveu o ponto da fase 34 (3 vitórias, 1 viva, 1 morte).
- **Arte (não gerada):** `codex-sprites.mjs` ganhou `--kind portrait|action` e `--redo`, com cada resultado validado numa
  pasta temporária antes de chegar a `assets/` (uma regeneração falha não apaga a arte atual) e o lote tolerante a falha
  do gerador. A folha de ação tem 6 colunas × 8 direções (4 de ataque, dano, desmaio) e é cortada em
  `Attack/Hurt/Faint-Anim.png`. O teste com Agumon e ExVeemon não gerou nada: **o Codex atingiu o limite de uso
  (libera 30/10 03:07) e o login expirou** — fica no BACKLOG.
- **Revisão das folhas (item "refazer as fracas"):** a suspeita de folhas que não viram foi checada quadro a quadro e
  estava errada (miniaturas pequenas demais): todas viram. Varredura de "dois desenhos num quadro" achou só o Numemon
  (104), a refazer quando o Codex voltar.
- **Verificação:** suíte do fork **27 / 27** (novos: triângulo nos dois sentidos — falha sem o gancho na engine —,
  regiões, playtest por região); build, `check-bundle` e `npm run e2e` OK; navegador: tela de regiões com os 6 nomes e
  textos em pt, cartões com Vacina/Dados, run no Continente Server com o chão de deserto.

## 47. Fase 36 — Lote de arte: folhas de ação, portraits e Numemon (30/10/2026)

- **Lote:** com o Codex de volta, `codex-sprites.mjs` gerou os 9 portraits que o NSS não tem (o do Paildramon na
  segunda tentativa; a primeira não produziu imagem), refez a folha de andar do Numemon (104) e gerou folhas de ação para
  os 137 Digimon de folha gerada (136 + Agumon refeito), sem nenhuma falha. `sprites.json` passa a ter
  `attack`/`hurt`/`faint` desenhados para os 140; o movimento emprestado do andar só sobra para quem não tem folha.
- **Moderação e prompt:** o primeiro pedido de ação ("attack/hurt/fainted") foi barrado pela moderação da OpenAI; o
  prompt virou uma folha de poses de jogo para todas as idades (golpe especial, recuo de surpresa, deitado
  dormindo). Portraits pedem fundo em degradê pastel (o primeiro do ExVeemon veio branco).
- **Correção no recorte:** `recell` preenchia um quadro de ataque vazio com o primeiro quadro desenhado da linha — às
  vezes o desmaio. Agora usa o vizinho mais próximo, esquerda primeiro. Teste novo, que falha no código antigo.
- **Revisão visual:** mosaico das 137 folhas (ataque + dano + desmaio, 8 direções) e dos 9 portraits, olhado um a um:
  todas viram, com o golpe de cada um; poucas (45, 76, 89, 106) trazem um resto de efeito num quadro vizinho — no
  BACKLOG.
- **Verificação:** o teste de cobertura agora exige todo quadro de andar, ataque, dano e desmaio desenhado para os 140;
  suíte do fork **28 / 28**; build, `check-bundle` e `npm run e2e` OK; navegador: `hasAnim` verdadeiro para
  ataque/dano/desmaio e uma run de 90 s na Torre sem erro na página, com o Agumon na pose do Pepper Breath.

## 48. Fase 37 — Folhas de respiração parada (idle) geradas (30/10/2026)

- **O que mudou:** `codex-sprites.mjs --kind idle` gera uma folha de 2 quadros (repouso, inspirando) × 8 direções a
  partir da folha de andar; o AnimData de cada pasta gerada agora sai das folhas que ela tem (`animsFor`). As pastas do
  NSS passam a ser reconhecidas pelo `Charge-Anim.png` (antes era o `Idle-Anim.png`, que as geradas agora têm).
  **129 dos 137** Digimon gerados têm idle próprio; 8 seguem com o ciclo de andar parado (lista no BACKLOG).
- **Achado 1 — tamanho:** o Codex desenhava o parado ~10 % menor que o andar; como a escala do sprite vem do idle,
  o Digimon "cresceria" ao começar a andar. **Achado 2 — achatado:** a revisão do primeiro lote mediu largura e
  altura de cada idle contra o andar e achou 56 de 122 com metade da largura: o modelo de imagem não faz folhas 1:5
  (entrega ~793×1983, quadros largos) e o Codex espremia isso em 64×320. **Achado 3 — fragmentos:** recortar a arte
  bruta numa grade regular trazia pedaços dos vizinhos (os desenhos cruzam as linhas da grade).
- **Correção:** `cutRaw` (`scripts/recell.mjs`) recorta o `raw.png` do modelo: cada desenho conectado vai para a
  célula do seu centroide, ciscos (< 3 % do maior desenho da célula) saem, e cada linha é escalada inteira, sem
  distorcer, até a altura mediana da mesma linha no andar, pés na linha de sempre. Portões: altura alcançada ≥ 85 %
  (desenho largo demais encolheria), sobreposição dos 2 quadros ≥ 75 % (sem pisca), nenhuma célula vazia. 19 idles
  saíram das pastas temporárias das tentativas falhas, sem nova chamada ao Codex; 51 foram regenerados; 4 idles
  achatados que não passaram na regeneração foram removidos (voltam ao ciclo de andar).
- **Moderação:** o primeiro pedido ("breathing in — the chest…") foi barrado na saída; virou "cute all-ages game".
- **Teste do triângulo instável:** falhou 1 vez em 4 (crítico ou esquiva sorteados no golpe medido); agora fixa o
  sorteio (`withRandom`), 6/6 depois.
- **Verificação:** testes novos — recorte da arte bruta (proporção mantida, mesma altura do andar, pés no lugar,
  respiração preservada; falha no código antigo, que não tinha `cutRaw`) e cobertura exigindo o idle desenhado
  nas 8 direções para os 140; suíte do fork **29 / 29**; build, `check-bundle` e `npm run e2e` OK; revisão visual
  dos 129 idles ao lado do andar; run de 60 s na Torre sem erro na página, Agumon parado no início com o idle.

## 49. Fase 38 — Eventos de zona: Névoa, Tempestade, Eclipse e Numemon dourado (30/10/2026)

- **O que mudou:** `src/game/zoneevents.js` (`ZoneEvents`, em `run.zoneEvent`; o nome `WorldEvents` já é o de
  baú/loja/altar) com os quatro eventos de mundo do PokéBonk mapeados em `docs/MAPEAMENTO_POKEBONK.md`. A linha do
  tempo do diretor ganhou um evento por zona: 240–420 s no Clássico, 120–220 s no Infinito. A Torre não tem eventos,
  porque o diretor não roda lá.
  - **Névoa espectral (45 s):** 3 + zona inimigos de Vento/Fantasma e XP ×2 nas orbes.
  - **Tempestade elétrica (40 s):** a cada 1,4 s, uma marca amarela a até 6 u do jogador. 1,2 s depois cai o raio:
    15 % do HP máximo no jogador que estiver na marca, e dano elétrico nos inimigos em volta.
  - **Eclipse (40 s):** 3 + zona inimigos de Trevas/Fantasma, um deles shiny.
  - **Pokémon dourado (25 s):** `PACK.goldenRunner` (Numemon), de elite. Foge do jogador e nunca morde. Solta uma
    moeda por golpe (no máximo uma a cada 0,15 s) e 12 moedas quando cai. Se o tempo acaba, escapa.
- **Interface e render:**
  - o HUD mostra o nome e os segundos restantes ao lado do relógio da zona;
  - `drawZoneEvent` muda a luz (névoa clara, eclipse escuro, céu de tempestade), com entrada e saída de 1 s;
  - `drawStormMarks` põe as marcas no chão, sob as criaturas;
  - o dourado ganha um tom amarelo forte.
  - Os textos estão em pt-BR, com en/es em `lang-en.js`/`lang-es.js`; "Pokémon" vira "Digimon" por `PACK.terms`.
- **Fora do escopo:** céu e nuvens próprios por evento (o render é 2D) e o "1.º spawn vira elite após 90 s" do eclipse.
- **Verificação:**
  - `tests/zoneevents.test.mjs` (6 testes, agora no `npm test`) cobre:
    - a linha do tempo nos dois modos;
    - na névoa, os tipos e o XP ×2, e o fim aos 45 s;
    - na tempestade, o raio fere quem está na marca e não quem está a 5 u;
    - no eclipse, um shiny;
    - no dourado, a fuga, a moeda por golpe com limite, a chuva de moedas e a fuga aos 25 s;
    - os textos em en/es sem "Pokémon".
  - Suíte do fork: **35 / 35**. Build, `check-bundle` e `npm run e2e` OK.
  - `director.test.mjs` (engine, dados Pokémon, fora do `npm test`) tem a mesma falha antes e depois da mudança.
  - No bundle por `file://` num Edge headless, cada evento foi forçado na partida e capturado em tela, sem erro na
    página. A névoa e o eclipse mudam a luz, as marcas da tempestade aparecem e o Numemon aparece dourado.
  - O balanceamento não foi jogado por um humano.

## 50. Fase 39 — Passivas dos parceiros e retoques de arte (30/10/2026)

- **Achado:** dos kits passivos, a engine só aplicava `mods` e `dmgTaken`; `lowHp` e `typeBoost` eram ignorados. Agumon,
  Guilmon, Veemon e Monodramon (`blaze`) e Gomamon e Armadillomon (`torrent`) jogavam sem passiva nenhuma; a passiva
  também nunca aparecia na tela (o cartão mostra o atributo).
- **Passivas:** `PASSIVES` em `scripts/digimon-species.mjs`, uma por linha de parceiro, com nome de brasão ou Digiovo
  (Coragem, Amizade, Esperança… Hazard, Momentai, Travessura), copiadas para `rules.abilityKits` por
  `make-digimon-data.mjs`. A engine passa a aplicar `typeBoost` (em `recompute`) e `lowHp` (em `hitEnemy`, abaixo de
  40 % do HP). A tela de parceiro mostra nome e descrição da passiva no rodapé; en/es em `lang-en.js`/`lang-es.js`.
- **Arte:** folhas de ação de 45, 76, 89 e 106 refeitas pelo Codex (`--redo`), sem os resíduos de efeito. Os 8 idles
  que faltavam reprovaram pela terceira vez (desenho largo: 68–85 % da altura do andar); agora saem do próprio quadro
  de andar por script (`--kind idle --from-walk`, `idleFromWalk` em `scripts/recell.mjs`: o quadro do andar e o mesmo
  desenho 1 px mais alto, pés fixos).
- **Verificação:** testes novos — passivas próprias, descritas e traduzidas, com Coragem dando +10 % Fogo e ×1,4 abaixo
  de 40 % (falha no código antigo da engine); `idleFromWalk` (quadro do andar, depois 1 px mais alto com os pés no
  lugar). Suíte do fork **37 / 37**; build, `check-bundle` e `npm run e2e` OK. Revisão visual: as 4 folhas de ação lado
  a lado com as antigas e os 8 idles. No bundle por `file://`, a tela de parceiro mostra "Brasão da Coragem — …" sem
  erro na página. A rolagem horizontal da tela de parceiro (914 px em 900) já existia antes. Balanceamento das
  passivas não foi jogado por humano.

## 51. Fase 40 — Publicação no GitHub Pages (30/10/2026)

- **O que mudou:** `.github/workflows/pages.yml` roda a cada push na `main` (ou à mão): `npm test`, `npm run build`,
  `npm run check:bundle`, copia `dist/digi-chosen.html` para `dist/index.html` e publica `dist/` no Pages
  (`actions/upload-pages-artifact` + `actions/deploy-pages`). Endereço: https://tmoreiradev.github.io/digi-chosen-digimon/.
- **Depende do dono:** o repositório é privado; no plano gratuito o Pages só publica repositório público. Falta tornar
  o repositório público e escolher "GitHub Actions" em Settings → Pages → Source. Até lá o job de deploy falha.
- **Verificação:** num clone limpo, `npm test` (37/37), build e `check-bundle` OK; os 843 PNGs citados em
  `sprites.json` existem com a mesma caixa de letras em `dist/` (o servidor do Pages diferencia maiúsculas; o Windows
  não); `dist/` servido por HTTP (`makeHandler` do `server.mjs`) jogado num Edge headless — sprites carregam, eventos
  de zona rodam, sem erro na página.
- **No ar (30/10):** repositório tornado público e fonte do Pages em "GitHub Actions" a pedido do dono (pelo Chrome;
  a confirmação por passkey foi dele). A 1.ª execução (push, antes dos ajustes) falhou como esperado; a 2.ª
  (`workflow_dispatch`) passou. O site responde 200 com o jogo e os sprites e abre a tela de título no Chrome.

## 52. Fase 41 — Controles de toque (30/10/2026)

- **O que mudou:**
  - `src/ui/touch.js` (`TouchControls`):
    - joystick flutuante na metade esquerda da tela, que nasce onde o dedo toca;
    - botões à direita para pular, dash, ultimate e interagir (E), além de mapa e pausa.
  - Eles escrevem no mesmo `input` do teclado. O movimento analógico vai em `input.moveX` e `input.moveZ`.
    `Run.updatePlayer` soma esses valores às teclas e só normaliza acima de 1, então meio curso do joystick dá meia
    velocidade.
  - Os controles só aparecem durante a run, sem pausa, sem cartas e sem painel aberto, e só em aparelho de toque
    (`pointer: coarse` ou o primeiro `touchstart`).
  - "Como jogar" ganhou uma linha sobre o toque (en/es incluídos).
- **Achado 1:** uma `}` sobrando no `styles.css` (o `.event-panel` estava fora do seu `@media`) fazia o navegador
  descartar o bloco seguinte, com as regras de HUD para tela estreita. No celular, o minimapa ficava com 132 px e a
  barra de golpes passava da borda. Corrigido.
- **Achado 2:** o `#screens` (camada dos menus) cobre a tela inteira mesmo vazio durante a partida e engolia os
  toques. Agora ele tem `pointer-events: none` e só os filhos recebem eventos.
- **Layout no celular:**
  - em pé (≤ 600 px de largura): o bloco de relógio e região vai para baixo do cartão do jogador, e a barra de
    golpes encolhe;
  - deitado (≤ 500 px de altura): os contadores ficam sob o cartão, mapa e pausa ao lado do minimapa, e as ações
    no canto.
  - O `setPointerCapture` é protegido para o caso de o dedo sair no mesmo quadro.
- **Verificação:**
  - Testes novos em `tests/touch.test.mjs`, agora no `npm test`:
    - vetor do joystick (zona morta, limite 1, direção);
    - o jogador anda pelo vetor, com meia velocidade a meio curso; esse teste falha no `run.js` antigo;
    - `styles.css` fecha todos os blocos; esse teste falha no CSS antigo.
  - Suíte do fork **40 / 40**. Build, `check-bundle` e `npm run e2e` OK.
  - No navegador do app, com emulação de celular (375×812 e 812×375, toque ativo), servido por `npm start`:
    - os controles aparecem só na partida;
    - um toque mantido no lado esquerdo moveu o Digimon 1,9 u em 0,8 s, e ele parou ao soltar;
    - o botão de pulo fez o Digimon pular, e o de pausa abriu a pausa;
    - as cartas de nível e a pausa cabem na tela em pé e respondem ao toque;
    - o layout foi conferido em capturas de tela, em pé e deitado.
- **Não verificado:** os toques foram eventos de ponteiro sintéticos, sem nenhum aparelho físico; o único erro no
  console veio desses eventos. Sem mando (gamepad).

## 53. Fase 42 — Balanceamento do playtest: início dos parceiros, Torre e Clássico (30/10/2026)

- **Início dos parceiros:** o bot mediu o nível aos 3 e aos 6 min (4 seeds) de cada parceiro.
  - Terriermon e Renamon ficavam no nível ~7 aos 3 min, contra 10–12 dos outros. Com isso matavam menos, ficavam
    cercados e coletavam menos XP: o Terriermon pegava só 44 % das orbes.
  - `bolt` (Gabumon, Terriermon, Salamon, Wormmon) passou para dano 16 e perfuração 1 (era 13 e 0).
  - Diamond Storm (Renamon) trocou `barrage` por `smite`. Com `barrage` dano 6 ou 7, o Renamon seguia atrás.
  - Agora os 17 ficam entre 10,3 e 12,5 aos 3 min e entre 20,8 e 25,3 aos 6 min.
- **Torre:** o Myotismon do andar 5 era um chefe completo (dano ×2,2) e o andar matava 10 de 51 runs do bot,
  incluindo o Hawkmon em todas. Os dados de dano por fonte apontaram para ele. Agora ele é um totem:
  - nenhuma morte no andar 5;
  - 33 vitórias, 7 mortes (todas nos andares 6–7) e 11 runs ainda vivas no limite de 15 min da medição, que não é
    um limite do jogo.
  - Gabumon, Veemon, Hawkmon e Renamon continuam lentos na Torre.
- **Clássico, não alterado:** três tentativas nas zonas 2–3, medidas com 8 parceiros × 2 seeds, e todas revertidas:
  - dano dos inimigos ×1,4;
  - HP dos inimigos ×1,6/×1,8;
  - velocidade dos inimigos ×1,2/×1,3.
  - Nenhuma mudou o perigo para o bot: a mediana do HP mínimo ficou em ~88–90 % nas zonas 2–3. O bot foge o tempo
    todo e os inimigos não o alcançam, então ele não serve para medir a dificuldade do Clássico. Isso precisa de uma
    pessoa jogando. O perigo real dele é o santuário (mediana de 72–78 %).
- **Onde ficou:** os ajustes estão no gerador (`scripts/make-digimon-data.mjs`, `scripts/digimon-species.mjs`) e
  saem em `src/data/rules.json`.
- **Verificação:**
  - `tests/balance.test.mjs` (agora no `npm test`), os dois testes falhando com os dados antigos:
    - Terriermon e Renamon na média do nível ≥ 9 aos 3 min, em 3 seeds (antes: Terriermon 6/6/7);
    - Hawkmon passa do andar 5 (antes: morto no andar 5).
  - Suíte do fork **42 / 42**. Build, `check-bundle` e `npm run e2e` OK.
  - Telemetria final: no Clássico, 48 vitórias em 51 (antes 47); na Torre, 33 vitórias em 51 (antes 30) e nenhuma
    morte no andar 5 (antes 10).

## 54. Fase 43 — Melhorias de interface do playtest (30/10/2026)

- **Tela de resultado:**
  - "UPGRADES" passa a contar todas as cartas escolhidas (`stats.picks`). Antes contava só as cartas de item
    (`stats.items`, que segue existindo para as conquistas).
  - A tela diz quem deu o último golpe (`stats.killedBy`, gravado em `hitPlayer` ao morrer).
  - Mostra o build da run.
- **Build na pausa:** passiva (nome e descrição), golpes com nível, itens, vitaminas e atributos (HP máximo, dano,
  crítico, armadura, velocidade). É a mesma função (`buildSummary` em `screens.js`) da tela de resultado.
- **Plug-ins de tipo:** só entram no sorteio os plug-ins dos tipos do parceiro ou dos golpes do kit dele. Antes, os
  outros tipos tinham peso 0,35, e o Agumon recebia um "Ice Plug-in".
- **Altar do guardião:** antes dos 5 min de zona, o aviso diz "(recomendado em m:ss)". É o tempo em que o bot de
  teste acorda o guardião; no playtest, acordá-lo aos 3:55, no nível 13, matou em ~11 s.
- **HUD:** os contadores têm rótulo ("ouro", "abates"). O ✦ (dust) saiu do HUD: o jogo acumula dust, mas nada o
  gasta.
- **Loja:** a lista mostra 3 itens sem rolagem (`max-height` de 150 → 240 px; o painel de 340 → 480 px).
- **"Como jogar":** "evolua" virou "digievolua" pela troca de termos do pacote, nos três idiomas.
- Os textos novos estão em pt-BR, en e es; o aviso do altar tem padrão próprio em `EN_PATTERNS`/`ES_PATTERNS`.
- **Verificação:**
  - `tests/interface.test.mjs` (agora no `npm test`), com os três testes falhando no código antigo:
    - todas as cartas contadas e o atacante gravado ao morrer;
    - em 400 sorteios, o Agumon só recebe plug-ins de tipos que usa;
    - o aviso do altar antes e depois dos 5 min, em en/es.
  - Suíte do fork **45 / 45**, incluindo a varredura de idiomas, que renderiza a tela de resultado em inglês.
    Build, `check-bundle` e `npm run e2e` OK.
  - No navegador do app: HUD com rótulos, aviso do altar com "recomendado em 4:53", pausa com o build e resultado
    com "Derrotado por Togemon", "5 upgrades" e o build. Tudo conferido em captura de tela.
  - A loja com 3 itens não foi aberta no navegador.
