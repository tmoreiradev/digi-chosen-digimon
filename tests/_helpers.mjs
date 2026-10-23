// Shared test helpers: real data tables, a real Run, a fake profile.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndexes } from "../src/data/game-data.js";
import { Run } from "../src/game/run.js";
import { DIFFICULTIES } from "../src/game/rules.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", name), "utf8"));

let cached = null;
/** The real game tables, indexed exactly like the browser does it. */
export function loadData() {
  if (!cached) {
    cached = buildIndexes({
      pokemon: readJson("pokemon.json"),
      moves: readJson("moves.json"),
      learnsets: readJson("learnsets.json"),
      abilities: readJson("abilities.json"),
      types: readJson("types.json"),
      items: readJson("items.json"),
      rules: readJson("rules.json"),
      sprites: readJson("sprites.json"),
      spriteBounds: readJson("sprite-bounds.json"),
    });
  }
  return cached;
}

/** A profile shaped like the `progress` object of account.js, counting saves instead of touching localStorage. */
export function fakeProfile(progress = {}) {
  const data = {
    unlocked: [1, 4, 7],
    caught: [],
    pokedex: { seen: [], caught: [] },
    nickname: null,
    heldItem: null,
    best: 0,
    bestFloor: 0,
    runs: 0,
    wins: 0,
    settings: { volume: 0.5 },
    ...progress,
  };
  return {
    data,
    saves: 0,
    save() {
      this.saves++;
    },
  };
}

export function fakeInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    dash: false,
    dashPressed: false,
    ult: false,
    ultPressed: false,
    capture: false,
    capturePressed: false,
  };
}

/** A real Run (Bulbasaur, forest, normal, classic) with recording callbacks. */
export function makeRun({ profile = fakeProfile(), speciesId = 1, mode = "classic", opts = {} } = {}) {
  const data = loadData();
  const input = fakeInput();
  const calls = { levelUps: 0, banners: [], caught: [] };
  const run = new Run(data, {
    speciesId,
    biomeId: "forest",
    difficulty: DIFFICULTIES[0],
    mode,
    input,
    profile,
    seed: 42,
    onLevelUp: () => calls.levelUps++,
    onBanner: (text) => calls.banners.push(text),
    onCaught: (name) => calls.caught.push(name),
    ...opts,
  });
  return { run, profile, input, calls, data };
}

/** Run `fn` with Math.random pinned to `value`. */
export function withRandom(value, fn) {
  const orig = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

/** Spawn an alpha next to the player (the capture flow only accepts alphas and bosses). */
export function spawnAlpha(run, speciesId = 16) {
  const p = run.player;
  const e = run.spawnEnemy(speciesId, p.x + 1, p.z, "alpha");
  if (!e) throw new Error("spawnEnemy returned null");
  return e;
}
