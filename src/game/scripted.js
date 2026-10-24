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
  // second wave (phase 17)
  "soda-pop", "adrenaline-orb", "metal-powder", "ice-heal", "old-rod", "eviolite", "shed-shell", "cell-battery",
  "griseous-orb", "electirizer", "silph-scope", "max-ether", "tm-case", "poke-flute",
  // adapted (phase 23): the game has no Unown altars or Poké Ball stock, so they act on the Ancient Altar and chests
  "secret-key", "dowsing-machine",
]);

/** Flat damage of item-made attacks (lightning, Magikarp, bubbles, shadows): grows with level and the damage stat. */
export const itemPower = (run) => (10 + 2 * run.player.level) * run.player.stats.damage;

/** Attack speed multiplier from timed items: Adrenaline Orb, Metal Powder, Cell Battery, Poké Flute. */
export function itemAtkMul(run) {
  const p = run.player;
  let mul = 1;
  const orb = itemCount(run, "adrenaline-orb");
  if (orb && p.adrenalineT > 0) mul *= 1 + 0.12 * orb;
  const powder = itemCount(run, "metal-powder");
  if (powder && p.stillT >= 0.5) mul *= 1 + 0.08 * powder;
  const battery = itemCount(run, "cell-battery");
  if (battery) mul *= 1 + Math.min(0.25, Math.floor(p.streak / 10) * 0.015 * battery);
  if (p.fluteT > 0) mul *= 1.3;
  return mul;
}

/** Move speed multiplier: Adrenaline Orb after being hit. */
export function itemMoveMul(run) {
  const orb = itemCount(run, "adrenaline-orb");
  return orb && run.player.adrenalineT > 0 ? 1 + 0.2 * orb : 1;
}

/** Armour multiplier: Metal Powder while standing still. */
export function itemArmorMul(run) {
  const powder = itemCount(run, "metal-powder");
  return powder && run.player.stillT >= 0.5 ? 1 + 0.3 * powder : 1;
}

/** Periodic items, once per step: Electirizer lightning, Silph Scope mark, Old Rod. */
export function itemTick(run, dt) {
  const p = run.player;
  const elec = itemCount(run, "electirizer");
  if (elec && (p.elecT -= dt) <= 0) {
    p.elecT = 2.5;
    const near = run.enemies
      .filter((e) => e.alive && !(e.dying > 0) && Math.hypot(e.x - p.x, e.z - p.z) < 12)
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))
      .slice(0, 2 + elec);
    for (const e of near) {
      run.burst(e.x, e.y + 1.5, e.z, 0xffe14a, 8, "star");
      run.hitAround(e.x, e.z, 0.1, itemPower(run) * 0.6, { type: "electric", cls: "special" });
      if (e.hp > 0 && Math.random() < 0.3) e.statuses.para = Math.max(e.statuses.para, 1.5);
    }
  }
  const scope = itemCount(run, "silph-scope");
  if (scope) {
    // One mark per copy, on the toughest enemies within 14 u.
    const live = run.enemies.filter((e) => e.marked && e.alive && !(e.dying > 0)).length;
    if (live < scope) p.scopeT = 0; // a mark fell: mark again at once
    if ((p.scopeT -= dt) <= 0) {
      p.scopeT = 6;
      for (const e of run.enemies) e.marked = false;
      const near = run.enemies
        .filter((e) => e.alive && !(e.dying > 0) && Math.hypot(e.x - p.x, e.z - p.z) <= 14)
        .sort((a, b) => b.maxHp - a.maxHp)
        .slice(0, scope);
      for (const e of near) e.marked = true;
    }
  }
  const rod = itemCount(run, "old-rod");
  if (rod && (p.rodT -= dt) <= 0) {
    p.rodT = 9;
    const pool = run.enemies.filter((e) => e.alive && !(e.dying > 0) && Math.hypot(e.x - p.x, e.z - p.z) < 14);
    const e = pool[Math.floor(Math.random() * pool.length)];
    if (e) {
      const gyarados = Math.random() < 0.1 * rod;
      run.floater(e.x, e.y + 2, e.z, gyarados ? "Gyarados!" : "Magikarp!", "#7ab8ff");
      run.hitAround(e.x, e.z, gyarados ? 3 : 0.1, itemPower(run) * (gyarados ? 5 : 1.5) * rod, { type: "water", cls: "physical" });
    }
  }
}

