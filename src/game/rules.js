// Gameplay formulas, ported from the analysed PokéBonk build (see README "Provenance").

import { clamp, lerp } from "../core/math.js";

/* ------------------------------------------------------------------ types */

export const TYPE_COLORS = {
  normal: 0xc8d0dc,
  fighting: 0xe0a020,
  flying: 0x6ac8ff,
  poison: 0xb560e0,
  ground: 0xd8b070,
  rock: 0xb0a060,
  bug: 0x8ac020,
  ghost: 0x7a68b0,
  steel: 0xa0b0c0,
  fire: 0xff7a2a,
  water: 0x3aa0ff,
  grass: 0x5ad24a,
  electric: 0xffd030,
  psychic: 0xff7fa0,
  ice: 0x80d8f0,
  dragon: 0x9060e0,
  dark: 0x706090,
  fairy: 0xf090c0,
};

export const typeColor = (t) => TYPE_COLORS[t] ?? 0xcccccc;

/**
 * Type effectiveness, matching the upstream curve:
 * x2 -> 1.35, x0.5 -> 0.5, x0.25 -> 0.8, clamped to [0.4, 1.8].
 * `types` is the { order, names, chart } table.
 */
export function effectiveness(types, type, targetTypes) {
  if (!types?.chart) return 1;
  const order = types.order;
  const attacker = order.indexOf(type);
  if (attacker < 0) return 1;
  let mult = 1;
  for (const t of targetTypes) {
    const defender = order.indexOf(t);
    if (defender < 0) continue;
    const v = types.chart[attacker][defender];
    mult *= v >= 2 ? 1.35 : v === 0 ? 0.5 : v <= 0.5 ? 0.8 : 1;
  }
  return clamp(mult, 0.4, 1.8);
}

/* ------------------------------------------------------- move archetypes */

const ARCHETYPE_REGEXES = [
  [/beam|laser|cannon|ray$/, "beam"],
  [/punch|claw|slash|fang|bite|kick|chop|cut|tail|horn|jab|hammer|smash|strike|blade|edge$/, "strike"],
  [/quake|wave$|burst|eruption|explosion|blast$/, "nova"],
  [/breath|wind$|powder|spray/, "cone"],
  [/meteor|comet|star|fall/, "meteor"],
  [/storm|tornado|spin$|whirl|vortex|tomb/, "vortex"],
  [/bomb/, "lob"],
  [/ball|orb|sphere|pulse/, "orb"],
  [/rush|charge|tackle|dash|impact|crash|ram|slam/, "dash"],
  [/spike|trap|mine/, "trap"],
  [/thunder|bolt|lightning/, "chain"],
  [/drain|leech|absorb/, "drain"],
  [/rang|boomerang|disc/, "boomerang"],
];

const STATUS_FROM_AILMENT = {
  burn: "burn",
  poison: "poison",
  paralysis: "paralysis",
  freeze: "freeze",
  sleep: "sleep",
  yawn: "sleep",
  confusion: "confusion",
  trap: "root",
  "leech-seed": "root",
  "heal-block": "healblock",
  embargo: "healblock",
  infatuation: "charm",
  nightmare: "curse",
};

export function statusForAilment(ailment) {
  return STATUS_FROM_AILMENT[ailment] ?? null;
}

/** Resolve the behavioural archetype of a move, using the upstream precedence. */
export function resolveArchetype(move, rules) {
  if (move.cls === "status") {
    if (rules.weatherMoves[move.key]) return "weather";
    if (rules.boostMoves.includes(move.key)) return "buff";
    if (rules.trapMoves.includes(move.key)) return "trap";
    return rules.moveOverrides[move.key] ?? null;
  }
  if (rules.moveOverrides[move.key]) return rules.moveOverrides[move.key];

  const power = move.power ?? 0;
  if (power <= 0 && !move.key.includes("drain") && move.cls === "physical") return "strike";
  if (move.drain > 0) return "drain";
  if ((move.maxHits ?? 1) >= 2) return "barrage";
  for (const [re, arch] of ARCHETYPE_REGEXES) if (re.test(move.key)) return arch;
  if (move.accuracy == null && move.cls === "special") return "homing";
  const fallback = rules.typeArchetypes[move.type] ?? ["strike", "bolt"];
  return move.cls === "physical" ? fallback[0] : fallback[1];
}

/**
 * Build the runtime definition of a move: base damage, cadence, shape and rider effects.
 * Mirrors the upstream `ng()` builder.
 */
