// Loads the extracted PokéBonk data tables and builds the indexes the engine needs.
//
// The single-file build embeds the tables in `globalThis.__POKEBONK_DATA__`; the
// dev server fetches them as JSON.

import { hashString } from "../core/rng.js";

const BASE = new URL("../data/", import.meta.url);

async function loadJson(name) {
  const res = await fetch(new URL(name, BASE));
  if (!res.ok) throw new Error(`Failed to load ${name}: HTTP ${res.status}`);
  return res.json();
}

export async function loadGameData() {
  const embedded = globalThis.__POKEBONK_DATA__;
  const [pokemon, moves, learnsets, abilities, types, items, rules, sprites, spriteBounds] = embedded
    ? [
        embedded.pokemon,
        embedded.moves,
        embedded.learnsets,
        embedded.abilities,
        embedded.types,
        embedded.items,
        embedded.rules,
        embedded.sprites,
        embedded["sprite-bounds"],
      ]
    : await Promise.all([
        loadJson("pokemon.json"),
        loadJson("moves.json"),
        loadJson("learnsets.json"),
        loadJson("abilities.json"),
        loadJson("types.json"),
        loadJson("items.json"),
        loadJson("rules.json"),
        loadJson("sprites.json"),
        loadJson("sprite-bounds.json"),
      ]);

  return buildIndexes({ pokemon, moves, learnsets, abilities, types, items, rules, sprites, spriteBounds });
}

export function buildIndexes({ pokemon, moves, learnsets, abilities, types, items, rules, sprites, spriteBounds }) {
  const byId = new Map();
  const byKey = new Map();
  for (const p of pokemon) {
    byId.set(p.id, p);
    byKey.set(p.key, p);
  }

  const movesById = new Map();
  const movesByKey = new Map();
  for (const m of moves) {
    movesById.set(m.id, m);
    movesByKey.set(m.key, m);
  }

  // Evolution chains: parent -> children, preserving order.
  const evolutions = new Map();
  for (const p of pokemon) {
    if (p.evoFrom == null) continue;
    if (!evolutions.has(p.evoFrom)) evolutions.set(p.evoFrom, []);
    evolutions.get(p.evoFrom).push(p);
  }

  const rosterById = new Map(rules.roster.map((r) => [r.id, r]));

  const data = {
    pokemon,
    byId,
    byKey,
    moves,
    movesById,
    movesByKey,
    learnsets,
    abilities,
    types,
    items,
    rules,
    sprites,
    spriteBounds,
    evolutions,
    rosterById,

    get: (id) => byId.get(id),
    getMove: (id) => movesById.get(id),
    getMoveByKey: (key) => movesByKey.get(key),

    /** Root of an evolution line (the earliest ancestor that still exists). */
    root(id) {
      let p = byId.get(id);
      const guard = new Set();
      while (p && p.evoFrom != null && byId.has(p.evoFrom) && !guard.has(p.id)) {
        guard.add(p.id);
        p = byId.get(p.evoFrom);
      }
      return p;
    },

    /** Children of a species that can be reached by evolution. */
    evolutionsOf(id) {
      return evolutions.get(id) ?? [];
    },

    /** Roster entry (playable kit) for a species, falling back to its root. */
    rosterFor(id) {
      const direct = rosterById.get(id);
      if (direct) return direct;
      const root = this.root(id);
      return root ? rosterById.get(root.id) : undefined;
    },

    /** Species that can be played, ordered by national id. */
    playable() {
      return rules.roster.map((r) => byId.get(r.id)).filter(Boolean);
    },

    /** Deterministic seed used to draw a species' procedural sprite. */
    speciesSeed(id) {
      return hashString(String(id));
    },
  };

  return data;
}
