// Spawn director: builds the enemy pool for a biome/stage and runs the event timeline.

import { enemyHpCurve } from "./rules.js";

const STAGE_DAMAGE = [1, 1.35, 1.8, 2.4];
/** The classic zone clock (seconds): the timeline spans it, and when it runs out with the guardian asleep the final swarm starts. */
export const ZONE_SECS = 600;

export class Director {
  constructor(run, rng) {
    this.run = run;
    this.rng = rng;
    this.cards = [];
    this.pool = [];
    this.latePool = [];
    this.residentPool = [];
    this.timeline = [];
    this.elapsed = 0;
    this.spawnAccum = 0;
    this.credits = 0;
    this.spawnAllowance = 0;
    this.finalSwarm = false;
    this.finalSwarmAt = 0;
    this.cardsDrawn = 0;
    this.buildPool();
    for (let i = 0; i < 3; i++) this.addCard();
    this.buildTimeline();
  }

  get data() {
    return this.run.data;
  }

  get stage() {
    return this.run.stage;
  }

  /** Effective elapsed time in the current stage, in seconds. */
  effTime() {
    return this.run.stageTime;
  }

  /** Enemy HP multiplier for the current stage and time. */
  hpMult(t = 0) {
    return this.hpMultAt(this.stage, Math.max(t, this.effTime() / 60)) * this.swarmMult(4);
  }

  /** Enemy damage multiplier for the current stage and time. */
  dmgMult(t = 0) {
    return this.dmgMultAt(this.stage, Math.max(t, this.effTime() / 60)) * this.swarmMult(2);
  }

  /** Final swarm: `base` to the power of the minutes since it started (HP x4, damage x2 per minute). */
  swarmMult(base) {
    return this.finalSwarm ? base ** ((this.run.stageTime - this.finalSwarmAt) / 60) : 1;
  }

  /** The zone clock ran out with the guardian still asleep: the horde floods in and keeps growing. */
  startFinalSwarm() {
    if (this.finalSwarm) return;
    this.finalSwarm = true;
    this.finalSwarmAt = this.run.stageTime;
    this.run.banner("O tempo acabou: o enxame final chegou! Acorde o guardião.");
    this.run.shake(0.4);
  }

  /** The same curves for an arbitrary stage and minute (the tower feeds its floors' virtual minutes). */
  hpMultAt(stage, minutes) {
    return enemyHpCurve(stage, minutes) * this.run.difficulty.enemyHp;
  }

  dmgMultAt(stage, minutes) {
    const stageMul = STAGE_DAMAGE[stage - 1] ?? STAGE_DAMAGE[3];
    return (1 + minutes * 0.13) * stageMul;
  }

  /**
   * Build the pool of enemies that can appear: species matching the biome's
   * types, filtered by the evolution stage unlocked so far.
   */
  buildPool() {
    const biome = this.run.biome;
    const stage = this.stage;
    const all = this.data.pokemon.filter((p) => !p.legendary && !p.mythical);
    const matches = (p, types) => p.types.some((t) => types.includes(t));
    const maxStage = stage === 1 ? 0 : stage === 2 ? 1 : 2;
    const minStage = stage === 3 ? 1 : 0;

    // Strong species with no evolution line (Pheromosa, Pinsir…) are zone-3 material: in zone 1
    // they used to open the run three hits from death.
    const strongSingle = (p) => p.evoStage === 0 && p.bst >= 420 && !this.data.evolutionsOf(p.id).length;
    let pool = all.filter((p) => matches(p, biome.types) && p.evoStage <= maxStage && p.evoStage >= minStage && !strongSingle(p));
    if (stage === 3) pool = pool.concat(all.filter((p) => matches(p, biome.types) && strongSingle(p)));
    if (pool.length < 12) pool = all.filter((p) => p.evoStage <= maxStage && !strongSingle(p));

    this.pool = this.rng.shuffle(pool);
    this.latePool = this.rng.shuffle(all.filter((p) => matches(p, biome.late ?? []) && p.evoStage <= maxStage));

    const families = new Set(biome.residents ?? []);
    const residents = all.filter((p) => families.has(p.family) && p.evoStage <= maxStage);
    this.residentPool = this.rng.shuffle(residents);
  }

