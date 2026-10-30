// The run simulation: player, enemies, projectiles, pickups and the spawn director.

import { clamp, dist, dist2, lerp, TAU } from "../core/math.js";
import { makeRng } from "../core/rng.js";
import {
  applyMods,
  basePlayerStats,
  buildMoveDef,
  clampStats,
  describeUpgrade,
  effectiveness,
  enemyDamage,
  enemyHpCurve,
  enemySpeed,
  enemyXp,
  evolutionPlan,
  rollRarity,
  MAX_LEVEL,
  toughness,
  xpForLevel,
} from "./rules.js";
import { Director, ZONE_SECS } from "./director.js";
import { Boss } from "./boss.js";
import { Allies, Capture, CAPTURABLE_TIERS, isBossTier } from "./capture.js";
import { statusKey, applyStatus, findReaction, applyReaction } from "./combat.js";
import {
  SCRIPTED,
  itemDamageMul,
  itemBonk,
  itemOnHit,
  itemOnKill,
  itemBlockHit,
  itemSurvive,
  itemAtkMul,
  itemMoveMul,
  itemArmorMul,
  itemTick,
  itemOnDash,
  itemOnUltimate,
  itemCount,
  HELD_MODS,
} from "./scripted.js";
import { Tower } from "./tower.js";
import { WorldEvents } from "./events.js";
import { AchievementTracker, EggSystem } from "./achievements.js";
import { applyFusion, fusionChoices } from "./fusion.js";
import { applyVitaminPick, vitaminChoices, vitaminGroups } from "./vitamins.js";
import { archLabel, typeName } from "../core/i18n.js";
import { TYPE_RGB } from "../render/palette.js";
import { PACK } from "../content/pack.js";

const ENEMY_CAP = 260;
const PICKUP_CAP = 400;
const STAGE_SECS = 300; // an endless zone lasts five minutes; classic zones run on ZONE_SECS (director.js)
// Card stats the data lists for an archetype but this engine cannot honour, so they are not
// offered: beam, cone, orbit and vortex strike instantly (no duration); buff has no duration;
// dash and wave have no projectile speed.
const NO_EFFECT_UPS = { beam: ["dur"], cone: ["dur"], vortex: ["dur"], buff: ["dur"], dash: ["speed"], wave: ["speed"] };
const SHINY_RATE = 1 / 256; // ~0.39% chance de um selvagem nascer shiny
const SHINY_XP_BONUS = 0.5; // +50% de XP/dust ao derrotar um shiny

/**
 * Enemy tiers, mapped onto the upstream flag enum:
 * Elite 1, Alpha 2, Boss 4, Ranged 8, Flying 16, Healer 32, Shielder 64,
 * Capture 128, Charger 256, Swarm 512, Stampede 1024, Shiny 2048,
 * Totem 4096, Summoner 8192, Treasure 16384, Object 32768.
 *
 * `tough` is false for the flags that skip the stage toughness multiplier
 * upstream (Alpha/Boss/Totem/Summoner/Capture/Shiny/Ranged).
 */
/** Angle step between fanned projectiles (fireMove), for the DPS estimate. Keep in step with fireMove. */
// lob is left out: its bombs land around the target and the blast (radius 2.2 x sqrt(area)) covers the spread.
const FAN_STEP = { orb: 0.45, meteor: 0.45, boomerang: 0.45, drain: 0.45, random: 0.3 };

export const ENEMY_TIER = {
  normal: { flag: 0, hpMul: 1, hpScale: 1, dmgMul: 1, scale: 1, xpMul: 1, speedMul: 1, tough: true },
  swarm: { flag: 512, hpMul: 1, hpScale: 0.6, dmgMul: 1, scale: 1, xpMul: 1, speedMul: 1, tough: true },
  stampede: { flag: 1024, hpMul: 1, hpScale: 0.8, dmgMul: 1.3, scale: 1, xpMul: 1, speedMul: 1, tough: true },
  elite: { flag: 1, hpMul: 4.5, hpScale: 1, dmgMul: 1.4, scale: 1.35, xpMul: 6, speedMul: 1, tough: true },
  alpha: { flag: 2, hpMul: 22, hpScale: 1, dmgMul: 1.8, scale: 2, xpMul: 25, speedMul: 0.9, tough: false },
  totem: { flag: 4096, hpMul: 30, hpScale: 1, dmgMul: 1.6, scale: 2.2, xpMul: 35, speedMul: 0.9, tough: false },
  summoner: { flag: 8192, hpMul: 14, hpScale: 1, dmgMul: 1.2, scale: 1.9, xpMul: 20, speedMul: 1, tough: false },
  boss: { flag: 4, hpMul: 70, hpScale: 1, dmgMul: 2.2, scale: 2.6, xpMul: 60, speedMul: 0.85, tough: false },
};

let nextId = 1;

export class Run {
  constructor(data, opts) {
    this.data = data;
    this.opts = opts;
    this.rng = makeRng(opts.seed ?? ((Math.random() * 1e9) | 0));
    this.rules = data.rules;

    this.biome = this.rules.biomes.find((b) => b.id === opts.biomeId) ?? this.rules.biomes[0];
    this.difficulty = opts.difficulty;

    this.time = 0;
    this.stage = 1;
    this.stageTime = 0;
    this.state = "running"; // running | dead | victory
    this.weather = "none";
    this.mode = opts.mode ?? "classic"; // classic | endless | tower

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.zones = [];
    this.effects = [];
    this.floaters = [];
    this.lastDt = 0.016;

    this.stats = { kills: 0, gold: 0, dust: 0, damage: 0, evolved: 0, levels: 0, items: 0 };
    // "First capture" means first capture of THIS run (see Capture.caught).
    this.capturesThisRun = 0;
    this.banished = new Set();
    this.upgrades = new Map();

    // Encounter systems (initialized before createPlayer, since recompute reads allies).
    this.boss = new Boss(this);
    this.capture = new Capture(this);
    this.allies = new Allies(this);
    this.events = new WorldEvents(this);
    this.timers = [];
    this.tower = this.mode === "tower" ? new Tower(this) : null;
    this.stateEventPanel = false;
    // Classic mode: zone guardians, then the sanctuary with the biome's legendary (see updateClassic).
    this.zoneBossSpawned = false;
    this.sanctuary = false;
    this.profile = opts.profile;

    // Pokédex: species seen (encountered in battle) and caught (recruited).
    // Persisted in profile.data.progress.pokedex across runs.
    const saved = this.profile?.data?.pokedex ?? { seen: [], caught: [] };
    this.pokedex = {
      seen: new Set(saved.seen ?? []),
      caught: new Set(saved.caught ?? []),
    };

    // Achievements & tasks: species seen/caught, shinies, runs, wins, tower floors.
    this.achievements = new AchievementTracker(this.profile, this);
    this.achievements.recordSeen(this.pokedex.seen.size);

    // Egg system: eggs hatch after walking enough steps.
    this.eggs = new EggSystem(this);

    this.player = this.createPlayer(opts.speciesId);
    this.director = new Director(this, this.rng);
    if (this.mode === "classic") this.events.placeGuardianAltar();

    // Achievement gold earned after the last run ended waits in the profile; pay it out now.
    const pending = this.profile?.data?.pendingGold ?? 0;
    if (pending > 0) {
      this.stats.gold += pending;
      this.profile.data.pendingGold = 0;
      this.profile.save();
      this.banner(`Recompensas pendentes: +${pending}G`);
    }
    if (this.tower) this.tower.enterFloor();
  }

  createPlayer(speciesId) {
    const species = this.data.get(speciesId);
    const roster = this.data.rosterFor(speciesId);
    const abilityKey = roster?.passive ?? this.data.abilities[species.abilities[0]]?.key ?? "none";
    const ability = this.rules.abilityKits[abilityKey] ?? { name: abilityKey, desc: "", mods: [] };

    const p = {
      id: nextId++,
      speciesId,
      species,
      types: species.types.slice(),
      abilityKey,
      ability,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      vy: 0,
      facingX: 0,
      facingZ: 1,
      radius: 0.55,
      grounded: true,
      jumpsLeft: 1,
      dashCd: 0,
      dashT: 0,
      iframes: 0,
      flash: 0,
      level: 1,
      xp: 0,
      xpNext: xpForLevel(1),
      hp: 100,
      maxHp: 100,
      shield: 0,
      regenAcc: 0,
      stats: {},
      moves: [],
      moveSlots: 3,
      vitamins: new Map(),
      items: new Map(),
      nickname: this.profile?.data?.nickname ?? null,
      heldItem: this.profile?.data?.heldItem ?? null,
      statuses: { burn: 0, poison: 0, para: 0, freeze: 0, sleep: 0, confusion: 0, root: 0, charm: 0 },
      ultCharge: 0,
      ultCd: 0,
      animT: 0,
      attackT: 0,
      ultPoseT: 0,
      hurtT: 0,
      lastHitT: -1e9, // run time of the last hit that landed (shield regen and Metronome read it)
      guardT: -1e9, // Guard Spec.: last blocked hit
      bandT: -1e9, // Focus Band: last save
      sashStage: 0, // Focus Sash: zone it was used in
      revived: {}, // Revive / Max Revive uses per key
      adrenalineT: 0, // Adrenaline Orb: speed burst after a hit
      stillT: 0, // Metal Powder: time standing still
      streak: 0, // Cell Battery: kills since the last hit taken
      fluteT: 0, // Poké Flute: attack speed burst after an ultimate
      elecT: 2.5, // Electirizer timer
      scopeT: 0, // Silph Scope timer
      rodT: 9, // Old Rod timer
      dead: false,
      lastEvoCheck: 1,
      evoPlan: null, // decided once per species (see tryEvolve); a re-roll per check used to move the target
      moveSpeedNow: 1,
      shiny: Math.random() < SHINY_RATE,
      steps: 0,
      lastX: 0,
      lastZ: 0,
    };
    this.recompute(p);
    p.hp = p.maxHp;
    this.learnKitMoves(p);
    p.evoPlan = evolutionPlan(this.data, speciesId, this.rng);
    return p;
  }

  /** Recompute the player's derived stats from base stats + upgrades + ability. */
  recompute(p) {
    const base = basePlayerStats(p.species, p.level);
    const groups = [];
    for (const up of this.upgrades.values()) if (up.mods) groups.push(up.mods);
    if (p.ability?.mods) groups.push(p.ability.mods);
    groups.push(...vitaminGroups(p, this.rules));
    groups.push(...this.allies.mods());
    if (HELD_MODS[p.heldItem]?.length) groups.push(HELD_MODS[p.heldItem]);
    const stats = applyMods(base, groups);
    clampStats(stats);
    // Eviolite: while this species can still evolve, +50 % armour and +25 % max HP.
    if (itemCount(this, "eviolite") && this.data.evolutionsOf(p.speciesId).length) {
      stats.armor *= 1.5;
      stats.maxHp *= 1.25;
    }
    // Type items (Charcoal, Mystic Water…): the `type:` tag is +30 % per copy to moves of that type.
    for (const up of this.upgrades.values()) {
      for (const tag of up.tags ?? []) {
        if (!tag.startsWith("type:")) continue;
        const t = tag.slice(5);
        stats.typeBoost[t] = (stats.typeBoost[t] ?? 1) + 0.3 * up.count;
      }
    }

    const prevMax = p.maxHp;
    p.stats = stats;
    p.maxHp = Math.round(stats.maxHp);
    if (prevMax > 0 && p.maxHp > prevMax) p.hp += p.maxHp - prevMax;
    p.hp = Math.min(p.hp, p.maxHp);
    p.moveSpeedNow = stats.moveSpeed;
  }

