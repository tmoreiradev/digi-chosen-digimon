# Pacote de conteúdo — o que é engine e o que é franquia

Objetivo: permitir um fork em outro universo (o primeiro alvo é Digimon, com os Digimon oficiais, num
repositório à parte) trocando **conteúdo** sem reescrever a **engine**. Este repositório continua
sendo o jogo de Pokémon (regra do `AGENTS.md`); aqui só se separa o que é de cada lado.

## O pacote (o que um fork substitui)

| Peça | Onde | O que é |
|---|---|---|
| Manifesto | `src/content/pack.js` (`PACK`) | constantes da franquia que a engine lê: prefixo do `localStorage`, pastas de sprites, iniciais, lendário de reserva, espécies da Old Rod, o fujão dourado do evento de zona (`goldenRunner`), tipos (cor e nome em pt-BR/es; inglês = chave capitalizada), troca de palavras por idioma |
| Tabelas | `src/data/*.json` | espécies, golpes, aprendizado, habilidades, tabela de tipos, itens, regras (`rules.json`), metadados de sprites e limites por quadro |
| Arte | `assets/<PACK.spriteDirs>` | 1.ª pasta: folhas animadas `<id>.png` no formato PMD (8 direções × quadros); as demais: imagens estáticas citadas em `sprites.json` (`fallback`) |
| Texto | `src/core/lang-en.js`, `lang-es.js` + `PACK.terms` | o texto da engine é pt-BR com os termos de Pokémon; um fork troca "Pokémon", "Pokédex", "Poké Bola"… por `PACK.terms` (aplicado depois da tradução, em todos os idiomas) e traduz as frases próprias |

`PACK.storagePrefix` precisa ficar `pokebonk-clone` neste repositório (saves antigos); um fork usa o seu
e começa saves limpos.

## Esquema das tabelas (o que a engine espera)

Os nomes dos arquivos são o esquema da engine (`game-data.js` lê cada um), não variam por pacote.
Um fork Digimon mantém os nomes `pokemon.json`, `moves.json`… e preenche os campos:

- **Espécie** (`pokemon.json`): `id`, `key`, `name`, `types[]` (chaves de `types.json`), `stats`
  `{hp, atk, def, spa, spd, spe}`, `bst`, `weight`, `height`, `color`, `legendary`, `mythical`,
  `captureRate` (0–255), `abilities[]`, `evoFrom`, `evoLevel`, `evoStage` (0 = forma inicial), `family`.
- **Golpe** (`moves.json`): `id`, `key`, `name`, `type`, `power`, `cls` (`physical`/`special`/`status`),
  `ailment`, `ailmentChance`, `drain`, `healing`, `crit`, `flinch`, `minHits`/`maxHits`. O arquétipo de
  ataque sai de `rules.moveOverrides` pela `key` ou, sem override, de regex sobre o nome em inglês
  (`ARCHETYPE_REGEXES`) — um fork deve preferir `moveOverrides` explícitos.
- **Tipos** (`types.json`): `order`, `names`, `chart` (multiplicadores; a engine os achata na curva
  1,35 / 0,8 / 0,5). As chaves de `order` têm de bater com `PACK.types` (testado).
- **Regras** (`rules.json`): biomas (tipos, residentes por família, guardiões por zona, lendários),
  `roster` (parceiros jogáveis com `kit` de 4 golpes; `start: true` = `PACK.starters`, testado),
  `abilityKits`, `upgrades`, `vitamins`, `typeItems`, `tower`, `boss`, `capture`, `allies`.

## Ainda preso à franquia dentro da engine (próximos passos)

Estes pontos são **mecânica** com chaves de Pokémon; um fork reaproveita a mecânica dando às suas
peças as mesmas chaves (ou isto vira tabela de dados numa fase futura):

| Ponto | Arquivo | Como um fork lida hoje |
|---|---|---|
| Efeitos de 38 itens roteirizados e 13 seguráveis, por chave (`metronome`, `leftovers`, `eviolite`…) | `src/game/scripted.js`, `run.js` | os itens do fork usam essas chaves como "efeito" e mudam nome/descrição/ícone nos dados; a carta de item mostra `upgrades[].name` (fase 34; sem ele, a chave por extenso) |
| Habilidades passivas por chave (`blaze`, `torrent`…) | `rules.abilityKits` | mesmos nomes de chave ou kits novos no `rules.json` |
| Reações elementais por tipo e estado | `src/game/combat.js` (`REACTIONS`) | mapear os elementos do fork para as chaves de tipo (ou tornar a tabela dado) |
| Itens da loja (Poção, Doce Raro…) | `src/game/events.js` (`SHOP_ITEMS`) | texto via `PACK.terms`/dicionários |
| Captura (fórmula com `captureRate`/255, "Poké Bola") | `src/game/capture.js`, `rules.capture` | Digivice: mesma fórmula, outro nome |
| Evolução por nível e `evoStage` | `rules.js` (`evolutionPlan`), `run.js` (`tryEvolve`) | Digivolução: os 5 estágios cabem em `evoStage` 0–4; `rules.evolution.levelByStage` (fase 28) fixa o nível de cada estágio — sem ele valem as faixas 16–30 / 36–50 |
| Nome da ultimate | `run.js` (`ultimateName`) | `rules.ultimateBySpecies` (fase 28) dá o nome por espécie; sem ele, nome por tipo |
| Atributos (triângulo Vacina/Data/Vírus) | `rules.js` (`attributeMult`), `run.js` | `species.attribute` + `rules.attributes` { beats, mult } (fase 35); sem a tabela, neutro |
| Texto das regiões | `i18n.js` (`biomeName`/`biomeDesc`) | `biome.pt`/`biome.es` { name, desc } nos dados (fase 35); sem eles, os dicionários da engine por id |
| Nome global dos dados no bundle (`__POKEBONK_DATA__`) | `build.mjs`, `game-data.js`, `sprites.js` | pode ficar; não aparece ao jogador |

## Plano do fork Digimon (resumo)

1. Repositório novo a partir deste; trocar `src/content/pack.js` (prefixo, tipos/atributos, iniciais,
   termos), `src/data/*.json` e `assets/`.
2. Dados: 20 espécies e um bioma para validar; Vacina/Data/Vírus como tipos extras ou na tabela de tipos.
3. Estágios Baby → Rookie → Champion → Ultimate → Mega em `evoStage`, com as faixas de nível como dado.
4. Arte: sprites oficiais de fã-jogo (o mesmo modelo do PokéBonk) ou o gerador procedural de reserva.
