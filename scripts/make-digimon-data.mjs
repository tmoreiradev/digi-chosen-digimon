// Builds the Digimon content tables in src/data from the definitions below (run: node
// scripts/make-digimon-data.mjs). The tables keep the engine's schema (see the engine's
// docs/PACOTE_DE_CONTEUDO.md): file names, fields and the 18 type keys stay; the Digimon
// elements are mapped onto them in src/content/pack.js. rules.json starts from the engine's and
// only the franchise parts are replaced.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PACK } from "../src/content/pack.js";
import { spriteTables } from "./nss.mjs";

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

// id, key, name, stage (0 Rookie … 3 Mega), types (engine keys), lean, colour, evoFrom, family,
// attribute (Vaccine / Data / Virus, shown in the flavour), flavour.
const SPECIES = [
  [1, "agumon", "Agumon", 0, ["fire"], "physical", "yellow", null, 1, "Vaccine", "A small reptile Digimon that walks on two legs. Spits Pepper Breath fireballs."],
  [2, "greymon", "Greymon", 1, ["fire", "dragon"], "physical", "yellow", 1, 1, "Vaccine", "A dinosaur Digimon with a skull-like helmet; its Nova Blast melts everything."],
  [3, "metalgreymon", "MetalGreymon", 2, ["fire", "steel"], "physical", "yellow", 2, 1, "Vaccine", "Half of its body is machine; it fires the Giga Destroyer from its chest."],
  [4, "wargreymon", "WarGreymon", 3, ["fire", "dragon"], "physical", "yellow", 3, 1, "Vaccine", "Clad in Chrome Digizoid armour, it gathers energy into the Gaia Force."],
  [5, "gabumon", "Gabumon", 0, ["ice"], "special", "blue", null, 5, "Data", "A shy reptile Digimon wearing a fur pelt. Attacks with Blue Blaster."],
  [6, "garurumon", "Garurumon", 1, ["ice"], "fast", "blue", 5, 5, "Vaccine", "A wolf Digimon of the frozen north; its Howling Blaster freezes foes."],
  [7, "weregarurumon", "WereGarurumon", 2, ["ice", "fighting"], "physical", "blue", 6, 5, "Vaccine", "A beast-man Digimon that strikes with the Wolf Claw."],
  [8, "metalgarurumon", "MetalGarurumon", 3, ["ice", "steel"], "special", "blue", 7, 5, "Data", "A mechanical wolf bristling with missiles; its Cocytus Breath stops time."],
  [9, "patamon", "Patamon", 0, ["fairy", "flying"], "special", "brown", null, 9, "Data", "A small mammal Digimon that flies with its ear-wings and shoots Boom Bubble."],
  [10, "angemon", "Angemon", 1, ["fairy", "flying"], "special", "white", 9, 9, "Vaccine", "An angel Digimon whose Hand of Fate purifies evil."],
  [11, "magnaangemon", "MagnaAngemon", 2, ["fairy", "flying"], "special", "purple", 10, 9, "Vaccine", "An archangel Digimon that opens the Gate of Destiny."],
  [12, "seraphimon", "Seraphimon", 3, ["fairy", "flying"], "special", "white", 11, 9, "Vaccine", "A seraph Digimon; Seven Heavens calls down seven spheres of light."],
  [13, "tentomon", "Tentomon", 0, ["electric", "bug"], "special", "red", null, 13, "Vaccine", "An insect Digimon that discharges a Super Shocker."],
  [14, "kabuterimon", "Kabuterimon", 1, ["electric", "bug"], "tank", "blue", 13, 13, "Vaccine", "A giant beetle Digimon that charges its Electro Shocker."],
  [15, "palmon", "Palmon", 0, ["grass"], "special", "green", null, 15, "Data", "A plant Digimon whose Poison Ivy vines bind enemies."],
  [16, "togemon", "Togemon", 1, ["grass"], "tank", "green", 15, 15, "Data", "A cactus Digimon that throws a Needle Spray."],
  [17, "gomamon", "Gomamon", 0, ["water"], "fast", "white", null, 17, "Vaccine", "A sea-mammal Digimon that summons fish with Marching Fishes."],
  [18, "ikkakumon", "Ikkakumon", 1, ["water", "ice"], "tank", "white", 17, 17, "Vaccine", "A walrus Digimon that fires its horn as a Harpoon Torpedo."],
  [19, "kunemon", "Kunemon", 0, ["bug", "electric"], "fast", "yellow", null, 19, "Virus", "A larva Digimon that spits an Electric Thread."],
  [20, "goblimon", "Goblimon", 0, ["normal", "fire"], "physical", "green", null, 20, "Virus", "A goblin Digimon that hurls a Goblin Strike fireball."],
  [21, "leomon", "Leomon", 1, ["fighting"], "physical", "yellow", null, 21, "Vaccine", "A lion-warrior Digimon; the Fist of the Beast King is its pride."],
  [22, "devimon", "Devimon", 1, ["dark", "ghost"], "special", "black", null, 22, "Virus", "A fallen-angel Digimon that ruled File Island through the Black Gears."],
  [23, "guilmon", "Guilmon", 0, ["fire", "dragon"], "physical", "red", null, 23, "Virus", "A reptile Digimon born from a boy's drawing; it fires the Pyro Sphere."],
  [24, "growlmon", "Growlmon", 1, ["fire", "dragon"], "physical", "red", 23, 23, "Virus", "A dinosaur Digimon whose Pyro Blaster scorches the ground."],
  [25, "wargrowlmon", "WarGrowlmon", 2, ["fire", "steel"], "physical", "red", 24, 23, "Virus", "A cyborg Digimon; its Atomic Blaster fires from its chest cannons."],
  [26, "gallantmon", "Gallantmon", 3, ["fire", "fairy"], "physical", "white", 25, 23, "Virus", "A Royal Knight with the lance Gram and the shield Aegis."],
  [27, "salamon", "Salamon", 0, ["fairy"], "special", "white", null, 27, "Vaccine", "A puppy Digimon whose Puppy Howl puts enemies to sleep."],
  [28, "gatomon", "Gatomon", 1, ["fairy"], "fast", "white", 27, 27, "Vaccine", "A cat Digimon with the Holy Ring; strikes with the Lightning Paw."],
  [29, "angewomon", "Angewomon", 2, ["fairy", "flying"], "special", "white", 28, 27, "Vaccine", "An archangel Digimon who looses the Celestial Arrow."],
  [30, "magnadramon", "Magnadramon", 3, ["fairy", "dragon"], "special", "pink", 29, 27, "Vaccine", "A holy dragon, one of the Four Great Dragons; breathes the Fire Tornado."],
  [31, "gigimon", "Gigimon", 0, ["fire"], "fast", "red", null, 31, "Virus", "An In-Training Digimon, small and restless, that spits a Hot Bubble."],
];