  /** Give the player the moves its kit unlocks at the current level. */
  learnKitMoves(p) {
    const roster = this.data.rosterFor(p.speciesId);
    if (!roster) return;
    const levels = this.rules.kitLevels ?? [0, 2, 4, 7];
    roster.kit.forEach((key, i) => {
      if (p.level < (levels[i] ?? 0)) return;
      const move = this.data.getMoveByKey(key);
      if (!move) return;
      if (p.moves.some((m) => m.def.id === move.id)) return;
      if (p.moves.length >= p.moveSlots) return;
      const def = buildMoveDef(move, this.rules);
      if (!def) return;
      p.moves.push({ def, level: 1, timer: 0.4, mods: { dmg: 1, cd: 1, count: 0, area: 1, speed: 1, dur: 1, pierce: 0, crit: 0, status: 1, bounce: 0 } });
    });
  }

  /* -------------------------------------------------------------- loop */

  update(dt) {
    this.lastDt = dt;
    if (this.state !== "running") {
      this.updateEffects(dt);
      return;
    }
    this.time += dt;
    this.stageTime += dt;

    this.updatePlayer(dt);
    // Interacting with a chest/shop/altar freezes the world at once; the rest of this
    // step must not land hits (or a death) under a panel that has just opened.
    if (this.stateEventPanel) return;
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);
    // The director (free spawns + timeline) rests in the sanctuary and in the tower, whose
    // floors are fought in waves only.
    if (!this.sanctuary && !this.tower) this.director.update(dt);

    // Encounter systems
    this.capture.update(dt);
    itemTick(this, dt);
    this.allies.update(dt);
    this.boss.update(dt);
    this.events.update(dt);
    if (this.tower) {
      this.tower.update(dt);
    } else if (this.mode === "classic") {
      this.updateClassic();
    } else if (this.stageTime >= STAGE_SECS) this.advanceStage();

