// Spawn director: builds the enemy pool for a biome/stage and runs the event timeline.

import { enemyHpCurve } from "./rules.js";

const TIMELINE_EVERY = 52;
const STAGE_DAMAGE = [1, 1.35, 1.8, 2.4];

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
    return this.hpMultAt(this.stage, Math.max(t, this.effTime() / 60));
  }

  /** Enemy damage multiplier for the current stage and time. */
  dmgMult(t = 0) {
    return this.dmgMultAt(this.stage, Math.max(t, this.effTime() / 60));
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

    let pool = all.filter((p) => matches(p, biome.types) && p.evoStage <= maxStage && p.evoStage >= minStage);
    if (pool.length < 12) pool = all.filter((p) => p.evoStage <= maxStage);

    this.pool = this.rng.shuffle(pool);
    this.latePool = this.rng.shuffle(all.filter((p) => matches(p, biome.late ?? []) && p.evoStage <= maxStage));

    const families = new Set(biome.residents ?? []);
    const residents = all.filter((p) => families.has(p.family) && p.evoStage <= maxStage);
    this.residentPool = this.rng.shuffle(residents);
  }

  /** Pick a new enemy "card" to add to the rotation. */
  addCard() {
    const pool = this.residentPool.length && this.rng.chance(0.35) ? this.residentPool : this.pool;
    const used = new Set(this.cards.map((c) => c.id));
    const pick = pool.find((p) => !used.has(p.id)) ?? this.pool[0];
    if (!pick) return;
    const cost = 1 + pick.bst / 220;
    this.cards.push({ id: pick.id, cost, weight: 1 });
    for (const c of this.cards) c.weight *= 0.85;
    this.cards[this.cards.length - 1].weight = 1.4;
  }

  buildTimeline() {
    this.timeline = [];
    for (let t = TIMELINE_EVERY; t < 300; t += TIMELINE_EVERY) {
      this.timeline.push({ t, kind: "card", done: false });
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
    for (const c of this.timeline) c.t += 40;
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
    const cap = Math.min(
      240,
      Math.round(
        (10 + eff * 0.65 + (eff / 60) ** 2 * 4.5) *
          (1 + (this.stage - 1) * 0.6) *
          this.run.difficulty.enemyAmount
      )
    );
    this.spawnAccum += dt;
    const minutes = eff / 60;
    const interval = Math.max(0.22, 1 / (1.1 + minutes * 0.14));
    while (this.spawnAccum >= interval) {
      this.spawnAccum -= interval;
      if (run.enemies.length < cap) this.spawnNormal();
    }
  }

  spawnNormal() {
    if (!this.cards.length) this.addCard();
    const card = this.rng.weighted(this.cards, (c) => c.weight);
    if (!card) return;
    const p = this.run.player;
    const spot = this.spawnPoint(16, 30);
    if (!spot) return;
    this.run.spawnEnemy(card.id, spot.x, spot.z, "normal");
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
        const n = Math.round(4 + this.stage * 2);
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
