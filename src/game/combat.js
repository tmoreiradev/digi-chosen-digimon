// Statuses and elemental reactions (rules from the upstream glossary). hitEnemy calls
// findReaction() before the damage lands (the multiplier counts for this hit), then
// applyReaction() for the side effects, then applyStatus() for the move's own status.

import { isBossTier } from "./capture.js";

/** Data names → the keys the engine reads. Moves say "paralysis"; the engine has always used "para". */
export const statusKey = (s) => (s === "paralysis" ? "para" : s);

/** Seconds each status lasts on an enemy (knock is an instant push). */
export const STATUS_SECS = { burn: 3.2, poison: 3.2, para: 3, freeze: 1.6, sleep: 3, root: 2, curse: 4, wet: 5, confusion: 3, charm: 3, healblock: 6, stun: 0.5 };

/** Statuses a boss shrugs off: they would pin or steer it. */
const BOSS_IMMUNE = new Set(["stun", "knock", "confusion"]);

/** Apply a status to an enemy. Returns false when it does not take. */
export function applyStatus(run, e, raw) {
  const status = statusKey(raw);
  if (!status || e.hp <= 0) return false;
  if (isBossTier(e.tier) && BOSS_IMMUNE.has(status)) return false;
  if (status === "knock") {
    // A strong shove away from the player.
    const p = run.player;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const half = run.biome.size / 2;
    e.x = Math.max(-half, Math.min(half, e.x + (dx / d) * 1.5));
    e.z = Math.max(-half, Math.min(half, e.z + (dz / d) * 1.5));
    return true;
  }
  e.statuses[status] = Math.max(e.statuses[status] ?? 0, STATUS_SECS[status] ?? 3);
  return true;
}

/**
 * Elemental reactions: a hit of one of `types` on an enemy carrying `status`.
 * mul multiplies this hit; consume removes the status; name is the pt-BR floater.
 */
export const REACTIONS = [
  { key: "electrocute", status: "wet", types: ["electric"], mul: 1.5, consume: true, name: "Eletrocutado!" },
  { key: "flashfreeze", status: "wet", types: ["ice"], mul: 1, consume: true, name: "Congelou!" },
  { key: "steam", status: "burn", types: ["water"], mul: 1.4, consume: true, name: "Vapor!" },
  { key: "wildfire", status: "burn", types: ["grass", "flying"], mul: 1.3, consume: false, name: "Incêndio!" },
  { key: "shatter", status: "freeze", types: ["fighting", "rock", "steel"], mul: 2.6, consume: true, name: "Destruição!" },
  { key: "poisongas", status: "poison", types: ["fire"], mul: 1.4, consume: true, name: "Gás Venenoso!" },
  { key: "nightmare", status: "sleep", types: ["ghost", "dark"], mul: 1.7, consume: true, name: "Pesadelo!" },
  { key: "mindcrash", status: "para", types: ["psychic"], mul: 1.6, consume: true, name: "Colapso Mental!" },
  { key: "dragonrage", status: "charm", types: ["dragon"], mul: 2, consume: true, name: "Fúria do Dragão!" },
];

export function findReaction(e, type) {
  if (!type) return null;
  return REACTIONS.find((r) => e.statuses[r.status] > 0 && r.types.includes(type)) ?? null;
}

const near = (run, e, r) =>
  run.enemies.filter((n) => n !== e && n.alive && !(n.dying > 0) && Math.hypot(n.x - e.x, n.z - e.z) <= r);

/** Side effects of a reaction, after the boosted hit (`amount`) landed on `e`. */
export function applyReaction(run, e, reaction, amount) {
  run.stats.reactions = (run.stats.reactions ?? 0) + 1;
  run.floater(e.x, e.y + 2.2, e.z, reaction.name, "#ff9ad5");
  if (reaction.consume) e.statuses[reaction.status] = 0;
  const def = { type: reaction.types[0], cls: "special" };
  switch (reaction.key) {
    case "electrocute": // jumps to up to 12 wet enemies within 9 u; 60 % paralysis
      for (const n of near(run, e, 9).filter((n) => n.statuses.wet > 0).slice(0, 12)) {
        n.statuses.wet = 0;
        run.hitAround(n.x, n.z, 0.1, amount * 0.6, def, -1, n.id);
        if (Math.random() < 0.6) applyStatus(run, n, "para");
      }
      break;
    case "flashfreeze":
      applyStatus(run, e, "freeze");
      break;
    case "steam": // a cloud that confuses and roots around the target
      run.ring(e.x, 0.3, e.z, 3, 0xdde6ee, 0.4);
      for (const n of [e, ...near(run, e, 3)]) {
        applyStatus(run, n, "confusion");
        applyStatus(run, n, "root");
      }
      break;
    case "wildfire": // the burn spreads within 7 u
      for (const n of near(run, e, 7)) {
        applyStatus(run, n, "burn");
        n.burnDps = Math.max(n.burnDps ?? 0, e.burnDps ?? amount * 0.06);
      }
      break;
    case "shatter": // ice shards around
      run.hitAround(e.x, e.z, 2.5, amount * 0.3, def, e.id);
      break;
    case "poisongas": // explosion that poisons around
      run.ring(e.x, 0.3, e.z, 3, 0xb560e0, 0.4);
      run.hitAround(e.x, e.z, 3, amount * 0.5, { type: "poison", cls: "special" }, e.id);
      for (const n of near(run, e, 3)) {
        applyStatus(run, n, "poison");
        n.poisonDps = Math.max(n.poisonDps ?? 0, e.poisonDps ?? amount * 0.05);
      }
      break;
    case "nightmare": // and heals the player a little
      run.healPlayer(run.player.maxHp * 0.02);
      break;
    case "mindcrash":
      applyStatus(run, e, "confusion");
      break;
  }
}
