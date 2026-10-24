# Digi Chosen

**Digi Chosen** (formerly *PokéBonk Local*) is a local, self-contained re-implementation of
[PokéBonk](https://pokebonk.com/) — a 3D Pokémon *survivor* roguelite — built from the game's
public data tables and the original **PMD SpriteCollab** sprite sheets (CC BY-NC 4.0), with
**no network calls and no ripped assets** beyond those credited sheets.

> **Fan-game, not affiliated with Nintendo, The Pokémon Company, Creatures Inc. or
> GAME FREAK.** Pokémon names, types and moves are trademarks of their owners.
> This is a local study project.

Status of the code (what was fixed, what was tested, what is still open) lives in
[REVISAO_CODEX.md](REVISAO_CODEX.md); pending work and future ideas in [BACKLOG.md](BACKLOG.md).

---

## Run it

Requirements: **Node.js ≥ 18** (only for the dev server, tests and the build — the game itself
is plain browser JavaScript with no dependencies).

**Option A — local server (recommended while developing):**

```bash
npm start          # or: node server.mjs   (port 8080; `npm run dev` is the same)
# open http://localhost:8080/
```

**Option B — single offline file (no server, works from `file://`):**

```bash
npm run build      # writes dist/digi-chosen.html and copies the sprite sheets next to it
```

Then double-click `dist/digi-chosen.html`. The file embeds the code, the CSS and every data table;
the sprite sheets are read from `dist/pmd/` and `dist/front/`, so keep the `dist/` folder together.
`dist/` is not versioned — rebuild it after pulling changes.

## Tests and checks

```bash
npm test                # node --test tests/*.test.mjs  (no dependencies; real game data + a tiny DOM stub)
npm run check:bundle    # verifies dist/digi-chosen.html parses and matches the current sources
npm run review:codex -- 94acc78..HEAD   # independent review of a commit range by the Codex CLI → reviews/
```

`scripts/codex-review.mjs` checks the range's tip out into a throwaway worktree, runs the tests and the
bundle check here (the Codex sandbox cannot spawn node) and feeds everything to `codex exec` on stdin;
the report lands in `reviews/codex-<timestamp>.md`. `AGENTS.md` holds the rules every agent should follow.

`tests/` covers the regressions listed in `REVISAO_CODEX.md` (first-egg rule, the shared level-up
path used by XP orbs and Rare Candy, the held-item screen, pause submenus, capture/allies, egg
persistence, old saves). `tests/playtest.test.mjs` lets a bot (`tests/_bot.mjs`) play whole runs
through the real input, level-up and event-panel surfaces — an honest 10-minute run, a classic run to
victory and a tower climb — checking invariants (no NaN, HP/XP bounds, arena bounds, enemy cap) every
half second of game time. `scripts/check-bundle.mjs` runs `node --check` on the bundled script and
compares it, the embedded data and the CSS against the sources, so a stale build fails loudly.

Saves live in `localStorage` under the keys `pokebonk-clone.*` — the keys were **kept** on purpose
when the project was renamed, so existing profiles keep loading.

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | Move |
| `Space` | Jump |
| `Shift` | Dash (brief invulnerability) |
| `R` | Ultimate (once charged) |
| `E` | Interact with a nearby chest / shop / altar, or throw a ball at a weakened alpha |
| `P` / `Esc` | Pause (Pokédex, nickname, held item and volume live here) |
| `1` `2` `3` | Choose a level-up card (or buy a shop item while the shop is open) |
| `F` / `X` / `Z` | Reroll / skip / banish a level-up card |

Your Pokémon attacks automatically and turns to face the nearest target. Background music is
synthesized on the fly (no audio files) and pauses with the game; volume is set in the pause menu
and persisted per profile.

## The game

Pick one of the starters, choose a region (biome) and difficulty, and survive the horde. Enemies
drop blue **XP orbs**; level up to pick one of three upgrades — learn a move from your species'
kit, upgrade an equipped move, take an item, a **vitamin** (permanent stat growth), a **move
slot**, or a **fusion** (merges two moves into a dual-type one). Level past the evolution gate to
**evolve**, charge your **ultimate** by fighting, and keep moving: contact damage lands in discrete
hits and the horde scales through the stage. The level cap is 50.

**Items** — 88 stat items, the 18 type items (+3% damage and +30% to moves of that type) and 22 of the
upstream scripted items (Shell Bell, Metronome, Razor Fang, Focus Sash, Revive, Gold Teeth…), each with its
own hook in `src/game/scripted.js`. Scripted items the engine does not model are never offered.

**Game modes**
- **Classic** — three 5-minute zones, each closed by a **zone guardian** picked from the biome's
  own list; the zone only advances once it falls. After zone 3 the run enters the **sanctuary**:
  the horde fades and the biome's **legendary** arrives. Defeat it to win. Boss damage is capped to
  the fight budget and ramps up if a fight stalls.
- **Endless** — hordes and milestones that never stop.
- **Tower** ("The Night of Lavender Tower") — 7 themed floors fought in waves only (no free
  spawns), each closed by a guardian; enemies and guardians scale by the floor's own curve, and
  floor 7's bell summons the lord of the tower.

**Capture & allies** — Weaken an alpha — or a boss: zone guardian, tower guardian, legendary — below
10% HP; it stops fighting for 8 s and you can press `E` to throw a ball (same odds as an alpha; a failed
throw lets it recover to 30% HP). Catching a boss counts as beating it: the zone clears, the floor
advances or the run is won, and it joins the team with a stronger bond. Caught Pokémon join your team
(up to 3, oldest leaves first) as allies that orbit you, auto-attack with their own power and type, and
grant a damage boost.

**Eggs** — The first capture of each run always grants an egg (if none is incubating); later
captures have a 25% chance. Walk to hatch it (200 steps); the hatched species joins the team.
Eggs and their progress are saved in the profile and survive a new run.

**Rare Candy** — From the ground or the shop (100 G): grants exactly one level's worth of XP, so you
go up one level and keep the XP already earned inside the level. Refused (and not charged) at
the cap.

**World events** — Chests, traveling shops and ancient altars appear 12–24 units from you. Press `E`
near one: open the chest for gold or loot, buy items with your gold at the shop (`1`–`3`, `0` leaves),
or heal at the altar. Opening one pauses the game; buying a Rare Candy opens the level-up cards on
top of the shop. Looking is free: a chest is consumed when opened and an altar when it heals; shops
stay until they expire.

**Partners** — The roster shows 40 Kanto species; only the three starters begin unlocked. Catching
(or hatching) any species unlocks the roster partner of its evolution family, and every achievement
or species task completed unlocks the next locked partner in roster order. The title screen counts
them (`Partners: X / 40`).

**Profiles** — Local guest/named profiles (no network). Each keeps its Pokédex (seen / caught),
achievements and species tasks, egg, nickname, held item (Leftovers or Choice Band), best time
and volume. The Pokédex list is the only record of captures: the partner you play is marked
*seen*, captures and hatched eggs are *caught*.

**Achievements & tasks** — 8 achievements (first catch, 10/25 species, 50 seen, 3 shinies, 5 runs,
a win, 3 tower floors) and 5 species tasks (5 captures of a type, one ally evolution). Each pays
gold: to the current run when it unlocks mid-run, otherwise banked in the profile and paid out at
the start of the next run ("Recompensas pendentes"). The pause menu's **Conquistas** screen lists
all of them with progress, reward and pending gold. During a boss fight the HUD shows a boss bar
(name, kind, phase, HP) under the region block.

## Language

The interface is in Brazilian Portuguese (`lang="pt-BR"`): screens, HUD, level-up cards, event panels and
banners. Proper names from the data stay as they are — species, moves, items, abilities, roster roles and
ultimate names. Biome, archetype, vitamin, rarity and tower-floor labels are translated at display time by the
tables in `src/core/i18n.js`, so `src/data/*.json` is untouched and old saves need no migration. There is no
language selector yet.

## Provenance & fidelity

Everything here is a from-scratch reimplementation built from the game's public data tables. The
following were recovered **verbatim**:

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

**Not ported** (intentionally out of scope): online accounts, season/rank, clans, events,
leaderboards.

Honest gap list vs the live game (details and more in `BACKLOG.md`):
- **World events** — shrines, wandering merchants and item-renewal shops are still missing.
- **Dex & progression** — 8 achievements and 5 species tasks exist, but their rewards are not
  granted yet; permanent player names are missing.
- **Held items** — only Leftovers and Choice Band have effects.
- **More content** — the live game's full species/move/upgrade rosters beyond the 40-species league
  roster and 126 upgrades extracted here.

## Code layout

```
index.html, styles.css   dev entry + theme (the build inlines both)
server.mjs               zero-dependency static server
build.mjs                single-file bundler (dist/digi-chosen.html)
scripts/check-bundle.mjs verifies a built bundle against the sources
tests/                   node:test regression suite (+ _helpers.mjs, _dom.mjs)
src/
  main.js             bootstrap + game loop + input
  core/math.js, rng.js
  data/game-data.js   loads tables and builds indexes (buildIndexes is reused by the tests)
  data/sprite-bounds.json per-frame opacity bounds (baked offline, embedded)
  game/rules.js       recovered formulas, MAX_LEVEL, difficulties
  game/run.js         the simulation (player, enemies, projectiles, pickups, the level-up path)
  game/director.js    enemy pool + spawn timeline
  game/boss.js        boss controller (used by the tower)
  game/capture.js     weaken / throw / allies
  game/events.js      world events: chests, shops, altars
  game/achievements.js achievements, species tasks, eggs
  game/tower.js, fusion.js, vitamins.js
  render/creature.js  procedural pixel-art Pokémon (loading fallback)
  render/sprites.js   PMD sheet loader + 8-direction animation renderer
  render/palette.js   colours
  render/renderer.js  canvas world renderer
  ui/…                HUD, screens, level-up panel, Pokédex, local accounts
  audio/sfx.js, music.js  generated sound and music
```

## Data

The `src/data/*.json` files are the extracted PokéBonk tables (trimmed to the
fields the engine uses). The `data/` directory in the repo root (git-ignored) is a working copy
used by the extraction scripts and is not loaded at runtime.