export function buildMoveDef(move, rules) {
  const arch = resolveArchetype(move, rules);
  if (!arch) return null;
  const a = rules.archetypes[arch];
  if (!a) return null;

  const power = move.power ?? 70;
  const dmgScale = clamp(0.72 + power / 260, 0.85, 1.3);
  const cdScale = clamp(0.88 + (power - 60) / 500, 0.85, 1.15) * (move.priority > 0 ? 0.85 : 1);

  let status = statusForAilment(move.ailment);
  let statusChance = status
    ? clamp(((move.ailmentChance || 30) / 100) * 1.6, 0.15, 0.8)
    : 0;
  if (!status) {
    status = rules.statusByType[move.type] ?? null;
    statusChance = 0.12;
  }
  if (move.cls === "status") statusChance = 0.8;

  const def = {
    id: move.id,
    key: move.key,
    name: move.name,
    type: move.type,
    cls: move.cls === "status" ? "special" : move.cls,
    arch,
    dmg: a.dmg * dmgScale,
    cd: a.cd * cdScale,
    count: a.count,
    area: a.area,
    speed: a.speed,
    dur: a.dur,
    pierce: a.pierce,
    status,
    statusChance,
    drain: move.drain > 0 ? clamp((move.drain / 100) * 0.3, 0.05, 0.25) : arch === "drain" ? 0.12 : 0,
    critBonus: move.crit >= 1 ? 0.15 : 0,
    flinch: move.flinch / 100,
    power,
    weather: rules.weatherMoves[move.key],
    buff: rules.boostMoves.includes(move.key) ? move.key : undefined,
  };

  const special = rules.moveSpecial[move.key];
  if (special) {
    if (special.count) def.count = special.count;
    if (special.spread) def.spread = special.spread;
    if (special.pulses) def.pulses = special.pulses;
    if (special.dmgMul) def.dmg *= special.dmgMul;
    if (special.status !== undefined) def.status = special.status;
    if (special.statusChance != null) def.statusChance = special.statusChance;
  }
  return def;
}

/* ---------------------------------------------------------- player stats */

/**
 * Base player stats from the species' base stats, exactly as upstream computes them.
 * `level` is 1-based; the upstream curve uses (level - 1) as its growth term.
 */
export function basePlayerStats(species, level) {
  const s = species.stats;
  const total = s.hp + s.atk + s.def + s.spa + s.spd + s.spe;
  const a = (v) => (v / total) * 6;
  const o = 1 + (level - 1) * 0.12;

  return {
    maxHp: Math.round((70 + 45 * a(s.hp)) * o),
    regen: 0.25 + 0.25 * a(s.hp),
    armor: 6 * a(s.def) + 3 * a(s.spd),
    evasion: 0.02 + 0.02 * a(s.spe),
    shieldMax: 0,
    moveSpeed: 0.92 + 0.12 * a(s.spe),
    damage: o,
    physical: 0.82 + 0.2 * a(s.atk),
    special: 0.82 + 0.2 * a(s.spa),
    attackSpeed: 1,
    projectiles: 0,
    area: 1,
    duration: 1,
    projSpeed: 1,
    critChance: 0.05,
    critDamage: 1.75,
    lifesteal: 0,
    thorns: 0,
    knockback: 1,
    pickupRange: 6,
    xpGain: 1,
    gold: 1,
    luck: 0,
    luckMult: 1,
    difficulty: 1,
    eliteDamage: 1,
    extraJumps: 0,
    jumpHeight: 1,
    statusChance: 1,
    statusDamage: 1,
    healing: 1,
    superEffective: 1,
    flinch: 0,
    bounces: 0,
    enemyAmount: 1,
    megaCrit: 0,
    overheal: 0,
    powerup: 1,
    eliteSpawn: 1,
    slam: 1,
    typeBoost: {},
  };
}

/**
 * Apply modifier lists to a stat block.
 * Flat adds are summed; multipliers below 1 are applied to the base, and the
 * remaining multipliers are summed on top (upstream `wg` semantics).
 */
export function applyMods(stats, modGroups) {
  const groups = modGroups.length && Array.isArray(modGroups[0]) ? modGroups : [modGroups];
  for (const group of groups) for (const mod of group) if (mod.add) stats[mod.stat] = (stats[mod.stat] ?? 0) + mod.add;

  for (const group of groups) {
    const acc = {};
    for (const mod of group) {
      if (!mod.mul) continue;
      if (mod.mul < 1) stats[mod.stat] = (stats[mod.stat] ?? 0) * mod.mul;
      else acc[mod.stat] = (acc[mod.stat] ?? 0) + mod.mul - 1;
    }
    for (const [stat, bonus] of Object.entries(acc)) stats[stat] = (stats[stat] ?? 0) * (1 + bonus);
  }
  return stats;
}