// key, name, type, power, class, archetype (rules.moveOverrides), ailment, chance.
const MOVES = [
  ["pepper-breath", "Pepper Breath", "fire", 45, "special", "orb", "burn", 15],
  ["claw-attack", "Claw Attack", "normal", 40, "physical", "strike", null, 0],
  ["nova-blast", "Nova Blast", "fire", 75, "special", "lob", "burn", 20],
  ["great-horns", "Great Horns Attack", "dragon", 70, "physical", "dash", null, 0],
  ["giga-destroyer", "Giga Destroyer", "steel", 90, "special", "homing", null, 0],
  ["trident-arm", "Trident Arm", "steel", 80, "physical", "strike", null, 0],
  ["terra-force", "Terra Force", "fire", 110, "special", "meteor", "burn", 20],
  ["great-tornado", "Great Tornado", "dragon", 95, "physical", "spin", null, 0],
  ["blue-blaster", "Blue Blaster", "ice", 45, "special", "bolt", "freeze", 10],
  ["horn-attack", "Little Horn", "normal", 40, "physical", "strike", null, 0],
  ["howling-blaster", "Howling Blaster", "ice", 75, "special", "cone", "freeze", 20],
  ["wolf-claw", "Wolf Claw", "fighting", 85, "physical", "strike", "knock", 15],
  ["cocytus-breath", "Cocytus Breath", "ice", 105, "special", "beam", "freeze", 25],
  ["garuru-tomahawk", "Garuru Tomahawk", "steel", 95, "special", "homing", null, 0],
  ["boom-bubble", "Boom Bubble", "flying", 45, "special", "orb", "knock", 15],
  ["spiral-twister", "Spiral Twister", "flying", 50, "special", "boomerang", null, 0],
  ["hand-of-fate", "Hand of Fate", "fairy", 80, "special", "beam", "charm", 15],
  ["gate-of-destiny", "Gate of Destiny", "fairy", 95, "special", "vortex", "charm", 20],
  ["excalibur", "Excalibur", "fairy", 85, "physical", "strike", null, 0],
  ["seven-heavens", "Seven Heavens", "fairy", 110, "special", "orbit", "charm", 20],
  ["super-shocker", "Super Shocker", "electric", 45, "special", "chain", "paralysis", 15],
  ["electro-shocker", "Electro Shocker", "electric", 75, "special", "orb", "paralysis", 20],
  ["poison-ivy", "Poison Ivy", "grass", 45, "physical", "strike", "root", 20],
  ["needle-spray", "Needle Spray", "grass", 70, "special", "barrage", "root", 15],
  ["marching-fishes", "Marching Fishes", "water", 45, "special", "wave", "wet", 25],
  ["harpoon-torpedo", "Harpoon Torpedo", "water", 75, "special", "homing", "wet", 25],
  ["electric-thread", "Electric Thread", "bug", 40, "special", "bolt", "paralysis", 20],
  ["goblin-strike", "Goblin Strike", "fire", 45, "special", "orb", "burn", 10],
  ["beast-king-fist", "Fist of the Beast King", "fighting", 80, "special", "orb", "knock", 20],
  ["death-claw", "Death Claw", "dark", 80, "special", "smite", "healblock", 20],
  ["pyro-sphere", "Pyro Sphere", "fire", 45, "special", "orb", "burn", 15],
  ["rock-breaker", "Rock Breaker", "dragon", 45, "physical", "strike", null, 0],
  ["pyro-blaster", "Pyro Blaster", "fire", 75, "special", "beam", "burn", 20],
  ["atomic-blaster", "Atomic Blaster", "steel", 95, "special", "beam", null, 0],
  ["royal-saber", "Royal Saber", "fairy", 110, "physical", "dash", "charm", 15],
  ["puppy-howl", "Puppy Howl", "fairy", 40, "special", "nova", "sleep", 25],
  ["lightning-paw", "Lightning Paw", "fighting", 70, "physical", "strike", "stun", 15],
  ["celestial-arrow", "Celestial Arrow", "fairy", 90, "special", "bolt", "charm", 20],
  ["fire-tornado", "Fire Tornado", "fire", 110, "special", "vortex", "burn", 25],
  ["hot-bubble", "Hot Bubble", "fire", 35, "special", "orb", "burn", 10],
];