    // Scheduled one-shot callbacks (boss later())
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        tm.fn();
        this.timers.splice(i, 1);
      }
    }
  }

  advanceStage() {
    this.stage = Math.min(4, this.stage + 1);
    this.stageTime = 0;
    this.zoneBossSpawned = false;
    this.director.onStage(this.stage);
    this.events.onNewZone();
    if (this.mode === "classic") this.events.placeGuardianAltar();
    this.banner(`Zona ${this.stage} — inimigos mais fortes`);
  }

  /* ------------------------------------------------------------ classic */

  /**
   * Classic mode: each zone has a guardian altar (WorldEvents.placeGuardianAltar). The player
   * wakes the guardian there whenever ready (callGuardian); beating it opens the next zone.
   * If the zone clock (ZONE_SECS) runs out first, the director's final swarm starts and grows
   * every minute. After zone 3 the run enters the sanctuary, where the biome's legendary
   * waits; defeating it wins the run.
   */
  updateClassic() {
    if (this.sanctuary || this.zoneBossSpawned || this.stageTime < ZONE_SECS) return;
    this.director.startFinalSwarm();
  }

  /** E at the guardian altar: wake the zone's guardian (biome.guardians, one list per zone). */
  callGuardian() {
    if (this.mode !== "classic" || this.sanctuary || this.zoneBossSpawned || this.state !== "running") return false;
    const candidates = this.biome.guardians?.[this.stage - 1] ?? [];
    const speciesId = candidates.length ? this.rng.pick(candidates) : this.biome.bosses?.[this.stage - 1];
    if (!speciesId) {
      this.advanceStage(); // biome without guardians: the altar just opens the next zone
      return true;
    }
    const spot = this.director.spawnPoint(8, 12) ?? { x: this.player.x + 8, z: this.player.z };
    if (!this.boss.spawn(speciesId, spot.x, spot.z, "guardian")) return false;
    this.zoneBossSpawned = true;
    return true;
  }

  /** Boss.onDefeat calls this for every boss kind (tower floors included). */
  onBossDefeated(kind) {
    if (this.state !== "running") return; // the player died earlier in this same step: defeat stands
    if (this.tower) {
      this.tower.onGuardianDown();
      return;
    }
    if (this.mode !== "classic") return;
    if (kind === "legendary") {
      this.state = "victory";
      this.opts.onVictory?.();
    } else if (this.stage >= 3) {
      this.enterSanctuary();
    } else {
      this.banner(`Zona ${this.stage} limpa!`);
      this.advanceStage();
    }
  }

  enterSanctuary() {
    this.sanctuary = true;
    // A calm arena: the horde fades, spawns stop, and the legendary arrives shortly.
    for (const e of this.enemies) {
      if (e.alive && e.dying <= 0) {
        e.dying = 0.35;
        e.hp = 0;
      }
    }
    this.banner("O santuário — algo antigo desperta");
    const candidates = this.biome.legendaries ?? [];
    const speciesId = candidates.length ? this.rng.pick(candidates) : PACK.fallbackLegendary; // the pack's (Mewtwo) when the biome lists none
    this.later(2.5, () => {
      const spot = this.director.spawnPoint(12, 16) ?? { x: this.player.x + 12, z: this.player.z };
      this.boss.spawn(speciesId, spot.x, spot.z, "legendary");
    });
  }

  /* ------------------------------------------------------------ player */

  updatePlayer(dt) {
    const p = this.player;
    if (p.dead) return;
    const input = this.opts.input;
    p.animT += dt;

    // Statuses
    for (const key of Object.keys(p.statuses)) {
      if (p.statuses[key] > 0) p.statuses[key] = Math.max(0, p.statuses[key] - dt);
    }
    if (p.statuses.freeze > 0 || p.statuses.sleep > 0) {
      p.vx *= 0.85;
      p.vz *= 0.85;
    }

    // Movement
    const speed = 4.6 * p.stats.moveSpeed * itemMoveMul(this) * (p.statuses.para > 0 ? 0.55 : 1) * (p.statuses.root > 0 ? 0.25 : 1);
    let mx = 0;
    let mz = 0;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (input.up) mz -= 1;
    if (input.down) mz += 1;
    const len = Math.hypot(mx, mz);
    p.stillT = len > 0 ? 0 : p.stillT + dt; // Metal Powder
    if (p.adrenalineT > 0) p.adrenalineT -= dt;
    if (p.fluteT > 0) p.fluteT -= dt;
    if (len > 0) {
      mx /= len;
      mz /= len;
      p.facingX = mx;
      p.facingZ = mz;
    }

    const targetVx = mx * speed;
    const targetVz = mz * speed;
    const accel = p.dashT > 0 ? 40 : 18;
    p.vx = lerp(p.vx, targetVx, Math.min(1, accel * dt));
    p.vz = lerp(p.vz, targetVz, Math.min(1, accel * dt));

    // Step counting for eggs (1 step ≈ 0.6 world units travelled).
    const moved = Math.hypot(p.vx, p.vz) * dt;
    p.steps += moved;
    while (p.steps >= 0.6) {
      p.steps -= 0.6;
      this.eggs.addSteps(1);
    }

    // Dash
    if (p.dashT > 0) p.dashT -= dt;
    if (input.dash && !p.grounded && !p.diving) {
      // Dive: Shift in the air slams down; the landing sends a shockwave sized by the fall.
      p.diving = true;
      p.vy = Math.min(p.vy, -22);
      p.iframes = Math.max(p.iframes, 0.15);
    } else if (input.dash && p.grounded && p.dashCd <= 0 && len > 0) {
      const shed = itemCount(this, "shed-shell"); // Shed Shell: longer invulnerable start, faster recharge
      p.dashT = 0.18;
      p.dashCd = shed ? 1.4 * 0.9 : 1.4;
      p.iframes = Math.max(p.iframes, shed ? 0.35 : 0.22);
      itemOnDash(this);
      p.vx = mx * speed * 2.6;
      p.vz = mz * speed * 2.6;
      this.burst(p.x, p.y + 0.8, p.z, 0xffffff, 10, "soft");
    }
    if (p.dashCd > 0) p.dashCd -= dt;

    // World events (chest/shop/altar) take priority over capture when nearby.
    if (input.capturePressed) {
      const ev = this.events.findNear(p.x, p.z);
      if (ev) {
        this.events.interact();
        input.capturePressed = false;
      } else if (this.capture.canThrow()) {
        this.capture.throw(); // a capture is not an upgrade: stats.items counts level-up items only
        input.capturePressed = false;
      }
    }

    // Jump
    if (input.jumpPressed && p.grounded && p.jumpsLeft > 0) {
      p.grounded = false;
      p.vy = 5.2 * p.stats.jumpHeight;
      p.jumpsLeft -= 1;
    }
    if (!p.grounded) {
      p.vy -= 16 * dt;
      p.y += p.vy * dt;
      p.peakY = Math.max(p.peakY ?? 0, p.y);
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.grounded = true;
        if (p.diving) this.diveLanding(p);
        p.peakY = 0;
        p.jumpsLeft = 1 + Math.round(p.stats.extraJumps);
      }
    }

    p.x += p.vx * dt;
    p.z += p.vz * dt;

    // World bounds
    const half = this.biome.size / 2;
    p.x = clamp(p.x, -half, half);
    p.z = clamp(p.z, -half, half);

    // Regen
    if (p.hp < p.maxHp && p.statuses.freeze <= 0) {
      p.regenAcc += p.stats.regen * dt;
      // Leftovers: heal ~1/16 of max HP per second.
      if (p.heldItem === "leftovers") p.regenAcc += (p.maxHp / 16) * dt;
      if (p.regenAcc >= 1) {
        const whole = Math.floor(p.regenAcc);
        p.regenAcc -= whole;
        this.healPlayer(whole); // through the healing stat like every other heal
      }
    }

    // Shield: with shieldMax (Zinc) it refills after 2.5 s without being hit, up to the cap in ~6 s;
    // without it any leftover shield just decays.
    if (p.stats.shieldMax > 0) {
      if (this.time - p.lastHitT > 2.5 && p.shield < p.stats.shieldMax) {
        p.shield = Math.min(p.stats.shieldMax, p.shield + (p.stats.shieldMax / 6) * dt);
      }
    } else if (p.shield > 0) p.shield = Math.max(0, p.shield - dt * 0.6);

    if (p.iframes > 0) p.iframes -= dt;
    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 4);
    if (p.attackT > 0) p.attackT -= dt;
    if (p.ultPoseT > 0) p.ultPoseT -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.ultCd > 0) p.ultCd -= dt;

    // Ultimate charge
    p.ultCharge = Math.min(1, p.ultCharge + dt * 0.035 * (itemCount(this, "poke-flute") ? 1.25 : 1));
    if (input.ultPressed && p.ultCharge >= 1 && p.ultCd <= 0) this.castUltimate();

    // Auto attacks
    for (const mv of p.moves) {
      mv.timer -= dt;
      if (mv.timer > 0) continue;
      const def = mv.def;
      const cd = Math.max(0.12, def.cd * mv.mods.cd / (p.stats.attackSpeed * itemAtkMul(this)));
      if (!this.hasTarget(def)) {
        mv.timer = 0.12;
        continue;
      }
      this.fireMove(mv);
      // Life Orb: each cast costs 2 % of max HP, never the last point.
      if (p.heldItem === "life-orb") p.hp = Math.min(p.hp, Math.max(1, p.hp - p.maxHp * 0.02)); // never heals below 1 HP
      mv.timer = cd;
      p.attackT = 0.22;
      this.opts.onShoot?.(def);
    }
  }

  hasTarget(def) {
    const p = this.player;
    if (["aura", "trail", "spin", "nova", "weather", "buff", "vortex"].includes(def.arch)) return true;
    return this.nearestEnemy(p.x, p.z, 26) >= 0;
  }

  nearestEnemy(x, z, maxDist, exclude = -1) {
    let best = -1;
    let bestD = maxDist * maxDist;
    for (const e of this.enemies) {
      if (!e.alive || e.id === exclude) continue;
      const d = dist2(x, z, e.x, e.z);
      if (d < bestD) {
        bestD = d;
        best = e.id;
      }
    }
    return best;
  }

  /* ------------------------------------------------------------- moves */

  /**
   * Direction the next attack should use. Like upstream, the player turns
   * toward the closest target instead of swinging where it happens to face.
   */
  aimDirection(range = 26) {
    const p = this.player;
    const target = this.nearestEnemy(p.x, p.z, range);
    if (target < 0) return { x: p.facingX, z: p.facingZ, target: -1 };
    const e = this.enemyById(target);
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    p.facingX = dx / d;
    p.facingZ = dz / d;
    return { x: p.facingX, z: p.facingZ, target };
  }

  /** The move's definition with its card upgrades folded in: pierce, crit, status chance, bounces. */
  effectiveDef(mv) {
    const m = mv.mods;
    const extraBounces = this.player.stats.bounces; // Smooth Rock: every projectile ricochets once more
    if (!m.pierce && !m.crit && !m.bounce && m.status === 1 && !extraBounces) return mv.def;
    return {
      ...mv.def,
      pierce: (mv.def.pierce ?? 0) + m.pierce,
      critBonus: (mv.def.critBonus ?? 0) + m.crit,
      statusChance: (mv.def.statusChance ?? 0) * m.status,
      bounces: (mv.def.bounces ?? 0) + m.bounce + extraBounces,
    };
  }

  /** Ricochet: aim the projectile at the nearest enemy it has not hit yet. False when there is none. */
  bounceProjectile(pr) {
    let best = null;
    let bestD = 14 * 14;
    for (const e of this.enemies) {
      if (!e.alive || e.dying > 0 || pr.hits.has(e.id)) continue;
      const d = dist2(pr.x, pr.z, e.x, e.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return false;
    const a = Math.atan2(best.z - pr.z, best.x - pr.x);
    pr.vx = Math.cos(a) * pr.speed;
    pr.vz = Math.sin(a) * pr.speed;
    pr.life = Math.max(pr.life, 0.6);
    return true;
  }

  fireMove(mv) {
    // Metronome (random): its data entry has no power; like the original, it calls a random damaging
    // move, fired through that move's archetype with Metronome's level and card upgrades.
    if (mv.def.arch === "random") {
      const pool = this.metronomePool();
      if (!pool.length) return;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      this.floater(this.player.x, this.player.y + 2.2, this.player.z, picked.name, "#ffe27a");
      return this.fireMove({ ...mv, def: picked });
    }
    const p = this.player;
    const def = this.effectiveDef(mv); // upgrades bought on the cards reach every hit and projectile
    const dmg = this.moveDamage(mv);
    const area = def.area * mv.mods.area * p.stats.area;
    const count = Math.max(1, Math.floor(def.count + mv.mods.count + (def.arch === "barrage" ? p.stats.projectiles : 0)));
    const speed = def.speed * mv.mods.speed * p.stats.projSpeed;
    const dur = def.dur * mv.mods.dur * p.stats.duration;
    const durScale = mv.mods.dur * p.stats.duration; // for attacks whose base duration is fixed here
    const color = this.typeRgb(def.type);
    const aim = this.aimDirection();
    const aimAngle = Math.atan2(aim.z, aim.x);

    switch (def.arch) {
      case "strike":
      case "spin": {
        const reach = 2.2 + area * 0.9;
        const arc = def.arch === "spin" ? TAU : 1.6;
        const targets = this.enemiesInCone(p.x, p.z, aim.x, aim.z, reach, arc);
        for (let i = 0; i < count; i++) for (const e of targets) this.hitEnemy(e, dmg, def); // +count = extra swings
        this.ring(p.x, p.y + 0.2, p.z, reach, color, 0.22);
        // A short lunge sells the melee swing.
        p.vx += aim.x * 5;
        p.vz += aim.z * 5;
        break;
      }
      case "bolt": {
        const target = aim.target;
        if (target < 0) break;
        const e = this.enemyById(target);
        const dir = Math.atan2(e.z - p.z, e.x - p.x);
        for (let i = 0; i < count; i++) {
          this.spawnProjectile({
            x: p.x,
            y: p.y + 0.9,
            z: p.z,
            angle: dir,
            speed,
            life: 1.8,
            radius: 0.35,
            dmg,
            def,
          });
        }
        break;
      }
      case "orb":
      case "lob":
      case "meteor":
      case "boomerang":
      case "drain": {
        const target = aim.target;
        const dir = target >= 0 ? Math.atan2(this.enemyById(target).z - p.z, this.enemyById(target).x - p.x) : aimAngle;
        for (let i = 0; i < count; i++) {
          // The first projectile flies at the target, extras fan out around it: the old symmetric fan had
          // no centre with an even count, so +1 projectile made the move miss a target straight ahead.
          const spread = Math.ceil(i / 2) * (i % 2 ? 0.45 : -0.45);
          this.spawnProjectile({
            x: p.x,
            y: p.y + 0.9,
            z: p.z,
            angle: dir + spread,
            // A bomb is thrown to land on the target: time in the air from the launch height (vy 6, gravity 18,
            // lands at y 0.1; about 0.72 s from the ground, longer mid-jump). 40 u/s covers the 26 u aim range.
            speed: def.arch === "lob" ? clamp((target >= 0 ? dist(p.x, p.z, this.enemyById(target).x, this.enemyById(target).z) : 6) / ((6 + Math.sqrt(36 + 36 * (p.y + 0.8))) / 18), 2, 40) : speed,
            life: 2.2,
            radius: def.arch === "lob" ? 0.45 : 0.55,
            dmg,
            def,
            lob: def.arch === "lob",
            explodeR: def.arch === "lob" ? 2.2 * Math.sqrt(area) : 1.6 * Math.sqrt(area),
            homing: def.arch === "drain" ? 0.9 : 0,
            returnHome: def.arch === "boomerang",
          });
        }
        break;
      }
      case "barrage": {
        const target = aim.target;
        const base = target >= 0 ? Math.atan2(this.enemyById(target).z - p.z, this.enemyById(target).x - p.x) : aimAngle;
        for (let i = 0; i < count; i++) {
          const spread = (i / Math.max(1, count) - 0.5) * 1.1;
          this.spawnProjectile({ x: p.x, y: p.y + 0.9, z: p.z, angle: base + spread, speed, life: 1.1, radius: 0.3, dmg, def });
        }
        break;
      }
      case "homing": {
        for (let i = 0; i < count; i++) {
          this.spawnProjectile({
            x: p.x,
            y: p.y + 0.9,
            z: p.z,
            angle: aimAngle + (i / count) * TAU,
            speed,
            life: 3,
            radius: 0.4,
            dmg,
            def,
            homing: 2.4,
          });
        }
        break;
      }
      case "beam": {
        const target = aim.target;
        if (target < 0) break;
        const e = this.enemyById(target);
        const baseDir = Math.atan2(e.z - p.z, e.x - p.x);
        const length = 30;
        for (let i = 0; i < count; i++) {
          const dir = baseDir + Math.ceil(i / 2) * (i % 2 ? 0.35 : -0.35); // +count = extra beams fanned around the aimed one
          for (const en of this.enemies) {
            if (!en.alive) continue;
            const rx = en.x - p.x;
            const rz = en.z - p.z;
            const along = rx * Math.cos(dir) + rz * Math.sin(dir);
            if (along < 0 || along > length) continue;
            const perp = Math.abs(rx * -Math.sin(dir) + rz * Math.cos(dir));
            if (perp > 0.8 + area) continue;
            this.hitEnemy(en, dmg, def);
          }
          this.beam(p.x, p.y + 1, p.z, dir, length, color);
        }
        break;
      }
      case "cone": {
        const dir = aimAngle;
        const range = 6 + area * 2;
        for (const en of this.enemies) {
          if (!en.alive) continue;
          const rx = en.x - p.x;
          const rz = en.z - p.z;
          const along = rx * Math.cos(dir) + rz * Math.sin(dir);
          if (along < 0 || along > range) continue;
          const perp = Math.abs(rx * -Math.sin(dir) + rz * Math.cos(dir));
          if (perp > along * 0.55 + 0.8) continue;
          this.hitEnemy(en, dmg, def);
        }
        this.cone(p.x, p.y + 0.9, p.z, dir, range, color);
        break;
      }
      case "nova": {
        const radius = 3 + area * 2.2;
        for (const en of this.enemies) {
          if (!en.alive) continue;
          if (dist(en.x, en.z, p.x, p.z) <= radius) this.hitEnemy(en, dmg, def);
        }
        this.ring(p.x, p.y + 0.2, p.z, radius, color, 0.4);
        this.shake(0.18);
        break;
      }
      case "aura": {
        const radius = 2.2 + area * 1.6;
        for (const en of this.enemies) {
          if (!en.alive) continue;
          if (dist(en.x, en.z, p.x, p.z) <= radius) this.hitEnemy(en, dmg, def);
        }
        this.ring(p.x, p.y + 0.2, p.z, radius, color, 0.2);
        break;
      }
      case "orbit": {
        // Orbs circle the player for the move's duration and hit what they touch (each enemy at most
        // every 0.5 s per orb). It used to sample the ring once per cast, so it almost never hit.
        const radius = 1.6 + area * 0.5;
        for (let i = 0; i < count; i++) {
          const pr = this.spawnProjectile({ x: p.x, y: p.y + 0.9, z: p.z, angle: 0, speed: 0, life: Math.max(1, dur), radius: 0.6, dmg, def });
          if (!pr) break; // projectile cap reached
          pr.pierce = 1e9; // an orb keeps circling through what it hits
          pr.orbit = { angle: (i / count) * TAU, radius, w: 3 * mv.mods.speed * p.stats.projSpeed, hitT: new Map() }; // +speed = faster orbit
        }
        break;
      }
      case "chain": {
        // Each jump goes to the nearest enemy not hit yet (the old code re-hit the same
        // target: from its own position, it was always the nearest). +area = longer jumps.
        let from = { x: p.x, z: p.z };
        const hit = new Set();
        const range2 = (area * 2) ** 2; // base 8 x 2 = 16 units
        for (let i = 0; i < count; i++) {
          let e = null;
          let bestD = range2;
          for (const en of this.enemies) {
            if (!en.alive || hit.has(en.id)) continue;
            const d = dist2(from.x, from.z, en.x, en.z);
            if (d < bestD) {
              bestD = d;
              e = en;
            }
          }
          if (!e) break;
          this.hitEnemy(e, dmg, def);
          this.beam(from.x, p.y + 1, from.z, Math.atan2(e.z - from.z, e.x - from.x), dist(from.x, from.z, e.x, e.z), color);
          hit.add(e.id);
          from = { x: e.x, z: e.z };
        }
        break;
      }
      case "smite": {
        // +count = more strikes from the sky, each on the next nearest enemy
        const struck = new Set();
        for (let i = 0; i < count; i++) {
          let t = -1;
          let bestD = 26 * 26;
          for (const en of this.enemies) {
            if (!en.alive || struck.has(en.id)) continue;
            const d = dist2(p.x, p.z, en.x, en.z);
            if (d < bestD) {
              bestD = d;
              t = en.id;
            }
          }
          if (t < 0) break;
          const e = this.enemyById(t);
          struck.add(t);
          this.hitEnemy(e, dmg * 1.4, def);
          // +area = splash around each strike
          for (const en of this.enemies) if (en.alive && en !== e && dist(en.x, en.z, e.x, e.z) <= area) this.hitEnemy(en, dmg * 0.7, def);
          this.beam(p.x, p.y + 1, p.z, Math.atan2(e.z - p.z, e.x - p.x), dist(p.x, p.z, e.x, e.z), color);
        }
        break;
      }
      case "dash": {
        const t = this.nearestEnemy(p.x, p.z, 10);
        const dir = t >= 0 ? Math.atan2(this.enemyById(t).z - p.z, this.enemyById(t).x - p.x) : Math.atan2(p.facingZ, p.facingX);
        const len = 4 + area * 2;
        for (const en of this.enemies) {
          if (!en.alive) continue;
          const rx = en.x - p.x;
          const rz = en.z - p.z;
          const along = rx * Math.cos(dir) + rz * Math.sin(dir);
          if (along < 0 || along > len) continue;
          if (Math.abs(rx * -Math.sin(dir) + rz * Math.cos(dir)) > 1.6) continue;
          for (let i = 0; i < count; i++) this.hitEnemy(en, dmg, def); // +count = extra charges
        }
        this.beam(p.x, p.y + 0.8, p.z, dir, len, color);
        break;
      }
      case "vortex": {
        const radius = 3 + area * 2;
        for (const en of this.enemies) {
          if (!en.alive) continue;
          const d = dist(en.x, en.z, p.x, p.z);
          if (d > radius || d < 0.2) continue;
          const pull = (1 - d / radius) * 9 * dtSafe(this);
          en.vx -= ((en.x - p.x) / d) * pull;
          en.vz -= ((en.z - p.z) / d) * pull;
          for (let i = 0; i < count; i++) this.hitEnemy(en, dmg * 0.35, def, true); // +count = extra pulls
        }
        this.ring(p.x, p.y + 0.2, p.z, radius, color, 0.3);
        break;
      }
      case "wave": {
        const radius = 4 + area * 2.4;
        for (const en of this.enemies) {
          if (!en.alive) continue;
          if (dist(en.x, en.z, p.x, p.z) <= radius) for (let i = 0; i < count; i++) this.hitEnemy(en, dmg, def); // +count = extra waves
        }
        this.ring(p.x, p.y + 0.2, p.z, radius, color, 0.45);
        break;
      }
      case "trail": {
        // +dur stretches the 3 s base; +status scales the zone's 25 % per-tick chance.
        this.zones.push({ x: p.x, z: p.z, r: 1.2 + area, life: 3 * durScale, tick: 0, dmg: dmg * 0.4, type: def.type, status: def.status, statusChance: 0.25 * mv.mods.status });
        break;
      }
      case "trap": {
        for (let i = 0; i < count; i++) {
          const a = (i / count) * TAU;
          const off = i === 0 ? 0 : 2.5; // +count = extra traps ringed around the first
          this.zones.push({ x: p.x + Math.cos(a) * off, z: p.z + Math.sin(a) * off, r: 1.4 + area, life: 6 * durScale, tick: 0, dmg: dmg * 0.35, type: def.type, status: def.status, statusChance: 0.25 * mv.mods.status, snare: true });
        }
        break;
      }
      case "weather": {
        this.weather = def.weather === "rain" ? "rain" : def.weather === "sun" ? "sun" : "sand";
        this.weatherT = 12 * durScale; // +dur = longer weather
        this.banner(def.name + "!");
        break;
      }
      case "buff": {
        p.stats.damage *= 1.12;
        p.stats.attackSpeed *= 1.08;
        this.banner(def.name + "!");
        break;
      }
      case "random":
      default: {
        const target = this.nearestEnemy(p.x, p.z, 26);
        if (target < 0) break;
        const e = this.enemyById(target);
        const dir = Math.atan2(e.z - p.z, e.x - p.x);
        for (let i = 0; i < count; i++) {
          const spread = Math.ceil(i / 2) * (i % 2 ? 0.3 : -0.3); // +count = extra projectiles fanned around the aimed one
          // +area widens the projectile, +dur lets it fly longer
          this.spawnProjectile({ x: p.x, y: p.y + 0.9, z: p.z, angle: dir + spread, speed, life: 1.5 * durScale, radius: 0.4 * mv.mods.area * p.stats.area, dmg, def });
        }
      }
    }
  }

  /** Damaging moves Metronome can call (built once). */
  metronomePool() {
    return (this._metronomePool ??= this.data.moves
      .map((m) => buildMoveDef(m, this.rules))
      .filter((d) => d && d.dmg > 0 && !["random", "buff", "weather", "fusion"].includes(d.arch)));
  }

  moveDamage(mv) {
    const p = this.player;
    const def = mv.def;
    return def.dmg * 1.3 * mv.mods.dmg * (1 + (mv.level - 1) * 0.04);
  }

  /* -------------------------------------------------------- projectiles */

  spawnProjectile(o) {
    if (this.projectiles.length > 600) return null;
    const speed = o.speed || 18;
    const pr = {
      id: nextId++,
      x: o.x,
      y: o.y,
      z: o.z,
      vx: Math.cos(o.angle) * speed,
      vy: o.lob ? 6 : 0,
      vz: Math.sin(o.angle) * speed,
      speed,
      life: o.life ?? 2,
      radius: o.radius ?? 0.4,
      dmg: o.dmg,
      def: o.def,
      pierce: o.def.pierce ?? 0,
      bounces: o.def.bounces ?? 0,
      homing: o.homing ?? 0,
      explodeR: o.explodeR ?? 0,
      lob: !!o.lob,
      returnHome: !!o.returnHome,
      age: 0,
      hits: new Set(),
    };
    this.projectiles.push(pr);
    return pr;
  }

  updateProjectiles(dt) {
    const list = this.projectiles;
    for (let i = list.length - 1; i >= 0; i--) {
      const pr = list[i];
      if (pr.cancelled) {
        list.splice(i, 1); // a boss attack cancelled by Boss.cancelAttacks(): never collides
        continue;
      }
      pr.age += dt;
      pr.life -= dt;

      if (pr.homing > 0) {
        const t = this.nearestEnemy(pr.x, pr.z, 18);
        if (t >= 0) {
          const e = this.enemyById(t);
          const want = Math.atan2(e.z - pr.z, e.x - pr.x);
          const cur = Math.atan2(pr.vz, pr.vx);
          let diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
          const na = cur + clamp(diff, -pr.homing * dt, pr.homing * dt);
          pr.vx = Math.cos(na) * pr.speed;
          pr.vz = Math.sin(na) * pr.speed;
        }
      }

      if (pr.orbit) {
        const o = pr.orbit;
        const p = this.player;
        o.angle += o.w * dt;
        pr.x = p.x + Math.cos(o.angle) * o.radius;
        pr.z = p.z + Math.sin(o.angle) * o.radius;
        pr.y = p.y + 0.9;
        // Each enemy can be hit again by this orb 0.5 s after its last hit.
        for (const [id, t] of o.hitT) {
          if (this.time - t >= 0.5) {
            o.hitT.delete(id);
            pr.hits.delete(id);
          }
        }
      } else if (pr.lob) {
        // The bomb arcs toward its target (it used to rise and fall in place, exploding at the player).
        pr.x += pr.vx * dt;
        pr.z += pr.vz * dt;
        pr.vy -= 18 * dt;
        pr.y += pr.vy * dt;
        if (pr.y <= 0.1) {
          this.explode(pr);
          list.splice(i, 1);
          continue;
        }
      } else {
        pr.x += pr.vx * dt;
        pr.z += pr.vz * dt;
        pr.y += pr.vy * dt;
        pr.vy -= 9 * dt;
        if (pr.y < 0) pr.y = 0;
      }

      if (pr.returnHome && pr.age > 0.6) {
        const p = this.player;
        const d = dist(pr.x, pr.z, p.x, p.z);
        if (d < 1) {
          list.splice(i, 1);
          continue;
        }
        const want = Math.atan2(p.z - pr.z, p.x - pr.x);
        pr.vx = lerp(pr.vx, Math.cos(want) * pr.speed, 0.08);
        pr.vz = lerp(pr.vz, Math.sin(want) * pr.speed, 0.08);
      }

      // Collision
      if (pr.hostile) {
        const p = this.player;
        const rr = pr.radius + p.radius;
        if (dist2(pr.x, pr.z, p.x, p.z) <= rr * rr) {
          this.hitPlayer(pr.dmg, null, this.enemyById(pr.owner));
          list.splice(i, 1);
          continue;
        }
      } else if (!pr.lob) {
        // A bomb is in the air until it lands (and explodes there); it does not collide on the way.
        for (const e of this.enemies) {
          if (!e.alive || pr.hits.has(e.id)) continue;
          const rr = pr.radius + e.radius;
          if (dist2(pr.x, pr.z, e.x, e.z) > rr * rr) continue;
          pr.hits.add(e.id);
          pr.orbit?.hitT.set(e.id, this.time);
          this.hitEnemy(e, pr.dmg, pr.def);
          if (pr.explodeR > 0) {
            this.explode(pr);
            break;
          }
          if (pr.bounces > 0 && this.bounceProjectile(pr)) {
            pr.bounces--;
            break;
          }
          if (pr.pierce > 0) pr.pierce--;
          else {
            list.splice(i, 1);
            break;
          }
        }
      }
      if (list[i] !== pr) continue;

      if (pr.life <= 0) {
        if (pr.explodeR > 0) this.explode(pr);
        list.splice(i, 1);
      }
    }

    // Ground zones
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (z.cancelled) {
        this.zones.splice(i, 1); // a boss pool cancelled by Boss.cancelAttacks(): never ticks again
        continue;
      }
      z.life -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.4;
        // Hostile pools (boss attacks) hurt only the player: through hitEnemy they counted as player
        // damage to the horde and to the boss itself (stats, lifesteal, items, even weakening it).
        for (const e of z.hostile ? [] : this.enemies) {
          if (!e.alive) continue;
          if (dist2(e.x, e.z, z.x, z.z) > z.r * z.r) continue;
          this.hitEnemy(e, z.dmg, { type: z.type, cls: "special", status: z.status, statusChance: z.statusChance ?? 0.25, slot: -1 });
          if (z.snare) e.vx *= 0.5;
        }
        if (z.hostile && !z.cancelled) {
          const p = this.player;
          if (dist2(p.x, p.z, z.x, z.z) <= z.r * z.r) this.hitPlayer(z.dmg * dt, null, this.enemyById(z.owner));
        }
      }
      if (z.life <= 0) this.zones.splice(i, 1);
    }
  }

  explode(pr) {
    const r = pr.explodeR;
    this.ring(pr.x, 0.2, pr.z, r, this.typeRgb(pr.def.type), 0.3);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (dist2(e.x, e.z, pr.x, pr.z) > r * r) continue;
      this.hitEnemy(e, pr.dmg, pr.def);
    }
    this.shake(0.1);
  }

  /* ------------------------------------------------------------ combat */

  hitEnemy(e, dmg, def, noReact = false) {
    if (!e.alive || e.dying > 0) return;
    const p = this.player;
    const s = p.stats;
    let amount = dmg;
    // Guard against projectiles with no def (e.g. ally projectiles).
    const cls = def ? def.cls : "special";
    const dtype = def ? def.type : "normal";
    amount *= s.damage * (cls === "physical" ? s.physical : s.special);
    // Choice Band: +50% damage.
    if (p.heldItem === "choice-band") amount *= 1.5;
    if (p.heldItem === "life-orb") amount *= 1.3; // paid in HP on each cast (fireMove)

    if (p.types.includes(dtype)) amount *= 1.25;
    amount *= s.typeBoost?.[dtype] ?? 1;

    const eff = effectiveness(this.data.types, dtype, e.types);
    amount *= eff;
    if (eff > 1.01) amount *= s.superEffective;

    if (this.weather === "rain" && (dtype === "water" || dtype === "electric")) amount *= 1.3;
    if (this.weather === "sun" && (dtype === "fire" || dtype === "grass")) amount *= 1.3;
    if (this.weather === "sand" && dtype === "rock") amount *= 1.3;

    if (["elite", "alpha", "totem", "summoner", "boss"].includes(e.tier)) amount *= s.eliteDamage;
    amount *= itemDamageMul(this, e, def);

    if (!noReact) {
      const critChance = s.critChance + s.megaCrit + (def?.critBonus ?? 0);
      if (Math.random() < critChance) {
        amount *= s.critDamage;
        this.floater(e.x, e.y + 1.4, e.z, Math.round(amount), "#ffe27a");
        this.burst(e.x, e.y + 1, e.z, 0xffe27a, 8, "star");
      }
      amount *= itemBonk(this, e);
    }

    if (e.statuses.sleep > 0) amount *= 1.8;
    if (e.statuses.freeze > 0) amount *= 1.2;
    if (e.statuses.curse > 0) amount *= 1.25;
    const reaction = findReaction(e, dtype);
    if (reaction) amount *= reaction.mul;

    // Base for burn/poison DPS: without the Silph Scope mark (the tick applies it) and before the boss cap
    // (the ticks go through the cap themselves).
    const dotBase = e.marked ? amount / 1.4 : amount;
    // Boss budget: burst cap, anti-stall exhaust, 15% while a telegraph winds up.
    if (this.boss.index === e.id && this.boss.alive) amount = this.boss.capDamage(amount * this.boss.hitMul());

    e.hp -= amount;
    e.flash = 1;
    this.stats.damage += amount;
    this.opts.onHit?.();
    if (e.statuses.sleep > 0) e.statuses.sleep = 0; // the hit that lands the x1.8 also wakes it
    if (reaction) applyReaction(this, e, reaction, amount);

    if (def?.drain) this.healPlayer(amount * def.drain);
    if (s.lifesteal > 0 && Math.random() < 0.2) this.healPlayer(amount * s.lifesteal);
    itemOnHit(this, e, amount);

    // Status application
    if (def?.status && def.statusChance > 0 && Math.random() < def.statusChance * s.statusChance && applyStatus(this, e, def.status)) {
      const key = statusKey(def.status);
      if (key === "burn") e.burnDps = Math.max(e.burnDps ?? 0, dotBase * 0.06);
      if (key === "poison") e.poisonDps = Math.max(e.poisonDps ?? 0, dotBase * 0.05);
    }

    // Flinch (King's Rock): a chance to stop the target for half a second; bosses shrug it off.
    if (s.flinch > 0 && e.hp > 0 && !isBossTier(e.tier) && Math.random() < s.flinch) {
      e.statuses.flinch = Math.max(e.statuses.flinch ?? 0, 0.5);
    }

    if (e.hp <= 0) this.killEnemy(e, def);
    this.maybeWeaken(e);
  }

  /** Capture hook shared by every damage path (hits, items' area damage, burn/poison, thorns): an alpha or boss left under the threshold becomes capturable. */
  maybeWeaken(e) {
    if (e.hp > 0 && e.hp <= e.maxHp * this.rules.capture.weakenHpPct && CAPTURABLE_TIERS.has(e.tier)) this.capture.weaken(e);
  }

  /** `source` is who touched the player (type chart, thorns); `attacker` who fired a projectile or pool. */
  hitPlayer(amount, source, attacker = source) {
    const p = this.player;
    // The first terminal state of a step is final: a meteor timer that fires after the boss fell
    // in the same step cannot turn the victory into a death.
    if (p.dead || p.iframes > 0 || this.state !== "running") return;
    let dmg = amount;
    if (attacker?.statuses?.charm > 0) dmg *= 0.6; // Charmed: -40 % on every attack, contact or special
    // Enemy type effectiveness against the player's typing.
    if (source?.types?.length) {
      const eff = effectiveness(this.data.types, source.types[0], p.types);
      dmg *= clamp(eff, 0.5, 1.6);
    }
    // Upstream armour curve: 1 - armor / (armor + 45).
    const armor = p.stats.armor * itemArmorMul(this);
    dmg *= 1 - armor / (armor + 45);
    if (p.statuses.freeze > 0) dmg *= 1.15;
    if (p.ability?.dmgTaken) dmg *= p.ability.dmgTaken;
    if (p.stats.evasion > 0 && Math.random() < p.stats.evasion) {
      this.floater(p.x, p.y + 2, p.z, "errou", "#9ca3ff");
      return;
    }
    if (itemBlockHit(this)) return;
    p.lastHitT = this.time;
    if (p.overhealHp > 0) {
      // Overheal soaks damage before the shield.
      const absorbed = Math.min(p.overhealHp, dmg);
      p.overhealHp -= absorbed;
      dmg -= absorbed;
    }
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
    }
    // Thorns (Rocky Helmet, Protector, Sticky Barb): flat damage back to the attacker, through the boss budget.
    if (p.stats.thorns > 0 && source?.alive && source.hp > 0 && !(source.dying > 0)) {
      const thorns = p.stats.thorns * (source.marked ? 1.4 : 1); // Silph Scope
      const back = source.id === this.boss.index ? this.boss.capDamage(thorns * this.boss.hitMul()) : thorns;
      source.hp -= back;
      if (source.hp <= 0) this.killEnemy(source, { type: "normal", cls: "physical" });
      else this.maybeWeaken(source);
    }
    if (dmg > 0) {
      p.hp -= dmg;
      p.flash = 1;
      p.hurtT = 0.3;
      p.iframes = 0.45;
      this.floater(p.x, p.y + 2, p.z, "-" + Math.round(dmg), "#ff6b6b");
      this.shake(0.12);
      this.opts.onHurt?.();
    }
    if (dmg > 0) {
      p.streak = 0; // Cell Battery
      p.adrenalineT = 3; // Adrenaline Orb
    }
    if (p.hp <= 0) {
      if (itemSurvive(this)) return;
      p.hp = 0;
      p.dead = true;
      this.state = "dead";
      this.opts.onDeath?.();
    }
  }

  /** Every heal goes through here, so the healing stat (Big Root, abilities) applies exactly once. */
  healPlayer(amount) {
    const p = this.player;
    const heal = amount * p.stats.healing;
    const room = p.maxHp - p.hp;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    // Overheal (Enigma Berry): what does not fit becomes extra HP, up to that share of max HP.
    if (heal > room && p.stats.overheal > 0) p.overhealHp = Math.min(p.maxHp * p.stats.overheal, (p.overhealHp ?? 0) + heal - Math.max(0, room));
  }

  /** The dive lands: a shockwave whose damage and radius grow with the height it fell from. */
  diveLanding(p) {
    p.diving = false;
    const height = p.peakY ?? 0;
    const radius = 2.5 + height * 1.5;
    const dmg = (8 + 2 * p.level) * p.stats.damage * p.stats.physical * (1 + height);
    this.ring(p.x, 0.2, p.z, radius, 0xffffff, 0.35);
    this.shake(0.25);
    this.hitAround(p.x, p.z, radius, dmg, { type: p.types[0], cls: "physical" });
    this.stats.dives = (this.stats.dives ?? 0) + 1;
  }

  /** Flat area damage for item effects: no player multipliers, through the boss budget, kills handled. */
  hitAround(x, z, radius, dmg, def, exceptId = -1, onlyId = -1) {
    const r2 = radius * radius;
    for (const e of this.enemies) {
      if (!e.alive || e.dying > 0 || e.id === exceptId || (onlyId >= 0 && e.id !== onlyId)) continue;
      if (onlyId < 0 && dist2(e.x, e.z, x, z) > r2) continue;
      // Silph Scope mark; a sleeping target takes x1.8 and wakes, as from any direct hit.
      const asleep = e.statuses.sleep > 0;
      if (asleep) e.statuses.sleep = 0;
      const d = dmg * (e.marked ? 1.4 : 1) * (asleep ? 1.8 : 1);
      const through = this.boss.index === e.id && this.boss.alive ? this.boss.capDamage(d * this.boss.hitMul()) : d;
      e.hp -= through;
      e.flash = 1;
      this.stats.damage += through;
      if (e.hp <= 0) this.killEnemy(e, def);
      else this.maybeWeaken(e);
    }
  }

  /* ----------------------------------------------------------- enemies */

  updateEnemies(dt) {
    const p = this.player;
    const bossId = this.boss.alive ? this.boss.index : -1;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.animT += dt;
      e.flash = Math.max(0, e.flash - dt * 4);
      if (e.dying > 0) {
        e.dying -= dt;
        if (e.dying <= 0) e.alive = false;
        continue;
      }

      // Status timers
      for (const k of Object.keys(e.statuses)) {
        if (e.statuses[k] > 0) e.statuses[k] = Math.max(0, e.statuses[k] - dt);
      }
      // Damage over time also goes through the boss budget (no on-hit effects, so not via hitEnemy).
      const tick = (dmg) => {
        const d = dmg * (e.marked ? 1.4 : 1); // Silph Scope: the mark takes more damage from everything
        return e.id === bossId ? this.boss.capDamage(d * this.boss.hitMul()) : d;
      };
      if (e.burnDps > 0 && e.statuses.burn > 0) {
        e.hp -= tick(e.burnDps * dt);
        if (e.hp <= 0) {
          this.killEnemy(e, { type: "fire", cls: "special" });
          continue;
        }
      }
      if (e.poisonDps > 0 && e.statuses.poison > 0) {
        e.hp -= tick(e.poisonDps * dt);
        if (e.hp <= 0) {
          this.killEnemy(e, { type: "poison", cls: "special" });
          continue;
        }
      }
      if ((e.burnDps > 0 && e.statuses.burn > 0) || (e.poisonDps > 0 && e.statuses.poison > 0)) this.maybeWeaken(e);

      // Frozen, asleep, rooted or flinching: stopped in place, no chase and no contact damage until
      // the timer runs out. (Damping the velocity and then chasing again, as before, left frozen and
      // sleeping enemies walking at about a third of their speed.)
      if (e.statuses.freeze > 0 || e.statuses.sleep > 0 || e.statuses.stun > 0 || e.statuses.flinch > 0) {
        e.vx *= 0.8;
        e.vz *= 0.8;
        if (e.atkCd > 0) e.atkCd -= dt;
        continue;
      }

      // A weakened (capturable) target stops fighting: no chase, no contact damage.
      if (e.captureReady) {
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        if (e.atkCd > 0) e.atkCd -= dt;
        continue;
      }

      // Chase (paralysed: half speed; rooted: -65 %)
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      const speed = e.speed * (e.statuses.para > 0 ? 0.5 : 1) * (e.statuses.root > 0 ? 0.35 : 1);
      const half = this.biome.size / 2;
      if (e.statuses.confusion > 0) {
        // Confused: wanders, never bites the player, and hurts the enemies it bumps into.
        e.wanderA = (e.wanderA ?? Math.random() * TAU) + (Math.random() - 0.5) * 4 * dt;
        e.vx = lerp(e.vx, Math.cos(e.wanderA) * speed, Math.min(1, 6 * dt));
        e.vz = lerp(e.vz, Math.sin(e.wanderA) * speed, Math.min(1, 6 * dt));
        e.x = clamp(e.x + e.vx * dt, -half, half);
        e.z = clamp(e.z + e.vz * dt, -half, half);
        if (e.atkCd > 0) e.atkCd -= dt;
        else {
          const other = this.enemies.find((n) => n !== e && n.alive && !(n.dying > 0) && Math.hypot(n.x - e.x, n.z - e.z) < e.radius + n.radius);
          if (other) {
            e.atkCd = 0.4;
            this.hitAround(other.x, other.z, 0.1, e.dmg * this.difficulty.enemyDamage, { type: e.types[0], cls: "physical" }, -1, other.id);
          }
        }
        continue;
      }
      e.vx = lerp(e.vx, (dx / d) * speed, Math.min(1, 6 * dt));
      e.vz = lerp(e.vz, (dz / d) * speed, Math.min(1, 6 * dt));
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      e.x = clamp(e.x, -half, half);
      e.z = clamp(e.z, -half, half);

      // Contact damage lands as discrete hits, upstream style. The shove comes with the hit:
      // shoving 0.4 units on every frame (24 units/s per touching enemy) pinned the player
      // between two enemies with no way to walk out — the bot died that way at 19 s.
      const touch = e.radius + p.radius;
      // Charmed: common enemies stop attacking, the rest hit 40 % softer.
      const charmed = e.statuses.charm > 0;
      if (d < touch && e.atkCd <= 0 && !(charmed && e.tier === "normal")) {
        e.atkCd = 0.4;
        this.hitPlayer(e.dmg * this.difficulty.enemyDamage, e); // charm's -40 % applies in hitPlayer
        // push the player away a bit, never out of the arena
        p.x = clamp(p.x - (dx / d) * 0.6, -half, half);
        p.z = clamp(p.z - (dz / d) * 0.6, -half, half);
      }
      if (e.atkCd > 0) e.atkCd -= dt;
    }

    // Drop dead entries every frame: the director's population cap and spawnEnemy's cap both
    // count list entries, so leaving corpses in the list starves the arena of spawns.
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
  }

  killEnemy(e, def) {
    if (!e.alive || e.dying > 0) return;
    this.capture.attempts.delete(e.id); // its capture bonus dies with it, whatever state it was in
    e.dying = 0.35;
    e.hp = 0;
    this.stats.kills++;
    const shinyMul = e.shiny ? 1 + SHINY_XP_BONUS : 1;
    this.stats.dust += Math.round(e.xp * 0.2 * shinyMul);
    if (e.shiny) this.banner(`Brilhou! ${e.species.name} shiny derrotado!`);
    this.player.ultCharge = Math.min(1, this.player.ultCharge + 0.006);
    this.opts.onKill?.();
    if (this.tower) this.tower.countKill();
    this.player.streak++; // Cell Battery
    itemOnKill(this, e);

    const p = this.player;
    this.burst(e.x, e.y + 0.8, e.z, this.typeRgb(e.types[0]), 10, "star");

    // Loot (Poké Radar: `powerup` widens every drop bracket)
    const roll = Math.random() / p.stats.powerup;
    if (e.tier === "elite" || e.tier === "alpha" || e.tier === "boss") {
      // Free elites (director.eliteRoll and the final swarm) are common: a guaranteed level each
      // would double the levelling pace, so theirs is a 15 % candy. Wave elites, alphas and bosses keep theirs.
      if (!e.freeElite || Math.random() < 0.15 * p.stats.powerup) this.spawnPickup(e.x, e.z, "candy", 1);
      this.spawnPickup(e.x, e.z, "heal", 1);
    } else if (roll < 0.055) {
      this.spawnPickup(e.x, e.z, "heal", 1);
    } else if (roll < 0.085) {
      this.spawnPickup(e.x, e.z, "coin", 1);
    } else if (roll < 0.095) {
      this.spawnPickup(e.x, e.z, "magnet", 1);
    }
    this.spawnPickup(e.x, e.z, "xp", e.xp);

    // Bosses and alphas can drop a rare candy
    if ((e.tier === "alpha" || e.tier === "boss") && Math.random() < 0.4 * p.stats.powerup) {
      this.spawnPickup(e.x, e.z, "candy", 1);
    }
  }

  /* ---------------------------------------------------------- pickups */

  spawnPickup(x, z, kind, value) {
    if (this.pickups.length > PICKUP_CAP) return;
    this.pickups.push({ id: nextId++, x, z, y: 0.4, kind, value, t: 0, magnet: false, life: 45 });
  }

  updatePickups(dt) {
    const p = this.player;
    const range = p.stats.pickupRange;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      pk.life -= dt;
      if (pk.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      const d = dist(pk.x, pk.z, p.x, p.z);
      if (pk.magnet || d < range) pk.magnet = true;
      if (pk.magnet) {
        const a = Math.atan2(p.z - pk.z, p.x - pk.x);
        const pull = pk.magnet ? 13 : 0;
        pk.x += Math.cos(a) * pull * dt;
        pk.z += Math.sin(a) * pull * dt;
        if (d < 0.9) {
          this.collect(pk);
          this.pickups.splice(i, 1);
          continue;
        }
      }
    }
  }

  collect(pk) {
    const p = this.player;
    this.opts.onPickup?.(pk);
    switch (pk.kind) {
      case "xp":
        this.addXp(pk.value * p.stats.xpGain);
        break;
      case "coin":
        this.stats.gold += p.stats.gold;
        break;
      case "heal":
        this.healPlayer(p.maxHp * 0.25);
        this.burst(p.x, p.y + 1, p.z, 0x5cd6a0, 10, "heart");
        break;
      case "magnet":
        for (const q of this.pickups) q.magnet = true;
        break;
      case "candy":
        this.useRareCandy();
        break;
    }
  }

  /* --------------------------------------------------------- levelling */

  /**
   * The single level-up path. Every source of levels (XP orbs, Rare Candy from
   * the ground or from the shop) goes through here so level, xp, xpNext, stats,
   * kit moves, run stats and the upgrade-choice callback never drift apart.
   * Returns the number of levels gained.
   */
  addXp(amount) {
    const p = this.player;
    let gained = 0;
    p.xp += amount;
    while (p.xp >= p.xpNext && p.level < MAX_LEVEL) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = xpForLevel(p.level);
      this.recompute(p);
      this.learnKitMoves(p);
      this.stats.levels++;
      gained++;
      this.opts.onLevelUp?.();
    }
    // At the cap the bar simply stays full.
    if (p.level >= MAX_LEVEL) p.xp = Math.min(p.xp, p.xpNext);
    return gained;
  }

  /**
   * Rare Candy rule: grant exactly one level's worth of XP (the current xpNext),
   * so the player goes up one level and keeps the XP already earned inside the
   * level. Returns false at the level cap, when nothing can be applied.
   */
  useRareCandy() {
    const p = this.player;
    if (p.level >= MAX_LEVEL) return false;
    this.addXp(p.xpNext);
    return true;
  }

  /* --------------------------------------------------------- ultimate */

  castUltimate() {
    const p = this.player;
    p.ultCharge = 0;
    p.ultCd = 14;
    itemOnUltimate(this);
    p.ultPoseT = 1;
    const type = p.types[0];
    const color = this.typeRgb(type);
    const radius = 8;
    this.ring(p.x, 0.3, p.z, radius, color, 0.6);
    this.shake(0.3);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (dist2(e.x, e.z, p.x, p.z) > radius * radius) continue;
      this.hitEnemy(e, 220 + p.level * 26, { type, cls: "special", statusChance: 0.3, status: this.rules.statusByType[type] });
    }
    this.healPlayer(p.maxHp * 0.15);
    this.banner(this.ultimateName());
    this.opts.onUltimate?.();
  }

  ultimateName() {
    const names = {
      normal: "Total Annihilation",
      fighting: "Shattering Blow",
      flying: "Sky Sovereign",
      poison: "Venom Bloom",
      ground: "Tectonic Wrath",
      rock: "Quake Herald",
      bug: "Hive Overlord",
      ghost: "Phantom Requiem",
      steel: "Iron Dominion",
      fire: "Ascending Flare",
      water: "Tidal Dominion",
      grass: "Verdant Bloom",
      electric: "Thunder Sovereign",
      psychic: "Mind Shatter",
      ice: "Absolute Zero",
      dragon: "Dragon's Verdict",
      dark: "Umbral Eclipse",
      fairy: "Fairy Triumph",
    };
    // A content pack can name each species' ultimate (rules.ultimateBySpecies: signature attacks).
    return this.rules.ultimateBySpecies?.[this.player.speciesId] ?? names[this.player.types[0]] ?? "Ultimate";
  }

  /* ------------------------------------------------------ level-up pool */

  /** Build the list of upgrade offers for a level-up. */
  rollChoices() {
    const p = this.player;
    const options = [];

    // New move from the kit
    const roster = this.data.rosterFor(p.speciesId);
    const levels = this.rules.kitLevels ?? [0, 2, 4, 7];
    if (roster && p.moves.length < p.moveSlots) {
      roster.kit.forEach((key, i) => {
        if (p.level < (levels[i] ?? 0)) return;
        const move = this.data.getMoveByKey(key);
        if (!move) return;
        if (p.moves.some((m) => m.def.id === move.id)) return;
        const def = buildMoveDef(move, this.rules);
        if (!def) return;
        options.push({
          kind: "newMove",
          id: move.id,
          title: move.name,
          sub: "Golpe novo",
          lines: [`${typeName(move.type)} · ${archLabel(def.arch, this.rules)}`],
          icon: "move",
          type: move.type,
          weight: 2.2,
        });
      });
    }

    // Move upgrade
    for (const mv of p.moves) {
      if (mv.level >= 8 + 2 * itemCount(this, "tm-case")) continue; // TM Case: two more levels
      const ups = this.rollMoveUps(mv);
      if (!ups.length) continue;
      options.push({
        kind: "upMove",
        slot: p.moves.indexOf(mv),
        ups, // applyChoice applies these; the card only showed them before
        title: mv.def.name,
        sub: `Nível ${mv.level} → ${mv.level + 1}`,
        lines: ups.map((u) => u.label),
        icon: "move",
        type: mv.def.type,
        weight: 1.4,
      });
    }

    // Move slot
    if (p.moves.length >= p.moveSlots && p.moveSlots < 6) {
      options.push({
        kind: "slot",
        title: "Espaço de golpe",
        sub: "Leve mais um golpe",
        lines: [],
        icon: "move",
        rarity: 3,
        weight: 0.7,
      });
    }

    // Item upgrade: mod-bearing entries plus the scripted ones the engine implements; anything else
    // would be a card with no effect.
    const pool = this.itemPool();
    if (pool.length) {
      const available = [0, 1, 2, 3, 4].map((r) => pool.some((u) => u.rarity === r));
      const rarity = rollRarity({
        level: p.level,
        luck: p.stats.luck,
        stage: this.stage,
        minRarity: 0,
        available,
      });
      let bucket = pool.filter((u) => u.rarity === rarity && !this.banished.has(u.key));
      if (!bucket.length) bucket = pool;
      const chosen = this.rng.weighted(bucket, (u) => {
        if (!u.tags?.length) return 1;
        if (u.tags.some((t) => t.startsWith("type:") && p.types.includes(t.slice(5)))) return 4;
        return 0.35;
      });
      if (chosen) {
        options.push({
          kind: "item",
          key: chosen.key,
          title: chosen.name ?? chosen.key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), // a content pack names its items
          sub: describeUpgrade(chosen),
          lines: [],
          icon: "item",
          rarity: chosen.rarity,
          weight: 3,
        });
      }
    }

    // Fusion (two high-level moves merge).
    const fusionOpts = fusionChoices(this);
    for (const fo of fusionOpts) options.push(fo);

    // Vitamins (permanent stat growth).
    const vitOpts = vitaminChoices(this, 10 + 2 * itemCount(this, "max-ether")); // Max Ether: two more levels
    for (const vo of vitOpts) options.push(vo);

    if (!options.length) return [];
    const picked = [];
    const pool2 = options.slice();
    for (let i = 0; i < 3 && pool2.length; i++) {
      const chosen = this.rng.weighted(pool2, (o) => o.weight ?? 1);
      picked.push(chosen);
      pool2.splice(pool2.indexOf(chosen), 1);
    }
    return picked;
  }

  rollMoveUps(mv) {
    const blocked = [...(NO_EFFECT_UPS[mv.def.arch] ?? [])];
    if (!mv.def.status) blocked.push("status"); // a move without a status has no chance to raise
    const stats = this.rules.archetypes[mv.def.arch].stats.filter((s) => !blocked.includes(s));
    const ups = [];
    const n = mv.level >= 6 ? 3 : 2;
    for (let i = 0; i < n && stats.length; i++) {
      const key = stats.splice(this.rng.int(0, stats.length - 1), 1)[0];
      const v = mv.level / 5;
      let value;
      let label;
      switch (key) {
        case "dmg":
          value = 0.22 * v;
          label = `+${Math.round(value * 100)}% de dano`;
          break;
        case "cd":
          value = Math.min(0.25, 0.08 * v);
          label = `-${Math.round(value * 100)}% de recarga`;
          break;
        case "count":
          value = mv.level >= 6 ? 2 : 1;
          label = `+${value} ${value > 1 ? "projéteis" : "projétil"}`;
          break;
        case "pierce":
        case "bounce":
          value = Math.max(1, Math.round(mv.level));
          label = `+${value} ${key === "pierce" ? "perfuração" : "ricochete"}`;
          break;
        case "area":
          value = 0.15 * v;
          label = `+${Math.round(value * 100)}% de área`;
          break;
        case "speed":
          value = 0.15 * v;
          label = `+${Math.round(value * 100)}% de velocidade`;
          break;
        case "dur":
          value = 0.2 * v;
          label = `+${Math.round(value * 100)}% de duração`;
          break;
        case "crit":
          value = 0.05 * v;
          label = `+${Math.round(value * 100)}% de crítico`;
          break;
        default:
          value = 0.25 * v;
          label = `+${Math.round(value * 100)}% de chance de status`;
      }
      ups.push({ key, value, label });
    }
    return ups;
  }

  /** Upgrades the cards may offer: mods or a scripted implementation, not banished, below their max. */
  itemPool() {
    return this.rules.upgrades.filter(
      (u) =>
        (u.mods?.length || SCRIPTED.has(u.key)) &&
        !this.banished.has(u.key) &&
        (this.upgrades.get(u.key)?.count ?? 0) < (u.max ?? 10)
    );
  }

  applyChoice(choice) {
    const p = this.player;
    if (choice.kind === "newMove") {
      const move = this.data.getMove(choice.id);
      const def = buildMoveDef(move, this.rules);
      if (def && p.moves.length < p.moveSlots) {
        p.moves.push({ def, level: 1, timer: 0.3, mods: { dmg: 1, cd: 1, count: 0, area: 1, speed: 1, dur: 1, pierce: 0, crit: 0, status: 1, bounce: 0 } });
      }
    } else if (choice.kind === "upMove") {
      const mv = p.moves[choice.slot];
      if (mv) {
        mv.level++;
        mv.mods.dmg += 0.08;
        for (const u of choice.ups ?? []) {
          switch (u.key) {
            case "dmg":
              mv.mods.dmg += u.value;
              break;
            case "cd":
              mv.mods.cd *= 1 - u.value;
              break;
            case "count":
              mv.mods.count += u.value;
              break;
            case "pierce":
              mv.mods.pierce += u.value;
              break;
            case "bounce":
              mv.mods.bounce += u.value;
              break;
            case "area":
              mv.mods.area += u.value;
              break;
            case "speed":
              mv.mods.speed += u.value;
              break;
            case "dur":
              mv.mods.dur += u.value;
              break;
            case "crit":
              mv.mods.crit += u.value;
              break;
            default:
              mv.mods.status += u.value;
          }
        }
      }
    } else if (choice.kind === "slot") {
      p.moveSlots = Math.min(6, p.moveSlots + 1);
      this.learnKitMoves(p);
    } else if (choice.kind === "item") {
      const up = this.rules.upgrades.find((u) => u.key === choice.key);
      if (up) {
        const prev = this.upgrades.get(up.key);
        this.upgrades.set(up.key, { ...up, count: (prev?.count ?? 0) + 1 });
        this.stats.items++;
        this.recompute(p); // scripted items change stats too (Poké Doll scales the allies' passive)
      }
    } else if (choice.kind === "fusion") {
      applyFusion(this, choice);
    } else if (choice.kind === "newVit" || choice.kind === "upVit") {
      applyVitaminPick(this, choice.vit, choice.rarity);
    }
  }

  /* ------------------------------------------------------------ evolve */

  tryEvolve() {
    const p = this.player;
    // The plan (which evolution, at which level) is fixed when the species is set; lines with
    // several branches (Eevee, Poliwhirl) no longer change target and threshold between checks.
    const plan = (p.evoPlan ??= evolutionPlan(this.data, p.speciesId, this.rng));
    if (!plan || p.level < plan.level) return false;
    p.speciesId = plan.to.id;
    p.species = plan.to;
    p.types = plan.to.types.slice();
    p.evoStage = plan.to.evoStage;
    p.maxHp = 0;
    this.recompute(p);
    p.hp = p.maxHp;
    this.stats.evolved++;
    this.achievements.incrementTask("evolve_ally", 1);
    this.banner(`Evoluiu para ${plan.to.name}!`);
    this.burst(p.x, p.y + 1, p.z, 0xff9ae0, 26, "star");
    this.shake(0.2);
    this.learnKitMoves(p);
    p.evoPlan = evolutionPlan(this.data, p.speciesId, this.rng); // next stage, or null at the end of the line
    return true;
  }

  /* ------------------------------------------------------------- utils */

  enemiesInCone(x, z, fx, fz, reach, arc) {
    const out = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      const d = Math.hypot(dx, dz);
      if (d > reach + e.radius) continue;
      if (arc < TAU - 0.01 && d > 0.4) {
        const dot = (dx * fx + dz * fz) / d;
        if (dot < Math.cos(arc / 2)) continue;
      }
      out.push(e);
    }
    return out;
  }

  /** The enemy with this id, or null — never a random other enemy. */
  enemyById(id) {
    for (const e of this.enemies) if (e.id === id) return e;
    return null;
  }

  typeRgb(type) {
    const c = TYPE_RGB[type] ?? [200, 200, 200];
    return (c[0] << 16) | (c[1] << 8) | c[2];
  }

  /** `scale` overrides the live zone curve ({ hpMult, dmgMult, effSeconds }); the tower passes its floor's. */
  spawnEnemy(speciesId, x, z, tier = "normal", scale = null) {
    // Dead entries stay in the list until it is compacted; compact before refusing,
    // otherwise spawning stopped for good after the 260th enemy of the run.
    if (this.enemies.length >= ENEMY_CAP) this.enemies = this.enemies.filter((e) => e.alive);
    if (this.enemies.length >= ENEMY_CAP) return null;
    const species = this.data.get(speciesId);
    if (!species) return null;
    this.markSeen(species.id);
    const t = ENEMY_TIER[tier] ?? ENEMY_TIER.normal;
    const hpMult = scale?.hpMult ?? this.director.hpMult();
    const dmgMult = scale?.dmgMult ?? this.director.dmgMult();
    const tough = t.tough ? toughness(scale?.effSeconds ?? this.director.effTime()) : 1;

    const baseHp = (12 + species.bst * 0.055) * hpMult * t.hpScale * tough * t.hpMul;
    const e = {
      id: nextId++,
      species,
      types: species.types,
      tier,
      x,
      z,
      y: 0,
      vx: 0,
      vz: 0,
      hp: baseHp,
      maxHp: baseHp,
      speed: enemySpeed(species) * t.speedMul * this.difficulty.enemySpeed,
      dmg: enemyDamage(species, dmgMult) * t.dmgMul,
      xp: enemyXp(species, tough, tier),
      radius: 0.55 * t.scale,
      scale: t.scale,
      shiny: Math.random() < SHINY_RATE,
      alive: true,
      dying: 0,
      flash: 0,
      animT: Math.random() * 6,
      statuses: { burn: 0, poison: 0, para: 0, freeze: 0, sleep: 0, root: 0, flinch: 0 },
      burnDps: 0,
      poisonDps: 0,
      atkCd: 0,
    };
    this.enemies.push(e);
    return e;
  }

  /* ------------------------------------------------------------- pokedex */

  markSeen(id) {
    if (this.pokedex.seen.has(id)) return; // every spawn calls this; only a new species hits storage
    this.pokedex.seen.add(id);
    this._savePokedex();
    this.achievements.recordSeen();
  }

  markCaught(id) {
    this.pokedex.seen.add(id); // a hatched species may never have been seen in battle
    this.pokedex.caught.add(id);
    this._savePokedex();
  }

  _savePokedex() {
    const p = this.profile?.data;
    if (!p) return;
    p.pokedex = {
      seen: [...this.pokedex.seen],
      caught: [...this.pokedex.caught],
    };
    this.profile.save();
  }

  /** Player's average damage per second, used to size boss HP. */
  /**
   * Damage per second the player is expected to deal right now: for each move, the real hit damage
   * (moveDamage x damage x physical/special x STAB x type item x average crit x projectiles) over its
   * cooldown, plus the allies. Sizes the boss HP budget. It used to keep only the move base, count
   * attack speed twice and ignore the allies.
   */
  playerExpectedDps() {
    const p = this.player;
    const s = p.stats;
    let dps = 0;
    for (const m of p.moves) {
      const cdSecs = Math.max(0.12, (m.def.cd * m.mods.cd) / s.attackSpeed);
      // Metronome has no power of its own: the average full cast of the moves it can call, on its cooldown.
      const pool = m.def.arch === "random" ? this.metronomePool() : null;
      const perCast = pool?.length ? pool.reduce((t, d) => t + this.castDamage(d, m), 0) / pool.length : this.castDamage(m.def, m);
      dps += perCast / cdSecs;
    }
    // Ally hits go through hitEnemy too, so they take the same multipliers.
    for (const a of this.allies.list) {
      dps += (this.allies.power(a) * this.expectedHitMul(a.physical ? "physical" : "special", a.types[0], 0)) / this.allies.cooldown(a);
    }
    return dps;
  }

  /** Expected damage of one cast of `def` with move `m`'s level and cards, on a boss-sized target at close range. */
  castDamage(def, m) {
    const s = this.player.stats;
    // Hits per cast on a boss-sized target at close range, measured: a chain hits it once whatever its
    // jumps; each orb hits and then explodes on it (two hits); everything else, once per projectile.
    const projectiles = Math.max(1, Math.floor(def.count + m.mods.count + (def.arch === "barrage" ? s.projectiles : 0)));
    // Fanned archetypes: projectile i flies ceil(i/2) steps off the aimed line; past ~0.7 rad it passes
    // beside a boss-sized target at 3 u, so only the inner ones count.
    const step = FAN_STEP[def.arch];
    let landing = projectiles;
    if (step) for (landing = 0; landing < projectiles && Math.ceil(landing / 2) * step <= 0.7; landing++);
    // An orbit orb passes a boss beside it about 0.6 times a second (measured) for the whole duration.
    const orbitSecs = def.arch === "orbit" ? Math.max(1, 0.6 * def.dur * m.mods.dur * s.duration) : 1;
    const count = (def.arch === "chain" ? 1 : def.arch === "orb" ? 2 * landing : landing) * orbitSecs;
    // Ground zones tick every 0.4 s for their life, as special hits with no card crit (the zone tick in
    // updateProjectiles). A trail (0.4 x damage, 3 s) under a boss in contact (2 u) is 3 x dur hits; a trap
    // (0.35 x damage, 6 s) is 5.25 x dur per trap whose radius reaches the boss: the central one, and the
    // ring traps (2.5 u out, at i/count of a turn) that land close enough, as fireMove places them.
    const durScale = m.mods.dur * s.duration;
    if (def.arch === "trail" || def.arch === "trap") {
      let zones = 1;
      if (def.arch === "trap") {
        const r = 1.4 + def.area * m.mods.area * s.area;
        // The ring has a fixed world orientation and the boss can stand on any side: average over 16 bearings.
        zones = 0;
        for (let k = 0; k < 16; k++) {
          const bx = Math.cos((k / 16) * TAU) * 2;
          const bz = Math.sin((k / 16) * TAU) * 2;
          for (let i = 0; i < projectiles; i++) {
            const a = (i / projectiles) * TAU;
            const off = i === 0 ? 0 : 2.5;
            if (Math.hypot(Math.cos(a) * off - bx, Math.sin(a) * off - bz) <= r) zones += 1 / 16;
          }
        }
      }
      const zoneHits = (def.arch === "trail" ? 3 : 5.25 * zones) * durScale;
      return this.moveDamage({ ...m, def }) * this.expectedHitMul("special", def.type, 0) * zoneHits;
    }
    const share = def.arch === "vortex" ? 0.35 : 1; // a vortex pull deals 35 % of the move damage
    const base = this.moveDamage({ ...m, def });
    return base * this.expectedHitMul(def.cls, def.type, m.mods.crit + (def.critBonus ?? 0)) * count * share;
  }

  /** Average multiplier hitEnemy applies to a hit of this class and type from the player's side (no enemy terms). */
  expectedHitMul(cls, type, critBonus) {
    const p = this.player;
    const s = p.stats;
    const crit = Math.min(1, s.critChance + s.megaCrit + critBonus);
    return (
      s.damage *
      (cls === "physical" ? s.physical : s.special) *
      (p.heldItem === "choice-band" ? 1.5 : p.heldItem === "life-orb" ? 1.3 : 1) *
      (p.types.includes(type) ? 1.25 : 1) *
      (s.typeBoost?.[type] ?? 1) *
      (1 + crit * (s.critDamage - 1))
    );
  }

  /** Fire a hostile projectile from an enemy (boss attacks). */
  spawnHostileProjectile(source, angle, speed, dmg, life = 2, radius = 0.6) {
    if (this.projectiles.length > 400) return;
    const e = source;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;
    this.projectiles.push({
      id: nextId++,
      x: e.x,
      y: e.y + 0.9,
      z: e.z,
      vx,
      vy: 0,
      vz,
      speed,
      life,
      radius,
      dmg: dmg ?? e.dmg,
      def: null,
      pierce: 0,
      homing: 0,
      explodeR: 0,
      lob: false,
      returnHome: false,
      age: 0,
      hits: new Set(),
      hostile: true,
      owner: e.id,
    });
  }

  /** Fire an allied projectile from an ally. */
  spawnAllyProjectile(source, angle, speed, dmg, life = 2, radius = 0.6, def = null) {
    if (this.projectiles.length > 400) return;
    const e = source;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;
    this.projectiles.push({
      id: nextId++,
      x: e.x,
      y: e.y + 0.9,
      z: e.z,
      vx,
      vy: 0,
      vz,
      speed,
      life,
      radius,
      dmg: dmg ?? e.dmg ?? 10,
      def,
      pierce: 0,
      homing: 0,
      explodeR: 0,
      lob: false,
      returnHome: false,
      age: 0,
      hits: new Set(),
      hostile: false,
    });
  }

  /** A hostile ground zone (boss pools). */
  zonesHostile(source, x, z, r, life, dmg) {
    this.zones.push({ x, z, r, life, tick: 0, dmg, type: source?.types?.[0] ?? "normal", status: null, hostile: true, owner: source?.id ?? -1 });
  }

  /** Schedule a callback after `delay` seconds. */
  later(delay, fn) {
    this.timers.push({ t: delay, fn });
  }

  /* ----------------------------------------------------------- effects */

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      if (e.t >= e.life) this.effects.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      f.y += f.vy * dt;
      f.vy -= 3 * dt;
      if (f.t >= f.life) this.floaters.splice(i, 1);
    }
    if (this.weatherT > 0) {
      this.weatherT -= dt;
      if (this.weatherT <= 0) this.weather = "none";
    }
  }

  ring(x, y, z, r, color, life = 0.3) {
    this.effects.push({ kind: "ring", x, y, z, r, color, t: 0, life });
  }
  beam(x, y, z, angle, len, color) {
    this.effects.push({ kind: "beam", x, y, z, angle, len, color, t: 0, life: 0.18 });
  }
  cone(x, y, z, angle, len, color) {
    this.effects.push({ kind: "cone", x, y, z, angle, len, color, t: 0, life: 0.25 });
  }
  burst(x, y, z, color, count = 8, shape = "soft") {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = 1 + Math.random() * 2.5;
      this.effects.push({
        kind: "particle",
        x,
        y,
        z,
        vx: Math.cos(a) * s,
        vy: 1.5 + Math.random() * 2.5,
        vz: Math.sin(a) * s,
        color,
        shape,
        size: 0.18 + Math.random() * 0.2,
        t: 0,
        life: 0.4 + Math.random() * 0.35,
      });
    }
  }
  floater(x, y, z, text, color) {
    this.floaters.push({ x, y, z, text, color, t: 0, life: 0.85, vy: 1.6 });
  }
  banner(text) {
    this.opts.onBanner?.(text);
  }
  shake(amount) {
    this.shakeAmount = Math.min(0.6, (this.shakeAmount ?? 0) + amount);
  }
}


const dtSafe = (run) => run.lastDt ?? 0.016;