/** Clamp the derived stats that upstream clamps after every recompute. */
export function clampStats(stats) {
  stats.evasion = Math.min(0.6, stats.evasion);
  stats.megaCrit = Math.max(0, Math.min(1, stats.critChance - 1));
  stats.critChance = Math.min(1, stats.critChance);
  stats.overheal = Math.min(1, stats.overheal);
  stats.luckMult = 1 + stats.luck / 100;
  stats.attackSpeed = Math.max(0.3, stats.attackSpeed);
  return stats;
}

/* -------------------------------------------------------------- scaling */

/** XP required to go from `level` to `level + 1`. */
export const xpForLevel = (level) => Math.round(8 + level * 5.5 + level ** 1.8);

/** Level cap. The shop's Rare Candy and the evolution planner already assumed 50. */
export const MAX_LEVEL = 50;

/** Player damage multiplier by level (upstream `Ft`). */
export function playerDamageScale(level) {
  const t = Math.max(0, level - 1.5);
  return (
    (1 + 0.3 * level + 0.12 * t * t + 0.0025 * level * level * level) *
    1.06 ** Math.max(0, level - 20) *
    1.15 ** Math.max(0, level - 45)
  );
}

/** Enemy damage multiplier by level (upstream `It`). */
export function enemyDamageScale(level) {
  return (
    (1 + 0.13 * level) *
    (1 + 0.02 * level) *
    1.03 ** Math.max(0, level - 20) *
    1.1 ** Math.max(0, level - 45)
  );
}

const HP_CURVE_N = [1, 5.5, 13, 20];
const HP_CURVE_R = [0.15, 0.07, 0.05, 0.05];

/** Enemy HP multiplier for a stage and elapsed minutes (upstream `hpCurve`). */
export function enemyHpCurve(stage, minutes) {
  const n = HP_CURVE_N[stage - 1] ?? 20;
  const r = HP_CURVE_R[stage - 1] ?? 0.05;
  const i = Math.max(0, minutes - (stage === 1 ? 1.5 : 0));
  return (1 + minutes * 0.3 + i * i * r) * n;
}

/** Enemy toughness falls off over the first eight minutes of a stage. */
export const toughness = (effTime) => 1.35 + 1.05 * Math.max(0, 1 - effTime / 480);

/** Enemy movement speed for a species. */
export function enemySpeed(species) {
  const heavy = species.weight > 2500 ? 0.8 : 1;
  return Math.min(6.2, (3 + species.stats.spe / 55) * heavy);
}

/** Enemy contact damage for a species. */
export function enemyDamage(species, dmgMult) {
  return (5 + species.stats.atk / 16 + species.stats.spa / 24) * dmgMult;
}

/** Enemy XP reward for a species. */
export function enemyXp(species, toughnessMult, tier) {
  const tierMul = { normal: 1, swarm: 1, stampede: 1, elite: 6, alpha: 25, totem: 35, summoner: 20, boss: 60 }[tier] ?? 1;
  return (1 + species.bst / 300) * (1 + (toughnessMult - 1) * 0.35) * tierMul;
}

/* --------------------------------------------------------------- rarities */

const RARITY_NAMES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

/**
 * Roll an upgrade rarity.
 * Mirrors upstream `Zv`: luck shifts weight toward rare tiers and unlocks them
 * progressively as the run's "luck level" grows.
 */
export function rollRarity({ level, luck = 0, stage = 1, minRarity = 0, luckBonus = 0, available = [] }) {
  const luckTotal = Math.max(0, luck + luckBonus);
  const a = luckTotal / 100;
  const scale = level + luckTotal / 8 + (stage - 1) * 12;
  const ramp = (lo, hi) => clamp((scale - lo) / (hi - lo), 0, 1);

  const weights = [
    70 / (1 + a),
    24 * (1 + 0.5 * a),
    5 * (1 + a) ** 2 * ramp(3, 10),
    0.9 * (1 + a) ** 3 * ramp(8, 18),
    0.12 * (1 + a) ** 4 * ramp(14, 26),
  ].map((w, i) => w * (i >= minRarity ? 1 : 1e-4) * (available.length && !available[i] ? 0 : 1));

  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 1e-6) return minRarity;
  let roll = Math.random() * total;
  for (let i = 0; i < 5; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return 0;
}