// Playable partners (roster): the starters and the File Island Rookies the player can unlock.
const ROSTER = [
  { id: 1, role: "Blaze Assault", passive: "blaze", kit: ["pepper-breath", "claw-attack", "nova-blast", "terra-force"], rank: "common", start: true },
  { id: 5, role: "Frost Sniper", passive: "keen-eye", kit: ["blue-blaster", "horn-attack", "howling-blaster", "cocytus-breath"], rank: "common", start: true },
  { id: 9, role: "Holy Support", passive: "levitate", kit: ["boom-bubble", "spiral-twister", "hand-of-fate", "seven-heavens"], rank: "common", start: true },
  { id: 13, role: "Storm Caller", passive: "swarm", kit: ["super-shocker", "electric-thread", "electro-shocker", "claw-attack"], rank: "uncommon" },
  { id: 15, role: "Bramble Healer", passive: "photosynthesis", kit: ["poison-ivy", "needle-spray", "claw-attack", "boom-bubble"], rank: "uncommon" },
  { id: 17, role: "Tide Rider", passive: "torrent", kit: ["marching-fishes", "harpoon-torpedo", "horn-attack", "blue-blaster"], rank: "uncommon" },
  { id: 23, role: "Wild Tamer", passive: "blaze", kit: ["pyro-sphere", "rock-breaker", "pyro-blaster", "royal-saber"], rank: "common", start: true },
  { id: 27, role: "Holy Light", passive: "levitate", kit: ["puppy-howl", "lightning-paw", "celestial-arrow", "fire-tornado"], rank: "common", start: true },
];

// The ultimate of each species, named after its signature attack.
const ULTIMATES = {
  1: "Baby Burner", 2: "Mega Flame", 3: "Giga Destroyer", 4: "Gaia Force",
  5: "Blue Blaster", 6: "Fox Fire", 7: "Garuru Kick", 8: "Cocytus Breath",
  9: "Boom Bubble", 10: "Heaven's Knuckle", 11: "Gate of Destiny", 12: "Seven Heavens",
  13: "Super Shocker", 14: "Mega Blaster", 15: "Poison Ivy", 16: "Needle Spray",
  17: "Marching Fishes", 18: "Harpoon Torpedo", 21: "Fist of the Beast King", 22: "Touch of Evil",
  23: "Pyro Sphere", 24: "Pyro Blaster", 25: "Atomic Blaster", 26: "Royal Saber",
  27: "Puppy Howl", 28: "Lightning Paw", 29: "Celestial Arrow", 30: "Fire Tornado", 31: "Hot Bubble",
};

