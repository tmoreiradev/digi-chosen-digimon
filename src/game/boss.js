// Boss encounters: zone guardians, legendary fights and tower guardians.
//
// Ports the upstream boss controller: HP sized from the zone curve, a target
// fight duration, burst damage capped to the fight budget, telegraphed attacks
// that escalate through phases, and an anti-stall "exhaust" multiplier once the
// fight runs twice as long as intended.

import { clamp, dist, TAU } from "../core/math.js";
import { enemyHpCurve, enemyDamage as enemyDamageFor } from "./rules.js";

const BOSS_MOVE_NAMES = {
  slams: "Slams",
  ring: "Shock Ring",
  charge: "Charge",
  volley: "Volley",
  wave: "Shockwave",
  spiral: "Spiral",
  meteor: "Skyfall",
  pools: "Hazard Pools",
};

export class Boss {
  constructor(run) {
    this.run = run;
    this.index = -1;
    this.name = "";
    this.fightT = 0;
    this.fightSecs = 60;
    this.phase = 1;
    this.moveT = 3;
    this.moveName = "";
    this.windup = 0;
    this.active = null;
    this.exhaustSaid = false;
    this.dead = false;
  }

  get cfg() {
    return this.run.rules.boss;
  }

  get enemy() {
    return this.index >= 0 ? this.run.enemyById(this.index) : null;
  }

  get alive() {
    const e = this.enemy;
    return !!e && e.alive && e.hp > 0;
  }

  /** Immunity while a telegraphed attack is winding up. */
  get immune() {
    return this.windup > 0;
  }

  /**
   * Spawn a boss. `kind` is 'guardian' (zone boss), 'legendary' (sanctuary) or
   * 'totem' / 'summoner' (tower floor guardians).
   */
  spawn(speciesId, x, z, kind = "guardian") {
    const run = this.run;
    const cfg = this.cfg;
    const stage = run.stage;
    const isLegendary = kind === "legendary";
    const isTower = kind === "totem" || kind === "summoner";

    const minutes = isLegendary ? 0 : cfg.guardianCurveMinutes;
    let hpMult = enemyHpCurve(isTower ? 4 : stage, minutes) * (isLegendary ? cfg.legendaryHpMul : 1);
    if (!isTower) hpMult *= cfg.zoneHp[stage - 1] ?? 0.5;
    if (isTower) hpMult *= kind === "totem" ? 2.2 : 1.4;

    const secs = isTower
      ? kind === "totem"
        ? cfg.fightSecs.totem[Math.min(2, stage - 1)]
        : cfg.fightSecs.summoner[Math.min(2, stage - 1)]
      : isLegendary
        ? cfg.fightSecs.legendary
        : cfg.fightSecs.guardian[Math.min(2, stage - 1)];

    const tier = run.difficulty;
    const tierIndex = { normal: 0, hard: 1, nightmare: 2 }[tier.id] ?? 0;

    const e = run.spawnEnemy(speciesId, x, z, "boss");
    if (!e) return null;

    // Classic bosses take their HP from the boss curve (zoneHp, guardianCurveMinutes,
    // legendaryHpMul) instead of the zone's live enemy curve, which spawnEnemy used and
    // which balloons by minute 5 of a zone. Tower guardians keep the live curve: their
    // config multipliers were never applied and the floors are tuned for it.
    if (!isTower) {
      const live = run.director.hpMult();
      if (live > 0) e.hp = e.maxHp = (e.maxHp / live) * hpMult * run.difficulty.enemyHp;
    }

    // Resize the boss so the expected fight duration is realistic.
    const budget = run.playerExpectedDps(secs) * secs * (1 + 0.15 * tierIndex);
    const targetHp = Math.min(e.maxHp * 4, Math.max(e.maxHp, budget));
    e.hp = e.maxHp = targetHp;

    // Burst cap: capRate damage per second, banked up to three seconds.
    this.capRate = targetHp / secs;
    this.capBank = this.capRate * 3;
    this.capT = run.time;

    this.index = e.id;
    this.name = e.species.name;
    this.fightSecs = secs;
    this.fightT = 0;
    this.phase = 1;
    this.moveT = 3;
    this.windup = 0;
    this.active = null;
    this.dead = false;
    this.exhaustSaid = false;
    this.kind = kind;
    run.banner(`${this.name}, ${kind === "legendary" ? "the legendary" : "guardian of the " + run.biome.name}!`);
    run.shake(0.4);
    return e;
  }

