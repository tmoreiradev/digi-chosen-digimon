// Scripted items: upstream upgrades with no stat mods, implemented as hooks in the damage, kill
// and player-hit paths. `SCRIPTED` is the list the item pool trusts — an upgrade that is neither
// mod-bearing nor listed here is never offered, because its card would promise nothing real.
// Descriptions the cards show live in src/core/i18n.js (ITEM_DESC_PT); keep both in step.

import { CAPTURABLE_TIERS } from "./capture.js";

export const SCRIPTED = new Set([
  "grip-claw", "berry-juice", // r0
  "shell-bell", "metronome", "binding-band", "awakening", "lemonade", "poke-doll", // r1
  "stick", "razor-fang", "focus-band", "full-heal", "guard-spec", "gold-teeth", // r2
  "focus-sash", "revive", "reaper-cloth", "thick-club", "fire-stone", "leaf-stone", "ss-ticket", // r3
  "max-revive", // r4
]);

export const itemCount = (run, key) => run.upgrades.get(key)?.count ?? 0;

const STOP_STATUSES = ["para", "root", "freeze", "sleep", "flinch"];

/** Multiplier on outgoing damage (before crit and the boss budget): Metronome, Binding Band, Full Heal, Reaper Cloth, Thick Club. */
export function itemDamageMul(run, e, def) {
  const p = run.player;
  let mul = 1;
  const metronome = itemCount(run, "metronome");
  if (metronome) mul *= 1 + Math.min(0.4, (run.time - p.lastHitT) * 0.02 * metronome);
  const binding = itemCount(run, "binding-band");
  if (binding && STOP_STATUSES.some((k) => e.statuses[k] > 0)) mul *= 1 + 0.2 * binding;
  const fullHeal = itemCount(run, "full-heal");
  if (fullHeal) {
    const distinct = Object.values(e.statuses).filter((t) => t > 0).length;
    mul *= 1 + Math.min(0.3, 0.06 * distinct * fullHeal);
  }
  const reaper = itemCount(run, "reaper-cloth");
  if (reaper) mul *= 1 + Math.min(0.3, Math.floor(run.stats.kills / 100) * 0.01 * reaper);
  const club = itemCount(run, "thick-club");
  if (club && def?.cls === "physical") mul *= 1 + Math.min(0.5, (p.stats.armor / 2) * 0.01 * club);
  return mul;
}

/** Stick: 3 % per copy that a direct hit does ×8. Returns the multiplier. */
export function itemBonk(run, e) {
  const n = itemCount(run, "stick");
  if (!n || Math.random() >= 0.03 * n) return 1;
  run.floater(e.x, e.y + 1.8, e.z, "Bonk!", "#ffd166");
  return 8;
}

/** After a hit landed (hp already reduced): Shell Bell heal, Grip Claw root, Awakening sleep, Razor Fang execute. */
export function itemOnHit(run, e, amount) {
  const p = run.player;
  const bell = itemCount(run, "shell-bell");
  if (bell) run.healPlayer(amount * 0.008 * bell * p.stats.healing);
  if (e.hp <= 0) return;
  const claw = itemCount(run, "grip-claw");
  if (claw && Math.random() < 0.04 * claw) e.statuses.root = Math.max(e.statuses.root, 2);
  const awakening = itemCount(run, "awakening");
  if (awakening && Math.random() < 0.025 * awakening) e.statuses.sleep = Math.max(e.statuses.sleep, 3);
  // Razor Fang never touches alphas and bosses: the capture flow needs them alive under 10 % HP.
  const fang = itemCount(run, "razor-fang");
  if (fang && !CAPTURABLE_TIERS.has(e.tier) && e.hp <= e.maxHp * (0.08 + 0.04 * (fang - 1))) e.hp = 0; // the caller's kill check finishes it
}

/** On a kill: Berry Juice heal, Fire Stone explosion (burned victim), Leaf Stone whirl. */
export function itemOnKill(run, e) {
  const p = run.player;
  const juice = itemCount(run, "berry-juice");
  if (juice && Math.random() < 0.05 * juice) run.healPlayer(p.maxHp * 0.02 * p.stats.healing);
  const fire = itemCount(run, "fire-stone");
  if (fire && e.statuses.burn > 0) {
    run.burst(e.x, e.y + 0.8, e.z, 0xff7a3c, 18, "star");
    run.hitAround(e.x, e.z, 3, e.maxHp * 0.4 * fire, { type: "fire", cls: "special" }, e.id);
  }
  const leaf = itemCount(run, "leaf-stone");
  if (leaf && Math.random() < 0.1 * leaf) {
    run.burst(e.x, e.y + 0.8, e.z, 0x7ad37a, 14, "star");
    run.hitAround(e.x, e.z, 3, e.maxHp * 0.3, { type: "grass", cls: "special" }, e.id);
    run.healPlayer(p.maxHp * 0.01 * p.stats.healing);
  }
}

/** Guard Spec.: every 14 s the next hit is blocked outright. True when this hit was blocked. */
export function itemBlockHit(run) {
  const p = run.player;
  if (!itemCount(run, "guard-spec") || run.time - p.guardT < 14) return false;
  p.guardT = run.time;
  run.floater(p.x, p.y + 2, p.z, "bloqueado", "#9ca3ff");
  return true;
}

/** A lethal hit: Focus Sash (once per zone), Focus Band (15 % per copy, 20 s), Revive / Max Revive (once each). True when the player lives. */
export function itemSurvive(run) {
  const p = run.player;
  if (itemCount(run, "focus-sash") && p.sashStage !== run.stage) {
    p.sashStage = run.stage;
    p.hp = 1;
    run.banner("Focus Sash! Sobreviveu com 1 HP");
    return true;
  }
  const band = itemCount(run, "focus-band");
  if (band && run.time - p.bandT >= 20 && Math.random() < 0.15 * band) {
    p.bandT = run.time;
    p.hp = 1;
    run.banner("Focus Band! Sobreviveu com 1 HP");
    return true;
  }
  for (const [key, pct, name] of [["max-revive", 0.6, "Max Revive"], ["revive", 0.35, "Revive"]]) {
    if (itemCount(run, key) > (p.revived[key] ?? 0)) {
      p.revived[key] = (p.revived[key] ?? 0) + 1;
      p.hp = Math.round(p.maxHp * pct);
      p.iframes = Math.max(p.iframes, 1.5);
      run.banner(`${name}! De volta com ${Math.round(pct * 100)}% do HP`);
      run.burst(p.x, p.y + 1, p.z, 0xffd166, 30, "star");
      return true;
    }
  }
  return false;
}