const round = (v) => Math.max(10, Math.round(v));
function statsFor(stage, lean) {
  const base = { ...STAGE_STATS[stage] };
  for (const [k, m] of Object.entries(LEAN[lean] ?? {})) base[k] = round(base[k] * m);
  return base;
}

const pokemon = SPECIES.map(([id, key, name, stage, types, lean, color, evoFrom, family, attribute, flavor]) => {
  const stats = statsFor(stage, lean);
  return {
    id, key, name, types, stats,
    bst: Object.values(stats).reduce((a, b) => a + b, 0),
    weight: [90, 400, 1200, 1600][stage], height: [5, 14, 30, 34][stage],
    gen: 1, color,
    legendary: id === 22, mythical: false, baby: false,
    captureRate: [120, 60, 25, 5][stage],
    abilities: [1], hidden: null,
    evoFrom, evoLevel: null, evoStage: stage, family,
    flavor: `${attribute}. ${flavor}`,
  };
});

const moves = MOVES.map(([key, name, type, power, cls, , ailment, chance], i) => ({
  id: i + 1, key, name, type, power, accuracy: 100, pp: 20, priority: 0, cls, target: "selected-pokemon",
  ailment, ailmentChance: chance, drain: 0, healing: 0, crit: 0, flinch: 0, minHits: null, maxHits: null, statChance: 0,
}));

const learnsets = Object.fromEntries(pokemon.map((p) => {
  const roster = ROSTER.find((r) => r.id === p.family);
  const keys = roster?.kit ?? [];
  return [String(p.id), keys.map((k, i) => [moves.find((m) => m.key === k).id, [1, 4, 8, 12][i]])];
}));

const types = JSON.parse(fs.readFileSync(path.join(DATA, "types.json"), "utf8")); // the chart stays
for (const [k, t] of Object.entries(PACK.types)) if (t.en) types.names[k] = t.en; // element names
const abilities = { 1: { key: "digicore", name: "Digicore", desc: "A Digimon's data core." } };
const items = JSON.parse(fs.readFileSync(path.join(DATA, "items.json"), "utf8")); // item effects are engine keys

const rules = JSON.parse(fs.readFileSync(path.join(DATA, "rules.json"), "utf8"));
rules.moveOverrides = Object.fromEntries(MOVES.map((m) => [m[0], m[5]]));
rules.moveSpecial = {};
rules.boostMoves = [];
rules.weatherMoves = {};
rules.trapMoves = [];
rules.roster = ROSTER;
rules.ultimateBySpecies = ULTIMATES;
// Rookie → Champion at 12, Ultimate at 26, Mega at 40 (the level cap is 50).
rules.evolution = { levelByStage: { 1: 12, 2: 26, 3: 40 } };
const forest = rules.biomes.find((b) => b.id === "forest");
rules.biomes = [{
  ...forest,
  name: "File Island",
  desc: "The island where the Chosen Children first landed — and where the Black Gears turned its Digimon wild.",
  types: ["fire", "ice", "electric", "grass", "water", "bug", "normal", "fighting"],
  late: ["dark"],
  residents: [13, 15, 17, 19, 20, 31],
  guardians: [[14, 16], [18, 21], [2, 6]],
  bosses: [14, 18, 2],
  legendaries: [22],
}];
rules.tower.floors = rules.tower.floors.map((f, i) => ({
  ...f,
  pool: [[19, 20], [19, 20, 13], [13, 15, 17], [15, 17, 20], [14, 16], [16, 18], [18, 21]][i] ?? [19, 20],
  guardian: { ...f.guardian, id: [14, 16, 18, 21, 2, 6, 22][i] ?? 22 },
}));

// Art under assets/ (NSS portraits and overworld folders, see scripts/nss.mjs); species without
// an overworld folder are drawn by the procedural renderer.
const { sprites, bounds: spriteBounds } = spriteTables();

const out = { pokemon, moves, learnsets, abilities, types, items, rules, sprites, "sprite-bounds": spriteBounds };
for (const [name, table] of Object.entries(out)) {
  fs.writeFileSync(path.join(DATA, `${name}.json`), JSON.stringify(table));
}
console.log(`src/data: ${pokemon.length} Digimon, ${moves.length} attacks, ${ROSTER.length} partners, 1 region`);