  /**
   * Pick a new enemy "card" to add to the rotation: every third card is a resident of the
   * region; after four minutes of zone, 40 % of the others come from the late pool.
   */
  addCard() {
    const resident = this.cardsDrawn++ % 3 === 1 && this.residentPool.length;
    const late = !resident && this.run.stageTime > 240 && this.latePool.length && this.rng.chance(0.4);
    const pool = resident ? this.residentPool : late ? this.latePool : this.pool;
    const used = new Set(this.cards.map((c) => c.id));
    const pick = pool.find((p) => !used.has(p.id)) ?? this.pool[0];
    if (!pick) return;
    const cost = 1 + pick.bst / 220;
    this.cards.push({ id: pick.id, cost, weight: 1 });
    for (const c of this.cards) c.weight *= 0.85;
    this.cards[this.cards.length - 1].weight = 1.4;
  }

  /**
   * The zone's script (seconds of zone): a new species card every ~60 s up to 9.6 min, alphas
   * at 150/330/480, a swarm or stampede, a swarm, a stampede and two elite waves. Zone 1 gets
   * the first horde and elite wave a little later.
   */
  buildTimeline() {
    this.timeline = [];
    for (let m = 1; m < 9.6; m += this.rng.range(0.8, 1.2)) {
      this.timeline.push({ t: m * 60, kind: "card", done: false });
    }
    this.timeline.push({ t: 150, kind: "alpha", done: false });
    this.timeline.push({ t: 330, kind: "alpha", done: false });
    this.timeline.push({ t: 480, kind: "alpha", done: false });
    this.timeline.push({ t: this.stage === 1 ? 235 : 200, kind: this.rng.chance(0.5) ? "swarm" : "stampede", done: false });
    this.timeline.push({ t: 390, kind: "swarm", done: false });
    this.timeline.push({ t: 520, kind: "stampede", done: false });
    this.timeline.push({ t: this.stage === 1 ? 330 : 270, kind: "elitewave", done: false });
    this.timeline.push({ t: 450, kind: "elitewave", done: false });
    this.timeline.sort((a, b) => a.t - b.t);
  }

  onStage(stage) {
    this.buildPool();
    this.timeline = [];
    this.buildTimeline();
    this.finalSwarm = false;
  }

  update(dt) {
    this.elapsed += dt;
    const run = this.run;

    // Timed events
    for (const ev of this.timeline) {
      if (ev.done || run.stageTime < ev.t) continue;
      ev.done = true;
      this.fire(ev.kind);
    }

    // Continuous pressure: the population cap grows through the stage.
    const eff = this.effTime();
    const cap = this.popCap(eff);
    this.spawnAccum += dt;
    const minutes = eff / 60;
    // The final swarm spawns six times as fast and throws in bursts of elites.
    const interval = Math.max(0.22, 1 / (1.1 + minutes * 0.14)) / (this.finalSwarm ? 6 : 1);
    while (this.spawnAccum >= interval) {
      this.spawnAccum -= interval;
      if (run.enemies.length < cap) this.spawnNormal();
    }
    if (this.finalSwarm && this.cards.length && this.rng.chance(dt * 2)) {
      for (let i = 0; i < 6 && run.enemies.length < cap; i++) {
        const spot = this.spawnPoint(16, 30);
        const e = spot && run.spawnEnemy(this.rng.pick(this.cards).id, spot.x, spot.z, "elite");
        if (e) e.freeElite = true;
      }
    }
  }

  /** Population cap at `eff` effective seconds; difficulty and the player's enemyAmount (White Flute, Repel) scale it. */
  popCap(eff) {
    return Math.min(
      240,
      Math.round(
        (10 + eff * 0.65 + (eff / 60) ** 2 * 4.5) *
          (1 + (this.stage - 1) * 0.6) *
          this.run.difficulty.enemyAmount *
          (this.run.player?.stats.enemyAmount ?? 1)
      )
    );
  }

