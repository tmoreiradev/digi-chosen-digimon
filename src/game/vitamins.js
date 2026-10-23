// Vitamins: the persistent stat-growth system.
//
// Each pick rolls a rarity and banks its scale; the vitamin's total modifier is
// `per * sum(banked scales)`. Mirrors the upstream `addVitamin` + `dt` table.

import { rollRarity } from "./rules.js";

/** Build the modifier group contributed by one vitamin at its current level. */
export function vitaminMod(def, acc) {
  if (def.kind === "add") return { stat: def.stat, add: def.per * acc };
  return { stat: def.stat, mul: 1 + def.per * acc };
}

/** Roll the rarity scale for a vitamin pick (dt[rarity]). */
export function rollVitaminScale(run, defs) {
  const available = [0, 1, 2, 3, 4].map((r) => defs.some((d) => true));
  const rarity = rollRarity({
    level: run.player.level,
    luck: run.player.stats.luck,
    stage: run.stage,
    minRarity: 0,
    available: [true, true, true, true, true],
  });
  return { rarity, scale: run.rules.vitaminScale[rarity] };
}

/** Human text for what one pick of a vitamin grants. */
export function vitaminGainText(def, scale) {
  const value = def.per * scale;
  if (def.dice) return `rolls a random stat, 50% stronger`;
  if (def.kind === "add") {
    const isPct = ["critChance", "evasion", "lifesteal", "overheal"].includes(def.stat);
    if (isPct) return `+${Math.round(value * 100)}% ${def.desc.toLowerCase()}`;
    if (def.stat === "regen" || def.stat === "pickupRange") return `+${value.toFixed(1)} ${def.desc.toLowerCase()}`;
    return `+${Math.round(value)} ${def.desc.toLowerCase()}`;
  }
  return `+${Math.round(value * 100)}% ${def.desc.toLowerCase()}`;
}

/** Total accumulated text for the HUD. */
export function vitaminTotalText(def, entry) {
  const value = def.per * (entry?.acc ?? 0);
  if (def.dice) return `lvl ${entry?.level ?? 0}`;
  if (def.kind === "add") {
    const isPct = ["critChance", "evasion", "lifesteal", "overheal"].includes(def.stat);
    if (isPct) return `+${Math.round(value * 100)}%`;
    if (def.stat === "regen" || def.stat === "pickupRange") return `+${value.toFixed(1)}`;
    return `+${Math.round(value)}`;
  }
  return `+${Math.round(value * 100)}%`;
}

/** The pick that a level-up card applies to the player. */
export function applyVitaminPick(run, key, rarity) {
  const p = run.player;
  const scale = run.rules.vitaminScale[rarity] ?? 1;
  const def = run.rules.vitamins.find((v) => v.key === key);
  if (!def) return;
  const entry = p.vitamins.get(key);
  if (entry) {
    entry.level += 1;
    entry.acc += scale;
  } else {
    p.vitamins.set(key, { level: 1, acc: scale });
  }
  // The Loaded Dice rolls a random other vitamin at 1.5x strength.
  if (def.dice) {
    const others = run.rules.vitamins.filter((v) => !v.dice);
    const rolled = run.rng.pick(others);
    if (rolled) {
      const diceEntry = p.vitamins.get(rolled.key);
      if (diceEntry) {
        diceEntry.level += 1;
        diceEntry.acc += scale * 1.5;
      } else {
        p.vitamins.set(rolled.key, { level: 1, acc: scale * 1.5 });
      }
    }
  }
  run.recompute(p);
}

/** Modifier groups for every owned vitamin (fed into the stat recompute). */
export function vitaminGroups(player, rules) {
  const groups = [];
  for (const [key, entry] of player.vitamins) {
    const def = rules.vitamins.find((v) => v.key === key);
    if (def) groups.push([vitaminMod(def, entry.acc)]);
  }
  return groups;
}

/** Candidates for the level-up cards. */
export function vitaminChoices(run, cap) {
  const p = run.player;
  const out = [];
  const owned = p.vitamins;
  for (const def of run.rules.vitamins) {
    const entry = owned.get(def.key);
    if (entry) {
      if (entry.level < cap) {
        const { rarity, scale } = rollVitaminScale(run, run.rules.vitamins);
        out.push({
          kind: "upVit",
          vit: def.key,
          rarity,
          title: def.name,
          sub: `Level ${entry.level} → ${entry.level + 1}`,
          lines: [vitaminGainText(def, scale)],
          icon: "vit",
          weight: 1.1,
        });
      }
    } else if (run.rng.chance(0.45)) {
      const { rarity, scale } = rollVitaminScale(run, run.rules.vitamins);
      out.push({
        kind: "newVit",
        vit: def.key,
        rarity,
        title: def.name,
        sub: "New vitamin",
        lines: [vitaminGainText(def, scale)],
        icon: "vit",
        weight: 1.1,
      });
    }
  }
  return out;
}
