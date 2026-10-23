// Capture and allies: weaken enemies, throw a Poké Ball, and have captured
// Pokémon fight alongside you.
//
// Ports the upstream flow: an alpha's HP is flagged capturable at low HP, it
// stops fighting ("down" state), and pressing E within range throws a ball.
// Catch chance is 0.45 + captureRate/255*0.35 + 0.2 per failed attempt (+0.15
// if statused). Caught species join an ally team that orbits the player, auto
// attacks and grants a damage boost of its primary type.

import { clamp, dist } from "../core/math.js";

export class Capture {
  constructor(run) {
    this.run = run;
    this.down = -1; // enemy id currently weakened
    this.downT = 0;
    this.state = "idle"; // idle | down | throwing
    this.attempts = new Map();
  }

  get cfg() {
    return this.run.rules.capture;
  }

  /** Called when an enemy drops below the weaken threshold. */
  weaken(e) {
    if (!e.alive || e.dying > 0) return false;
    if (e.tier !== "alpha" && e.tier !== "boss") return false;
    if (this.state !== "idle") return false;
    const pct = e.hp / e.maxHp;
    if (pct > this.cfg.weakenHpPct) return false;
    this.down = e.id;
    this.state = "down";
    this.downT = this.cfg.weakenDuration;
    e.vx = 0;
    e.vz = 0;
    e.captureReady = true;
    this.run.banner(`${e.species.name} is weakened! Press E to throw a ball`);
    return true;
  }

  canThrow() {
    if (this.state !== "down") return false;
    const e = this.run.enemyById(this.down);
    if (!e || !e.alive) return false;
    const p = this.run.player;
    return dist(e.x, e.z, p.x, p.z) < this.cfg.throwRange;
  }

  /** Throw a ball; returns 'caught' | 'escaped' | 'idle'. */
  throw() {
    if (!this.canThrow()) return "idle";
    const run = this.run;
    const e = run.enemyById(this.down);
    const gen = e.id;
    const attempts = this.attempts.get(gen) ?? 0;
    let chance = this.cfg.base + (e.species.captureRate / 255) * 0.35 + attempts * this.cfg.attemptBonus;
    const statused = e.statuses.para > 0 || e.statuses.sleep > 0 || e.statuses.freeze > 0;
    if (statused) chance += this.cfg.statusBonus;
    this.attempts.set(gen, attempts + 1);

    if (Math.random() < Math.min(0.95, chance)) {
      this.caught(e);
      return "caught";
    }
    this.breakFree(e);
    return "escaped";
  }

  caught(e) {
    const run = this.run;
    this.reset();
    e.alive = false;
    e.dying = 0.01;
    e.hp = 0;
    // "First capture" is per run: the first ball that lands in a run always
    // grants an egg (unless one is already incubating), later ones have a 25%
    // chance. Read the counter BEFORE recording the catch.
    const firstOfRun = run.capturesThisRun === 0;
    run.capturesThisRun++;
    run.allies.recruit(e.species, e.tier === "boss" ? 1.5 : 1, e.shiny);
    run.markCaught(e.species.id);
    // Keep profile.data.caught in sync with run.pokedex.caught so achievement checks work.
    const pdata = run.profile?.data;
    if (pdata) {
      pdata.caught = pdata.caught ?? [];
      if (!pdata.caught.includes(e.species.id)) {
        pdata.caught.push(e.species.id);
        run.profile.save();
      }
    }
    run.achievements.recordCatch(e.species, e.shiny);
    if (run.eggs && !run.eggs.egg.active && (firstOfRun || Math.random() < 0.25)) {
      run.eggs.giveEgg(e.species.id, 200);
    }
    const shinyTxt = e.shiny ? "A shiny " : "A ";
    run.banner(`Gotcha! ${shinyTxt}${e.species.name} was caught!`);
    run.burst(e.x, e.y + 1, e.z, e.shiny ? 0xffd700 : 0xffd166, e.shiny ? 40 : 26, "star");
    run.opts.onCaught?.(e.species.name);
  }

  breakFree(e) {
    const run = this.run;
    this.reset();
    e.captureReady = false;
    e.hp = Math.max(e.hp, e.maxHp * 0.3);
    run.banner(`${e.species.name} broke free!`);
  }

  reset() {
    this.state = "idle";
    this.downT = 0;
    this.down = -1;
  }

  update(dt) {
    if (this.state === "down") {
      this.downT -= dt;
      const e = this.run.enemyById(this.down);
      if (!e || !e.alive) {
        this.reset();
        return;
      }
      // The weakened enemy stays stunned and slowly recovers.
      e.vx *= 0.8;
      e.vz *= 0.8;
      if (this.downT <= 0) {
        e.captureReady = false;
        e.hp = Math.max(e.hp, e.maxHp * 0.25);
        this.reset();
        this.run.banner(`${e.species.name} recovered!`);
      }
    }
  }
}

export class Allies {
  constructor(run) {
    this.run = run;
    this.list = [];
    this.slots = [];
  }

  get cfg() {
    return this.run.rules.allies;
  }

  get cap() {
    return this.cfg.cap + Math.floor((this.run.upgrades.get("poke-doll")?.count ?? 0) / 3);
  }

