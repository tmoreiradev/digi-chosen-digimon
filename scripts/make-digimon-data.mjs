// Builds the Digimon content tables in src/data from the definitions below (run: node
// scripts/make-digimon-data.mjs). The tables keep the engine's schema (see the engine's
// docs/PACOTE_DE_CONTEUDO.md): file names, fields and the 18 type keys stay; the Digimon
// elements are mapped onto them in src/content/pack.js. rules.json starts from the engine's and
// only the franchise parts are replaced.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PACK } from "../src/content/pack.js";
import { spriteTables, portraitPalette } from "./nss.mjs";
import { SPECIES, MOVES, ROSTER, ULTIMATES, REGION, REGIONS, LEGENDARY, PASSIVES } from "./digimon-species.mjs";
import { ITEM_NAMES } from "./digimon-items.mjs";

// ids follow the order of SPECIES (the first 31 are fixed); families are the root of each line.
const ID = new Map(SPECIES.map((s, i) => [s[0], i + 1]));
const id = (key) => { const v = ID.get(key); if (!v) throw new Error(`unknown Digimon ${key}`); return v; };
const ROW = new Map(SPECIES.map((s) => [s[0], s]));
const rootOf = (key) => { let k = key; while (ROW.get(k)[7]) k = ROW.get(k)[7]; return k; };
const legendary = new Set(LEGENDARY);

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "src", "data");

// Base stats per stage: Rookie, Champion, Ultimate, Mega (BST ≈ 310 / 420 / 500 / 580).
const STAGE_STATS = [
  { hp: 45, atk: 55, def: 45, spa: 55, spd: 50, spe: 60 },
  { hp: 65, atk: 78, def: 65, spa: 75, spd: 65, spe: 72 },
  { hp: 80, atk: 95, def: 80, spa: 90, spd: 78, spe: 77 },
  { hp: 95, atk: 110, def: 92, spa: 108, spd: 90, spe: 85 },
];
// Leans per role: multipliers on the stage's stats.
const LEAN = {
  physical: { atk: 1.18, spa: 0.85 },
  special: { atk: 0.85, spa: 1.18 },
  tank: { hp: 1.15, def: 1.2, spe: 0.85 },
  fast: { spe: 1.25, def: 0.85 },
};

const round = (v) => Math.max(10, Math.round(v));
function statsFor(stage, lean) {
  const base = { ...STAGE_STATS[stage] };
  for (const [k, m] of Object.entries(LEAN[lean] ?? {})) base[k] = round(base[k] * m);
  return base;
}

const ATTRIBUTES = ["vaccine", "data", "virus", "free"];
const pokemon = SPECIES.map(([key, name, stage, types, lean, color, attribute, from, flavor]) => {
  const stats = statsFor(stage, lean);
  return {
    id: id(key), key, name, types: types.split("/"), stats,
    bst: Object.values(stats).reduce((a, b) => a + b, 0),
    weight: [90, 400, 1200, 1600][stage], height: [5, 14, 30, 34][stage],
    gen: 1, color,
    legendary: legendary.has(key), mythical: false, baby: false,
    captureRate: [120, 60, 25, 5][stage],
    hidden: null,
    evoFrom: from ? id(from) : null, evoLevel: null, evoStage: stage, family: id(rootOf(key)),
    attribute: attribute.toLowerCase(),
    abilities: [ATTRIBUTES.indexOf(attribute.toLowerCase()) + 1],
    flavor: `${attribute}. ${flavor}`,
  };
});

const moves = MOVES.map(([key, name, type, power, cls, , ailment, chance], i) => ({
  id: i + 1, key, name, type, power, accuracy: 100, pp: 20, priority: 0, cls, target: "selected-pokemon",
  ailment, ailmentChance: chance, drain: 0, healing: 0, crit: 0, flinch: 0, minHits: null, maxHits: null, statChance: 0,
}));

const roster = ROSTER.map(({ key, ...r }) => ({ id: id(key), ...r }));
const learnsets = Object.fromEntries(pokemon.map((p) => {
  const roster = rosterOf(p);
  const keys = roster?.kit ?? [];
  return [String(p.id), keys.map((k, i) => [moves.find((m) => m.key === k).id, [1, 4, 8, 12][i]])];
}));

function rosterOf(p) {
  return roster.find((r) => r.id === p.family);
}

const types = JSON.parse(fs.readFileSync(path.join(DATA, "types.json"), "utf8")); // the chart stays
for (const [k, t] of Object.entries(PACK.types)) if (t.en) types.names[k] = t.en; // element names
// The partner card shows a species' first "ability": here its attribute (pt-BR names, translated by lang-en/es).
const abilities = Object.fromEntries(ATTRIBUTES.map((key, i) => [i + 1, { key, name: ["Vacina", "Dados", "Vírus", "Livre"][i], desc: "" }]));
const items = JSON.parse(fs.readFileSync(path.join(DATA, "items.json"), "utf8")); // item effects are engine keys

