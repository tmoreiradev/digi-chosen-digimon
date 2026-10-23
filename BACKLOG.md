# Backlog — Digi Chosen

Itens levantados no code review de 23/10/2026 e **não** tratados na etapa de estabilização
(renomeação + três bugs confirmados + achados críticos). Nada aqui expande o escopo daquela
etapa; é a lista para a próxima fase ("o que está faltando").

## 1. Lacunas de mecânica (código existe, mas não está ligado ou está incompleto)

| # | Item | Onde | Observação |
|---|------|------|------------|
| 1 | ~~Modo Clássico sem guardiões, santuário e vitória~~ | `run.js` | **Feito na fase 2 (23/10):** `updateClassic`/`onBossDefeated`/`enterSanctuary`. Falta validar o balanceamento em jogo (HP do boss sai da curva de zona, não só do orçamento de DPS). |
| 2 | ~~Teto de burst e exaustão do boss nunca aplicados~~ | `run.js` `hitEnemy` | **Feito na fase 2:** `capDamage(amount * hitMul())` para o boss ativo (vale também para os guardiões da Torre). |
| 3 | **Só alfas ficam capturáveis** | `run.js` `hitEnemy` (`e.tier === "alpha"`) | `Capture.weaken` e o README aceitam boss também. Decidir se boss é capturável. |
| 4 | **Torre: director continua spawnando** | `run.js` `update` (`this.spawnAccum = 0`) | A linha zera uma propriedade inexistente do `Run`; a intenção do comentário era `this.director.spawnAccum`. Não corrigido porque muda o balanceamento das ondas — validar o pacing em jogo antes. |
| 5 | **Conquistas sem recompensa** | `achievements.js` | `reward` ("20G"…) nunca é concedido; `ACHIEVEMENTS[].need` não é usado (checagens hardcoded); `profile.data.runsCompleted/wins/towerFloors` são inicializados mas os contadores reais vivem em `achievements.*`. |
| 6 | **Duas listas de capturados no perfil** | `profile.data.caught` × `profile.data.pokedex.caught` | A primeira alimenta título/conquistas e recebe a espécie jogada ao fim da run; a segunda alimenta a Pokédex. Ovo eclodido só entra na segunda. Unificar. |
| 7 | **Evolução re-sorteada a cada checagem** | `rules.js` `evolutionPlan` com rng | Linhas com várias evoluções (Eevee) mudam o nível-alvo entre verificações. Guardar o plano no player. |
| 8 | **Eventos de mundo consumidos ao abrir** | `events.js` `interact()` | Sair sem comprar/abrir também consome; spawn em qualquer ponto do mapa (pode ficar longe do jogador). |
| 9 | **Pausa durante o level-up** | `main.js` `onKeyDown` | P/Esc pausa com as cartas abertas; a tela de pausa (z 30) fica atrás das cartas (z 70). Bloquear a pausa ou subir a tela. |
| 10 | **Stats do upstream sem efeito** | `rules.js` `basePlayerStats` | `shieldMax`, `thorns`, `knockback`, `bounces`, `flinch`, `powerup`, `eliteSpawn`, `slam`, `enemyAmount` existem no bloco mas o engine não os lê. |
| 11 | **Upgrades só com tags ficam fora do pool** | `run.js` `rollChoices` (`u.mods?.length`) | Por design atual; os 18 itens de tipo entram só pelo `mods` de +3 % dano. |
| 12 | **Música de batalha nunca ativa** | `music.js` `setTheme(…, battle)` | Nenhum caller passa `battle = true`. |
| 21 | **Torre: HP dos guardiões ignora a curva de boss** | `boss.js` `spawn` (`isTower`) | Os multiplicadores `totem ×2.2` / `summoner ×1.4` sobre `enemyHpCurve(4, 2.5)` nunca valeram; na fase 2 a curva de boss passou a valer só para o Clássico, de propósito, porque aplicá-la à Torre multiplicaria o HP dos totens por ~20–50×. Rebalancear os andares antes de ligar. |
| 22 | **Barra de HP do boss no HUD** | `hud.js` | Hoje só a barra sobre o sprite e os banners de fase. |
| 23 | **`playerExpectedDps` subestima o jogador** | `run.js` | Ignora crítico, aliados, bônus de tipo e itens; o orçamento de HP do boss sai baixo e a luta fica na curva — validar em jogo. |

## 2. Qualidade / robustez

| # | Item | Onde |
|---|------|------|
| 13 | HUD reconstrói slots e ult a cada frame (DOM churn) | `hud.js` `update` |
| 14 | UI mista inglês/português, `lang="en"`, sem i18n | `screens.js`, `index.html`, `build.mjs` |
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
- Tradução completa para pt-BR (ou escolha de idioma).
- Testes de interface no navegador automatizados (hoje: `node --test` + validação manual via console).