  /** Recruit a captured species as an ally. */
  recruit(species, bond = 1, shiny = false) {
    if (this.list.length >= this.cap) {
      // Team full: release the oldest recruit and close the formation gap.
      this.list.shift();
      this.list.forEach((a, i) => { a.slot = i; });
    }
    const physical = species.stats.atk >= species.stats.spa;
    this.list.push({
      id: species.id,
      species,
      types: species.types,
      shiny,
      bond,
      physical,
      slot: this.list.length,
      x: this.run.player.x,
      z: this.run.player.z,
      y: 0,
      hop: 0,
      hx: 0,
      hz: 0,
      tx: 0,
      tz: 0,
      timer: 0.5,
      anim: 0,
      fx: 0,
      fz: 1,
      flash: 0,
      squash: 0,
      nickname: null,
      heldItem: null,
    });
    this.run.banner(`${species.name} joins your team!`);
  }

  /** Ally attack power (upstream `power`). */
  power(a) {
    const run = this.run;
    const p = run.player;
    const cfg = this.cfg;
    return (
      (cfg.powerBase + cfg.powerLevel * p.level) *
      (cfg.powerBst + a.species.bst / cfg.powerBstDiv) *
      (1 + cfg.powerStage * (run.stage - 1)) *
      (1 + cfg.powerBond * (a.bond - 1)) *
      (a.shiny ? cfg.shinyMul : 1)
    );
  }

  /** Ally attack cooldown (upstream `cooldown`). */
  cooldown(a) {
    const base = a.physical ? this.cfg.cooldownPhysical : this.cfg.cooldownSpecial;
    return base / Math.sqrt(this.run.player.stats.attackSpeed);
  }

  /** Per-type support the allies grant the player. */
  mods() {
    const p = this.run.player;
    const groups = [];
    for (const a of this.list) {
      const boost = this.cfg.supportBoost * (a.shiny ? 2 : 1);
      groups.push([{ stat: "damage", mul: 1 + boost }]);
    }
    return groups;
  }

  update(dt) {
    const run = this.run;
    const p = run.player;
    for (const a of this.list) {
      a.anim += dt;
      a.flash = Math.max(0, a.flash - dt * 3);
      a.squash *= Math.exp(-dt * 10);

      // Follow the player in formation slots.
      const slotAngle = (a.slot / Math.max(1, this.list.length)) * Math.PI * 2 + run.time * 0.4;
      const targetX = p.x + Math.cos(slotAngle) * 2.6;
      const targetZ = p.z + Math.sin(slotAngle) * 2.6;
      const dx = targetX - a.x;
      const dz = targetZ - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 28) {
        a.x = targetX;
        a.z = targetZ;
      } else if (d > 0.4) {
        const speed = Math.min(d * 3, 9);
        a.x += (dx / d) * speed * dt;
        a.z += (dz / d) * speed * dt;
        a.fx = dx / d;
        a.fz = dz / d;
      }

      if (a.hop > 0) {
        a.hop -= dt;
        const t = 1 - Math.max(0, a.hop) / 0.32;
        a.x = a.hx + (a.tx - a.hx) * t;
        a.z = a.hz + (a.tz - a.hz) * t;
        a.y = Math.sin(t * Math.PI) * 1.6;
        if (a.hop <= 0) this.land(a);
        continue;
      }
      a.y = Math.max(0, a.y - dt * 4);

      a.timer -= dt;
      if (a.timer > 0) continue;
      const target = run.nearestEnemy(a.x, a.z, 14);
      if (target < 0) {
        a.timer = 0.3;
        continue;
      }
      a.timer = this.cooldown(a);
      const e = run.enemyById(target);
      const dx2 = e.x - a.x;
      const dz2 = e.z - a.z;
      const dd = Math.hypot(dx2, dz2) || 1;
      a.fx = dx2 / dd;
      a.fz = dz2 / dd;
      const power = this.power(a);
      if (a.physical) {
        a.hop = 0.32;
        a.hx = a.x;
        a.hz = a.z;
        a.tx = a.x + a.fx * Math.min(dd - 0.8, 3);
        a.tz = a.z + a.fz * Math.min(dd - 0.8, 3);
        a.pendingHit = power;
        a.squash = -0.5;
      } else {
        // (source, angle, speed, dmg, life, radius, def) — the old call passed `power` as the speed.
        const def = { type: a.types[0], cls: "special", status: null, statusChance: 0, slot: -1 };
        run.spawnAllyProjectile(a, Math.atan2(dz2, dx2), 16, power, 2, 0.45, def);
        a.squash = 0.4;
      }
    }
  }

  land(a) {
    const run = this.run;
    const radius = 2.2 * Math.sqrt(run.player.stats.area);
    run.ring(a.x, 0.2, a.z, radius, run.typeRgb(a.types[0]), 0.3);
    for (const e of run.enemies) {
      if (!e.alive || e.dying > 0) continue;
      if (dist(e.x, e.z, a.x, a.z) > radius) continue;
      run.hitEnemy(e, a.pendingHit ?? 0, {
        type: a.types[0],
        cls: "physical",
        status: null,
        statusChance: 0,
        slot: -1,
      });
    }
    a.y = 0;
    a.pendingHit = 0;
    a.squash = 0.6;
  }
}
