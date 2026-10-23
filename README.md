# PokéBonk Local

A local, self-contained re-implementation of [PokéBonk](https://pokebonk.com/) — a
3D Pokémon *survivor* roguelite — built from the game's public data tables and the
original **PMD SpriteCollab** sprite sheets (CC BY-NC 4.0), with **no network calls
and no ripped assets** beyond those credited sheets.

> **Fan-game, not affiliated with Nintendo, The Pokémon Company, Creatures Inc. or
> GAME FREAK.** Pokémon names, types and moves are trademarks of their owners.
> This is a local study project.

---

## Play

**Option A — served (recommended during development):**

```bash
npm start          # or: node server.mjs
# open http://localhost:8080/
```

**Option B — single file (no server):**

`dist/pokebonk-local.html` is fully self-contained (data + code inlined). Just
double-click it, or rebuild after changes with:

```bash
npm run build
```

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | Move |
| `Space` | Jump |
| `Shift` | Dash (brief invulnerability) |
| `R` | Ultimate (once charged) |
| `P` / `Esc` | Pause |
| `1` `2` `3` | Choose a level-up card |
| `F` / `X` / `Z` | Reroll / skip / banish a level-up card |

Your Pokémon attacks automatically and turns to face the nearest target. Background music is synthesized on the fly (no audio files) and fades between menu and gameplay; volume is set in the pause menu.

## The game

Pick one of the starters, choose a region (biome) and difficulty, and survive the
horde. Enemies drop blue **XP orbs**; level up to pick one of three upgrades —
learn a move from your species' kit, upgrade an equipped move, take an item, a
**vitamin** (permanent stat growth), a **move slot**, or a **fusion** (merges two
moves into a dual-type one). Level past the evolution gate to **evolve**, charge
your **ultimate** by fighting, and keep moving: contact damage lands in discrete
hits and the horde scales through the stage.

**Game modes**
- **Classic** — 3 zones, then a final challenge.
- **Endless** — hordes and milestones that never stop.
- **Tower** ("The Night of Lavender Tower") — 7 themed floors, each with waves
  closed by a guardian; floor 7's bell summons the lord of the tower.

**Capture & allies** — Weaken an alpha/boss below 10% HP, then press `E` to throw
a ball. Caught Pokémon join your team as allies that orbit you, auto-attack, and
grant a damage boost of their primary type.

**Vitamins** — Permanent stat growth (Protein, Calcium, Carbos, HP Up, …) that you
can pick on level-up; each pick banks a rarity-scaled bonus. Loaded Dice rolls a
random bonus vitamin.

**World events** — Chests, traveling shops and ancient altars spawn randomly in
the world. When you're near one, press `E` to interact: open a chest for gold and
loot, buy items with your gold at the shop, or heal at the altar. Events despawn
after a while and are consumed once used.

## Provenance & fidelity

Everything here is a from-scratch reimplementation built from the game's public
data tables. The following were recovered **verbatim**:

- Data tables (`pokemon.json`, `moves.json`, `learnsets.json`, `abilities.json`,
  `types.json`, `items.json`, `i18n/*`) — downloaded from `pokebonk.com/data/`.
- The league roster (40 playable species: `id`, role, passive ability, 4-move kit,
  rank) and kit unlock levels `[0, 2, 4, 7]`.
- 126 upgrade entries (18 type-boost items + stat items) with rarity weights and
  the exact rarity-roll curve (`Zv`).
- 26 move archetypes and the archetype-resolution precedence (`Yh` overrides →
  regex heuristics → type defaults), plus move stat overrides.
- The base-stat formula `Cg`: `maxHp = round((70 + 45·a(hp))·(1 + (lv-1)·0.12))`,
  `armor = 6·a(def) + 3·a(spd)`, `moveSpeed = 0.92 + 0.12·a(spe)`, etc., where
  `a(v) = 6·v/Σbase`.
- Type effectiveness curve (×2 → 1.35, ×½ → 0.5, ×¼ → 0.8, clamped `[0.4, 1.8]`).
- Enemy scaling: `hpCurve(stage, minutes)`, `toughness(effTime)`, per-tier HP /
  damage / XP multipliers (Elite ×4.5, Alpha ×22, Boss ×70, …), the enemy flag
  enum, and discrete contact damage with the armour curve `1 − armor/(armor+45)`.
- XP curve `xp(level) = round(8 + 5.5·level + level^1.8)` and the day/night clock
  (1 real second = 1 in-game minute).

**Sprite art** — Creatures are drawn from the original Pokémon Mystery Dungeon
sheets (PMD SpriteCollab, CC BY-NC 4.0), the same source the game credits: one
sheet per species with 8 direction rows and per-frame durations, precomputed
per-frame opacity bounds baked into `src/data/sprite-bounds.json` so feet anchor
to their shadows even on `file://`. 971 species have animated sheets; the
remaining 54 fall back to static front sprites. A fully procedural pixel-art
renderer (`render/creature.js`) is kept as a loading/offline fallback.

**Not ported** (intentionally out of scope): online accounts,
season/rank, clans, events, leaderboards. Everything else observed upstream is
recreated locally: tower mode, boss mechanics, capture & allies, vitamins, fusion,
local accounts and sprite art.

Honest gap list vs the live game (what would round out a full version):
- **World events** — chests, shops and altars now spawn in the world and can be interacted with by pressing `E` when nearby. Shrines, wandering merchants and item-renewal shops are still missing.
- **Dex & progressão** — Pokédex com rastreamento de espécies vistas e capturadas, filtro por visto/capturado/não visto, busca por nome e tela dedicada acessível pela pausa. Tarefas por espécie, conquistas e chocagem de ovos ainda faltam.
- **Shinies & cosmetics** — selvagens, jogadores e aliados podem nascer shiny (taxa ~1/256) com dourado translúcido e estrela no HUD. Nomes de jogador, itens segurados e outras cosméticos ainda faltam.
- **More content** — the live game's full species/move/upgrade rosters beyond the
  40-species league roster and 126 upgrades extracted here.

## Code layout

```
src/
  main.js             bootstrap + game loop
  core/math.js, rng.js
  data/game-data.js   loads tables and builds indexes
  data/sprite-bounds.json per-frame opacity bounds (baked offline, embedded)
  game/rules.js       recovered formulas
  game/run.js         the simulation (player, enemies, projectiles, pickups)
  game/director.js    enemy pool + spawn timeline
  game/events.js      world events: chests, shops, altars
  render/creature.js  procedural pixel-art Pokémon (loading fallback)
  render/sprites.js   PMD sheet loader + 8-direction animation renderer
  render/palette.js   colours
  render/renderer.js  canvas world renderer
  ui/…                HUD, screens, level-up panel, Pokédex
  audio/sfx.js        generated sound
```

## Data

The `src/data/*.json` files are the extracted PokéBonk tables (trimmed to the
fields the engine uses). The `data/` directory in the repo root is a working copy
used by the extraction scripts and is not loaded at runtime.
