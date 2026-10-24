# AGENTS.md — instruções para agentes (Codex, Claude e afins)

**Projeto:** Digi Chosen — roguelite survivor em JavaScript vanilla (ES modules), Canvas 2D, Web Audio e
localStorage. Sem dependências; Node >= 18 só para o servidor local, os testes e o build. O jogo precisa
continuar funcionando offline, inclusive `dist/digi-chosen.html` aberto por `file://`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm start` | servidor estático em `http://localhost:8080/` (confira se já não há um rodando na porta) |
| `npm test` | `node --test tests/*.test.mjs` — dados reais de `src/data`, DOM mínimo em `tests/_dom.mjs`; inclui o playtest (`tests/_bot.mjs` joga runs inteiras, Clássico e Torre até a vitória) |
| `npm run build` | gera `dist/digi-chosen.html` e copia `dist/pmd`, `dist/front` (`dist/` não é versionado) |
| `npm run check:bundle` | confere que o bundle parseia e bate com fontes, dados e CSS |
| `npm run e2e` | abre `dist/digi-chosen.html` por `file://` num Edge/Chrome headless (DevTools Protocol, sem dependências) e joga: título → parceiro → setup → run → carta → pausa → item → sair; falha com qualquer erro da página (`CHROME_PATH` escolhe o navegador; exige **Node ≥ 22** pelo `WebSocket` nativo) |
| `npm run review:codex -- <range>` | revisão externa pelo Codex CLI num worktree limpo; relatório em `reviews/` |

## Regras do repositório

- `src/data/*.json` são as tabelas do jogo e **são versionadas**; só `/data/` na raiz (cópia de trabalho da
  extração) fica fora do Git. Não reintroduza uma regra `data/` sem âncora no `.gitignore`.
- Texto novo na interface: escreva em pt-BR e acrescente o inglês em `src/core/lang-en.js` e o espanhol em `src/core/lang-es.js` (exato em `EN`/`ES`, com números/nomes em `EN_PATTERNS`/`ES_PATTERNS`); `tests/lang.test.mjs` reprova texto em português que chegue à tela no modo inglês.
- Não mude as chaves do `localStorage` (`pokebonk-clone.*`) nem o global `__POKEBONK_DATA__` sem migração;
  saves antigos têm de continuar carregando (`normalizeProgress` em `src/ui/account.js`).
- Não troque personagens, sprites ou nomes por outra franquia; preserve os créditos e a licença das sheets
  (README, "Provenance").
- Um caminho só para cada coisa: nível por `Run.addXp`/`useRareCandy`; compra por `WorldEvents.buy`;
  capturas em `profile.data.pokedex` (não existe outra lista); boss por `Boss.spawn` + teto em `hitEnemy`.
- Correção de bug vem com um teste em `tests/` que falha no código antigo. `node --check` em tudo que mudar.
- Commits em português, sem trailers de coautoria. Nada de `push`, remote ou reescrita de histórico sem o
  dono pedir.
- Documente o que fez em `REVISAO_CODEX.md` (uma seção por fase, dizendo como cada item foi verificado) e
  mova pendências para `BACKLOG.md`. Não declare validado o que não executou.

## Onde estão as coisas

`src/main.js` (bootstrap, loop, input) · `src/game/run.js` (simulação, nível, modo Clássico) ·
`src/game/boss.js` · `src/game/capture.js` (captura/aliados) · `src/game/events.js` (baú/loja/altar) ·
`src/game/achievements.js` (conquistas, tarefas, ovos) · `src/ui/*` (telas, HUD, contas) ·
`src/render/*` (sprites PMD e render) · `src/audio/*` (SFX e música sintetizados).