const rules = JSON.parse(fs.readFileSync(path.join(DATA, "rules.json"), "utf8"));
rules.moveOverrides = Object.fromEntries(MOVES.map((m) => [m[0], m[5]]));
rules.moveSpecial = {};
rules.boostMoves = [];
rules.weatherMoves = {};
rules.trapMoves = [];
rules.roster = roster;
rules.abilityKits = { ...rules.abilityKits, ...PASSIVES }; // the partner lines' own passives
// Balance (playtest of 30/10): a single-target bolt opened Terriermon's runs too slowly (level 7 at 3 min against
// 11-12 for the rest); +3 damage and one pierce put it level with the others.
Object.assign(rules.archetypes.bolt, { dmg: 16, pierce: 1 });
// Vaccine beats Virus, Virus beats Data, Data beats Vaccine; Free is neutral.
rules.attributes = { beats: { vaccine: "virus", virus: "data", data: "vaccine" }, mult: 1.1 }; // 1.2 made the tower (mostly Virus) easy again
// Item names: Digimon names over the engine's keys (effects stay keyed); type boosters by element.
const itemName = (key) => ITEM_NAMES[key] ?? (rules.typeItems[key] ? `${types.names[rules.typeItems[key]]} Plug-in` : null);
for (const u of [...rules.upgrades, ...rules.vitamins]) u.name = itemName(u.key) ?? u.name;
for (const [key, it] of Object.entries(items)) it.name = itemName(key) ?? it.name;
rules.ultimateBySpecies = Object.fromEntries(Object.entries(ULTIMATES).map(([k, v]) => [id(k), v]));
// Rookie → Champion at 12, Ultimate at 26, Mega at 40 (the level cap is 50).
rules.evolution = { levelByStage: { 1: 12, 2: 26, 3: 40 } };
// One region per biome the engine draws: the biome keeps its look (ground, fog, props) and takes the
// region's name, text, wild types and cast. File Island is the forest.
const regionOf = (biome, r) => {
  const look = rules.biomes.find((b) => b.id === biome);
  if (!look) throw new Error(`no ${biome} biome in rules.json to dress as ${r.name}`);
  return {
    ...look,
    name: r.name, desc: r.desc, pt: r.pt, es: r.es,
    types: r.types, late: r.late,
    residents: [...new Set(r.residents.map((k) => id(rootOf(k))))], // families
    guardians: r.guardians.map((zone) => zone.map(id)),
    bosses: r.bosses.map(id),
    legendaries: r.legendaries.map(id),
  };
};
rules.biomes = [
  regionOf("forest", {
    ...REGION,
    name: "File Island",
    desc: "The island where the Chosen Children first landed — and where the Black Gears turned its Digimon wild.",
    types: ["fire", "ice", "electric", "grass", "water", "bug", "normal", "fighting"],
    late: ["dark"],
  }),
  ...REGIONS.map((r) => regionOf(r.biome, r)),
];
// Floors told in Myotismon's castle instead of the Pokémon Tower (only names reach the screen today).
const FLOOR_TEXT = {
  0: { name: "Vestibule", sub: "A Bakemon greets you: \"The castle does not sleep tonight...\"" },
  2: { name: "Mist Room", sub: "A thick fog fills the hall. Something in it is watching you." },
  5: { name: "Wizardmon's Memory", sub: "A fallen friend's spirit lingers here. Light the candles and give it peace." },
};
rules.tower.floors = rules.tower.floors.map((f, i) => ({
  ...f,
  ...FLOOR_TEXT[i],
  pool: (REGION.tower[i] ?? REGION.tower[0]).map(id),
  guardian: { ...f.guardian, id: id(REGION.towerGuardians[i] ?? REGION.towerGuardians.at(-1)) },
}));
// Balance (playtest of 30/10): floor 5's Myotismon as a full boss was a wall (10 of 51 bot runs died there,
// Hawkmon all 3); as a totem the castle still peaks on floors 6–7.
rules.tower.floors[4].guardian.kind = "totem";

// Art under assets/ (NSS portraits and overworld folders, see scripts/nss.mjs); species without
// an overworld folder are drawn by the procedural renderer.
const { sprites, bounds: spriteBounds } = spriteTables(pokemon.map((p) => p.id));
// The procedural map sprite borrows each portrait's colours (species without an animated sheet).
for (const p of pokemon) {
  if (sprites[p.id]?.portrait && !sprites[p.id].anims) p.palette = portraitPalette(path.join(ROOT, "assets", sprites[p.id].portrait));
}

const out = { pokemon, moves, learnsets, abilities, types, items, rules, sprites, "sprite-bounds": spriteBounds };
for (const [name, table] of Object.entries(out)) {
  fs.writeFileSync(path.join(DATA, `${name}.json`), JSON.stringify(table));
}
console.log(`src/data: ${pokemon.length} Digimon, ${moves.length} attacks, ${roster.length} partners, ${rules.biomes.length} regions`);