  spawnNormal() {
    if (!this.cards.length) this.addCard();
    const card = this.rng.weighted(this.cards, (c) => c.weight);
    if (!card) return;
    const p = this.run.player;
    const spot = this.spawnPoint(16, 30);
    if (!spot) return;
    const elite = this.eliteRoll();
    const e = this.run.spawnEnemy(card.id, spot.x, spot.z, elite ? "elite" : "normal");
    if (e && elite) e.freeElite = true; // see Run.killEnemy: a 15 % candy instead of a sure one
  }

  /**
   * A free spawn turns elite with 1.2 % + 0.4 % per minute + 3 % per zone (Super Lure scales it);
   * never in the first 90 s of zone 1.
   */
  eliteRoll() {
    const run = this.run;
    if (run.stage === 1 && run.stageTime < 90) return false;
    const chance = (0.012 + (run.stageTime / 60) * 0.004 + (run.stage - 1) * 0.03) * (run.player?.stats.eliteSpawn ?? 1);
    return this.rng.chance(chance);
  }

  spawnPoint(min = 16, max = 30) {
    const p = this.run.player;
    for (let i = 0; i < 16; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(min, max);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      const half = this.run.biome.size / 2;
      if (Math.abs(x) < half - 4 && Math.abs(z) < half - 4) return { x, z };
    }
    return null;
  }

  fire(kind) {
    const run = this.run;
    const p = run.player;
    switch (kind) {
      case "card":
        this.addCard();
        break;
      case "alpha": {
        const card = this.cards.length ? this.rng.pick(this.cards) : null;
        if (!card) break;
        const spot = this.spawnPoint(20, 28);
        if (!spot) break;
        const species = run.spawnEnemy(card.id, spot.x, spot.z, "alpha");
        if (species) {
          run.banner(`Alfa ${species.species.name} apareceu!`);
          run.shake(0.2);
        }
        break;
      }
      case "elitewave": {
        const n = Math.round((4 + this.stage * 2) * (run.player?.stats.eliteSpawn ?? 1)); // Super Lure: bigger waves
        for (let i = 0; i < n; i++) {
          const card = this.cards.length ? this.rng.pick(this.cards) : null;
          if (!card) break;
          const spot = this.spawnPoint(16, 30);
          if (spot) run.spawnEnemy(card.id, spot.x, spot.z, "elite");
        }
        run.banner("Uma onda de Pokémon de elite se aproxima!");
        break;
      }
      case "swarm": {
        const card = this.cards.length ? this.rng.pick(this.cards) : null;
        if (!card) break;
        const n = Math.round(30 + this.stage * 8);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const r = 22 + this.rng.range(-2, 2);
          const x = p.x + Math.cos(a) * r;
          const z = p.z + Math.sin(a) * r;
          if (Math.abs(x) < run.biome.size / 2 - 4 && Math.abs(z) < run.biome.size / 2 - 4) {
            run.spawnEnemy(card.id, x, z, "swarm");
          }
        }
        run.banner("Enxame!");
        break;
      }
      case "stampede": {
        const card = this.cards.length ? this.rng.pick(this.cards) : null;
        if (!card) break;
        const a = this.rng.range(0, Math.PI * 2);
        const n = Math.round(24 + this.stage * 6);
        for (let i = 0; i < n; i++) {
          const lateral = (i % 9 - 4) * 2.2;
          const along = Math.floor(i / 9) * 3;
          const x = p.x - Math.cos(a) * (30 + along) + Math.sin(a) * lateral;
          const z = p.z - Math.sin(a) * (30 + along) - Math.cos(a) * lateral;
          run.spawnEnemy(card.id, x, z, "swarm");
        }
        run.banner("Estouro!");
        run.shake(0.2);
        break;
      }
    }
  }
}