export const rarityName = (r) => RARITY_NAMES[r] ?? "Common";

/* ----------------------------------------------------- upgrade text */

const STAT_NAMES = {
  damage: "damage",
  maxHp: "max HP",
  moveSpeed: "move speed",
  evasion: "evasion",
  gold: "coins",
  critChance: "crit chance",
  critDamage: "crit damage",
  area: "area",
  projSpeed: "projectile speed",
  healing: "healing",
  regen: "regeneration/s",
  armor: "armor",
  pickupRange: "pickup range",
  eliteDamage: "damage to elites",
  luck: "luck",
  physical: "physical damage",
  special: "special damage",
  attackSpeed: "attack speed",
  thorns: "thorns",
  duration: "duration",
  extraJumps: "extra jumps",
  jumpHeight: "jump height",
  statusChance: "status chance",
  statusDamage: "status damage",
  xpGain: "XP gain",
  lifesteal: "lifesteal",
  bounces: "bounces",
  enemyAmount: "enemy count",
  superEffective: "super-effective damage",
  flinch: "flinch chance",
  projectiles: "projectiles",
  knockback: "knockback",
  powerup: "power-ups",
  eliteSpawn: "elite spawns",
  slam: "slam damage",
  shieldMax: "shield",
  megaCrit: "mega-crit chance",
  overheal: "overheal",
};

// Stats where a flat `add` is expressed as percentage points.
const PCT_ADD = new Set([
  "evasion",
  "critChance",
  "critDamage",
  "lifesteal",
  "megaCrit",
  "overheal",
  "flinch",
  "statusChance",
  "superEffective",
]);

export function describeMod(mod) {
  const name = STAT_NAMES[mod.stat] ?? mod.stat;
  if (mod.add != null) {
    if (PCT_ADD.has(mod.stat)) return `+${Math.round(mod.add * 100)}% ${name}`;
    if (mod.stat === "regen") return `+${mod.add.toFixed(1)} ${name}`;
    if (mod.stat === "luck") return `+${Math.round(mod.add)} ${name}`;
    return `+${mod.add % 1 === 0 ? mod.add : mod.add.toFixed(2)} ${name}`;
  }
  if (mod.mul != null) {
    const pct = Math.round((mod.mul - 1) * 100);
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct}% ${name}`;
  }
  return "";
}

/** Build an English description for an upgrade entry from its mods and tags. */
export function describeUpgrade(up) {
  const parts = (up.mods ?? []).map(describeMod).filter(Boolean);
  if (up.tags?.length) {
    for (const tag of up.tags) {
      if (tag.startsWith("type:")) parts.push(`boosts ${tag.slice(5)} moves`);
    }
  }
  return parts.join(" · ") || up.desc || "";
}

/* ------------------------------------------------------------- evolution */

/**
 * Decide which evolution the player takes and at what level.
 * Mirrors upstream `runEvolution`.
 */
export function evolutionPlan(data, speciesId, rng) {
  const options = data.evolutionsOf(speciesId);
  if (!options.length) return null;
  const target = rng ? rng.pick(options) : options[0];
  const current = data.get(speciesId);
  const base = target.evoLevel ?? (current.evoStage === 0 ? 20 : 34);
  if (data.evolutionsOf(target.id).length) {
    return { to: target, level: Math.max(16, Math.min(30, Math.round(8 + base))) };
  }
  return { to: target, level: Math.max(36, Math.min(50, Math.round(22 + base * 0.6))) };
}

/* ------------------------------------------------------------ difficulty */

export const DIFFICULTIES = [
  { id: "normal", name: "Normal", enemyHp: 1, enemyDamage: 1, enemySpeed: 1, enemyAmount: 1, reward: 1, dust: 1 },
  { id: "hard", name: "Hard", enemyHp: 1.7, enemyDamage: 1.35, enemySpeed: 1.05, enemyAmount: 1.25, reward: 1.75, dust: 1.75 },
  { id: "nightmare", name: "Nightmare", enemyHp: 2.6, enemyDamage: 1.8, enemySpeed: 1.1, enemyAmount: 1.5, reward: 2.5, dust: 2.5 },
];

/* ------------------------------------------------------- allies */

export const ALLIES = {
  cap: 3,
  powerBase: 1,
  powerLevel: 0.5,
  powerBst: 100,
  powerBstDiv: 300,
  powerStage: 0.1,
  powerBond: 0.2,
  shinyMul: 1.5,
  cooldownPhysical: 2,
  cooldownSpecial: 3,
  supportBoost: 0.1,
};