/** Soda Pop: a dash bursts a bubble wave around the player. */
export function itemOnDash(run) {
  const pop = itemCount(run, "soda-pop");
  if (!pop) return;
  const p = run.player;
  run.ring(p.x, p.y + 0.2, p.z, 3.5, 0x9ad8ff, 0.3);
  run.hitAround(p.x, p.z, 3.5, itemPower(run) * 0.5 * pop, { type: "water", cls: "special" });
}

/** Poké Flute on an ultimate: every move is ready again and attack speed +30 % for 6 s. */
export function itemOnUltimate(run) {
  if (!itemCount(run, "poke-flute")) return;
  for (const mv of run.player.moves) mv.timer = 0;
  run.player.fluteT = 6;
}

export const itemCount = (run, key) => run.upgrades.get(key)?.count ?? 0;

/**
 * Held items the pause screen offers, in order. Leftovers (regen), Choice Band (x1.5 damage) and
 * Life Orb (x1.3 damage, 2 % of max HP per cast) are handled in run.js; the rest are plain stat mods.
 */
export const HELD_MODS = {
  leftovers: [],
  "choice-band": [],
  "life-orb": [],
  "scope-lens": [{ stat: "critChance", add: 0.1 }],
  "muscle-band": [{ stat: "physical", mul: 1.15 }],
  "wise-glasses": [{ stat: "special", mul: 1.15 }],
  "expert-belt": [{ stat: "superEffective", mul: 1.25 }],
  "quick-claw": [{ stat: "attackSpeed", mul: 1.1 }],
  "bright-powder": [{ stat: "evasion", add: 0.08 }],
  "rocky-helmet": [{ stat: "thorns", add: 20 }],
  "big-root": [{ stat: "healing", mul: 1.3 }],
  "lucky-egg": [{ stat: "xpGain", mul: 1.3 }],
  "amulet-coin": [{ stat: "gold", mul: 1.5 }],
};
export const HELD_ITEMS = Object.keys(HELD_MODS);

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
  if (e.marked) mul *= 1.4; // Silph Scope
  const iceHeal = itemCount(run, "ice-heal");
  if (iceHeal && e.statuses.freeze > 0) {
    mul *= 1 + 0.6 * iceHeal; // Ice Heal: the hit shatters the ice (itemOnHit thaws it)
    e.shatter = true;
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
  if (e.shatter) {
    e.shatter = false;
    e.statuses.freeze = 0;
    for (const n of run.enemies) {
      if (n !== e && n.alive && Math.hypot(n.x - e.x, n.z - e.z) < 3) n.statuses.para = Math.max(n.statuses.para, 1.5); // shards chill
    }
  }
  const bell = itemCount(run, "shell-bell");
  if (bell) run.healPlayer(amount * 0.008 * bell);
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
  if (juice && Math.random() < 0.05 * juice) run.healPlayer(p.maxHp * 0.02);
  const fire = itemCount(run, "fire-stone");
  if (fire && e.statuses.burn > 0) {
    run.burst(e.x, e.y + 0.8, e.z, 0xff7a3c, 18, "star");
    run.hitAround(e.x, e.z, 3, e.maxHp * 0.4 * fire, { type: "fire", cls: "special" }, e.id);
  }
  const shadow = itemCount(run, "griseous-orb");
  if (shadow && Math.random() < 0.12 * shadow) {
    run.burst(e.x, e.y + 0.8, e.z, 0x6a4a9a, 14, "star");
    for (const n of run.enemies) {
      if (n !== e && n.alive && Math.hypot(n.x - e.x, n.z - e.z) < 3) n.statuses.curse = Math.max(n.statuses.curse ?? 0, 4);
    }
    run.hitAround(e.x, e.z, 3, itemPower(run), { type: "ghost", cls: "special" }, e.id);
  }
  const leaf = itemCount(run, "leaf-stone");
  if (leaf && Math.random() < 0.1 * leaf) {
    run.burst(e.x, e.y + 0.8, e.z, 0x7ad37a, 14, "star");
    run.hitAround(e.x, e.z, 3, e.maxHp * 0.3, { type: "grass", cls: "special" }, e.id);
    run.healPlayer(p.maxHp * 0.01);
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
