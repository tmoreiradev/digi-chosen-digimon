// Tower mode: "The Night of Lavender Tower".
//
// Ports the upstream event mode: seven themed floors of the graveyard biome,
// each fought in waves, closed by a guardian. Floor 7's bell rings and the lord
// of the tower awaits; beyond floor 7 the floors repeat with escalating
// difficulty. Enemy scaling is driven by `vmin` (virtual minutes) instead of
// wall-clock time.

import { clamp } from "../core/math.js";
import { towerFloorName } from "../core/i18n.js";

export class Tower {
  constructor(run) {
    this.run = run;
    this.floor = 1;
    this.wave = 1;
    this.waveT = 0;
    this.waveCount = 0;
    this.guardianDown = false;
    this.pendingGuardian = false;
    this.cleared = false;
  }

  get def() {
    const floors = this.run.rules.tower.floors;
    const idx = this.beyond ? (this.floor - 8) % floors.length : this.floor - 1;
    return floors[clamp(idx, 0, floors.length - 1)];
  }

  /** Floor 8+ repeats the tower with a harder curve. */
  get beyond() {
    return this.floor > 7;
  }

  /** Virtual minutes used for enemy scaling on this floor/wave. */
  get vmin() {
    const def = this.def;
    const wave = Math.min(2, this.wave - 1);
    const progress = Math.min(1, this.waveT / 60) * 0.5;
    if (this.beyond) {
      return 21 + (this.floor - 8) * 2 + wave * 0.6 + progress;
    }
    return def.curve.min + wave * def.curve.step + progress;
  }

  get curveStage() {
    return this.beyond ? 4 : this.def.curve.stage;
  }

  /** Enemy scaling for this floor and wave: the floor's curve at its virtual minutes, not wall time. */
  scale() {
    const d = this.run.director;
    // effSeconds feeds the early-stage toughness falloff, so it follows the floor too.
    return { hpMult: d.hpMultAt(this.curveStage, this.vmin), dmgMult: d.dmgMultAt(this.curveStage, this.vmin), effSeconds: this.vmin * 60 };
  }

  where() {
    if (this.beyond) return `Além — Andar ${this.floor}`;
    return `${this.floor}F — ${towerFloorName(this.def.name)}`;
  }

  /** Enter a floor: announce it and reset the wave state. */
  enterFloor() {
    const run = this.run;
    this.wave = 1;
    this.waveT = 0;
    this.waveCount = 0;
    this.guardianDown = false;
    this.pendingGuardian = false;
    run.banner(this.where());
    if (this.def.sub) run.opts.onTowerFloor?.(this.floor, this.def);
    this.spawnWave(run);
  }

  update(dt) {
    const run = this.run;
    this.waveT += dt;

    // Wave goal: defeat the wave's enemy count, then the next wave starts. A wave whose goal
    // is 0 (the third entry of floors 5–7 in the data) means "no wave": straight to the guardian.
    const target = this.def.waves[Math.min(this.wave - 1, this.def.waves.length - 1)];
    if (!this.guardianDown && !this.pendingGuardian) {
      if (target <= 0 || this.waveCount >= target) {
        if (this.wave >= 3 || target <= 0) {
          // All waves done: wake the guardian. The spawn can be refused while the enemy cap
          // is full (corpses still fading); then keep trying every step instead of marking
          // it pending forever.
          this.pendingGuardian = !!this.awakenGuardian();
        } else {
          this.wave++;
          this.waveT = 0;
          this.waveCount = 0;
          run.banner(`Onda ${this.wave}!`);
          this.spawnWave(run);
        }
      }
    }

    // The mist (veil) presses on floors that have one.
    if (this.def.veil && !this.def.purified) {
      const p = run.player;
      // Damage ramps the longer the player stays away from the cleared centre.
      const centre = { x: 0, z: 0 };
      const d = Math.hypot(p.x - centre.x, p.z - centre.z);
      if (d > 6) {
        this.veilAcc = (this.veilAcc ?? 0) + dt * this.def.veil * 6;
        if (this.veilAcc >= 1) {
          run.hitPlayer(this.veilAcc, null);
          this.veilAcc = 0;
        }
      }
    }
  }

  countKill() {
    this.waveCount++;
  }

  /** Spawn the enemies for the current wave, scaled by the floor's curve (difficulty is inside hpMult). */
  spawnWave(run) {
    const def = this.def;
    const target = def.waves[Math.min(this.wave - 1, def.waves.length - 1)];
    const scale = this.scale();
    const pool = def.pool;
    const count = Math.min(target, Math.max(6, Math.round(target * 1.4)));
    for (let i = 0; i < count; i++) {
      const speciesId = run.rng.pick(pool);
      const tier = i < target * 0.15 ? "elite" : "normal";
      const angle = run.rng.range(0, Math.PI * 2);
      const r = run.rng.range(16, 34);
      const p = run.player;
      const half = run.biome.size / 2 - 3;
      let x = p.x + Math.cos(angle) * r;
      let z = p.z + Math.sin(angle) * r;
      x = clamp(x, -half, half);
      z = clamp(z, -half, half);
      run.spawnEnemy(speciesId, x, z, tier, scale);
    }
    this.waveCount = 0;
  }

  /** Spawn the floor guardian; returns the enemy, or null when the enemy cap refused it. */
  awakenGuardian() {
    const run = this.run;
    const g = this.def.guardian;
    const p = run.player;
    const angle = run.rng.range(0, Math.PI * 2);
    const x = p.x + Math.cos(angle) * 14;
    const z = p.z + Math.sin(angle) * 14;
    const half = run.biome.size / 2;
    const e = run.boss.spawn(
      g.id,
      clamp(x, -half + 3, half - 3),
      clamp(z, -half + 3, half - 3),
      g.kind === "boss" ? "guardian" : g.kind,
      this.scale()
    );
    if (e) run.banner(`O guardião do andar desperta!`);
    return e;
  }

  /** Called when the floor guardian is defeated. */
  onGuardianDown() {
    const run = this.run;
    this.guardianDown = true;
    this.pendingGuardian = false;
    if (this.floor >= 7 && !this.beyond) {
      this.cleared = true;
      run.state = "victory";
      run.opts.onVictory?.();
      return;
    }
    this.floor++;
    this.enterFloor();
  }
}