  /**
   * Damage multiplier applied to hits on the boss: burst capping plus the
   * anti-stall exhaust ramp after twice the intended fight length.
   */
  hitMul() {
    if (!this.alive) return 1;
    return this.exhaust() * (this.immune ? 0.15 : 1);
  }

  /** Cap a damage packet against the banked allowance. */
  capDamage(amount) {
    const rate = this.capRate ?? Infinity;
    const banked = Math.min(rate * 3, this.capBank + Math.max(0, this.run.time - this.capT) * rate);
    const through = Math.min(amount, banked);
    this.capBank = banked - through;
    this.capT = this.run.time;
    return through;
  }

  /** Anti-stall: after 2x the intended duration the boss takes exponentially more damage. */
  exhaust() {
    const over = this.fightT - this.fightSecs * 2;
    if (over <= 0) return 1;
    if (!this.exhaustSaid) {
      this.exhaustSaid = true;
      this.run.banner(`${this.name} is exhausted!`);
    }
    return Math.min(1e6, 2 ** (over / 20));
  }

  update(dt) {
    if (!this.alive) {
      if (this.index >= 0 && !this.dead) {
        this.dead = true;
        this.onDefeat();
      }
      return;
    }
    const e = this.enemy;
    this.fightT += dt;

    // Phases advance on HP thresholds.
    const pct = e.hp / e.maxHp;
    const wantPhase = pct <= 0.33 ? 3 : pct <= 0.66 ? 2 : 1;
    if (wantPhase > this.phase) {
      this.phase = wantPhase;
      this.onPhase();
    }

    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) this.release();
      return;
    }
    if (this.active) {
      this.tickActive(dt);
      return;
    }

    this.moveT -= dt;
    if (this.moveT <= 0) this.pickMove();
  }

  onPhase() {
    const run = this.run;
    run.banner(`${this.name} enters phase ${this.phase}!`);
    run.shake(0.3);
    run.burst(this.enemy.x, this.enemy.y + 1.5, this.enemy.z, 0xff5a4a, 24, "star");
  }

  pickMove() {
    const run = this.run;
    const e = this.enemy;
    const pool = this.phase >= 2 ? this.cfg.movesAdvanced : this.cfg.movesBasic;
    const move = run.rng.pick(pool);
    this.moveName = BOSS_MOVE_NAMES[move] ?? move;
    this.nextMove = move;
    this.windup = 0.9 - Math.min(0.4, this.phase * 0.1);
    // Telegraph the incoming attack.
    const color = 0xff5a4a;
    run.ring(e.x, 0.2, e.z, 6, color, this.windup);
    run.banner(`${this.name}: ${this.moveName}!`);
  }

  release() {
    const move = this.nextMove;
    this.nextMove = null;
    const run = this.run;
    const e = this.enemy;
    const p = run.player;
    const tier = this.phase;
    const dmg = e.dmg * run.difficulty.enemyDamage;

    switch (move) {
      case "charge": {
        const dx = p.x - e.x;
        const dz = p.z - e.z;
        const d = Math.hypot(dx, dz) || 1;
        this.active = {
          kind: "charge",
          t: 0.7,
          vx: (dx / d) * 22,
          vz: (dz / d) * 22,
          dmg,
          hit: false,
        };
        break;
      }
      case "volley": {
        const count = 4 + tier * 2;
        const base = Math.atan2(p.z - e.z, p.x - e.x);
        for (let i = 0; i < count; i++) {
          run.spawnHostileProjectile(e, base + (i / count) * TAU, 14 + tier * 2, dmg * 0.6, 3.2);
        }
        this.moveT = 3.4;
        break;
      }
      case "ring": {
        const radius = 5 + tier * 1.5;
        for (const en of run.enemies) {
          if (!en.alive || en.id === e.id) continue;
          if (dist(en.x, en.z, e.x, e.z) > radius + 2) continue;
          en.vx += ((en.x - e.x) / (radius || 1)) * 6;
          en.vz += ((en.z - e.z) / (radius || 1)) * 6;
        }
        run.ring(e.x, 0.3, e.z, radius, 0xff8a3a, 0.5);
        if (dist(p.x, p.z, e.x, e.z) < radius) run.hitPlayer(dmg * 0.9, e);
        run.shake(0.25);
        this.moveT = 3.2;
        break;
      }
      case "wave": {
        this.active = { kind: "wave", t: 1.2, r: 1.5, max: 14 + tier * 3, dmg, hit: new Set() };
        break;
      }
      case "spiral": {
        this.active = { kind: "spiral", t: 2.4, shot: 0, dmg };
        break;
      }
      case "meteor": {
        const count = 5 + tier * 2;
        for (let i = 0; i < count; i++) {
          const a = run.rng.range(0, TAU);
          const r = run.rng.range(2, 10);
          const mx = p.x + Math.cos(a) * r;
          const mz = p.z + Math.sin(a) * r;
          run.later(0.8 + i * 0.15, () => {
            run.ring(mx, 0.2, mz, 2.6, 0xc8a070, 0.3);
            run.shake(0.12);
            if (dist(p.x, p.z, mx, mz) < 2.6) run.hitPlayer(dmg, e);
            run.burst(mx, 0.6, mz, 0xc8a070, 10, "star");
          });
        }
        this.moveT = 4;
        break;
      }
      case "pools": {
        const count = 3 + tier;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * TAU + run.rng.range(0, 1);
          const r = run.rng.range(3, 8);
          run.zonesHostile(e, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 2.4, 5, dmg * 0.25);
        }
        this.moveT = 4.5;
        break;
      }
      case "slams":
      default: {
        const count = 1 + tier;
        for (let i = 0; i < count; i++) {
          const a = Math.atan2(p.z - e.z, p.x - e.x) + (i - (count - 1) / 2) * 0.5;
          run.spawnHostileProjectile(e, a, 11, dmg * 0.8, 2.2);
        }
        this.moveT = 2.6;
        break;
      }
    }
  }

  tickActive(dt) {
    const run = this.run;
    const e = this.enemy;
    const p = run.player;
    const a = this.active;
    a.t -= dt;

    if (a.kind === "charge") {
      e.x += a.vx * dt;
      e.z += a.vz * dt;
      const half = run.biome.size / 2;
      e.x = clamp(e.x, -half, half);
      e.z = clamp(e.z, -half, half);
      run.ring(e.x, 0.2, e.z, 2, 0xff8a3a, 0.15);
      if (!a.hit && dist(p.x, p.z, e.x, e.z) < e.radius + p.radius + 0.6) {
        a.hit = true;
        run.hitPlayer(a.dmg, e);
        run.shake(0.3);
      }
      if (a.t <= 0) {
        this.active = null;
        this.moveT = 2.6;
      }
      return;
    }

    if (a.kind === "wave") {
      const r = a.r;
      a.r += 14 * dt;
      run.ring(e.x, 0.25, e.z, r, 0xffb03a, 0.12);
      if (!a.hit.has("player") && dist(p.x, p.z, e.x, e.z) < r && dist(p.x, p.z, e.x, e.z) > r - 2.5) {
        a.hit.add("player");
        run.hitPlayer(a.dmg * 0.8, e);
      }
      if (a.r >= a.max) {
        this.active = null;
        this.moveT = 3;
      }
      return;
    }

    if (a.kind === "spiral") {
      a.shot -= dt;
      if (a.shot <= 0) {
        a.shot = 0.22;
        const angle = a.t * 6;
        for (let i = 0; i < 3; i++) {
          run.spawnHostileProjectile(e, angle + (i / 3) * TAU, 12, a.dmg * 0.5, 2.4);
        }
      }
      if (a.t <= 0) {
        this.active = null;
        this.moveT = 3.4;
      }
      return;
    }

    this.active = null;
  }

  onDefeat() {
    const run = this.run;
    const e = this.enemy;
    // Forget the id: once the enemy list is compacted a stale id must not resolve to another enemy.
    this.index = -1;
    run.banner(`${this.name} is defeated!`);
    run.shake(0.4);
    if (e) run.burst(e.x, e.y + 1, e.z, 0xffd166, 30, "star");
    run.opts.onBossDown?.(this.name, this.kind);
    run.onBossDefeated(this.kind);
  }
}
