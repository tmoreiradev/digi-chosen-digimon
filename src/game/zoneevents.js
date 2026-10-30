// Zone events (the upstream's "world events"; chests, shop and altars are WorldEvents in events.js): one per zone from the director's timeline (Classic and Endless, never in the tower).
// Each lasts a few seconds of zone, changes the light (renderer.drawZoneEvent) and the rules:
// mist doubles XP and brings wind-type enemies, the storm drops lightning on marked spots,
// the eclipse brings the creatures of the night (one shiny), and the golden runner flees,
// dropping a coin on every hit.

import { PACK } from "../content/pack.js";

export const ZONE_EVENTS = {
  mist: { name: "Névoa espectral", dur: 45, xpMul: 2, types: ["flying", "ghost"], banner: "Névoa espectral! Uma névoa gelada cobre tudo... XP ×2" },
  storm: { name: "Tempestade elétrica", dur: 40, banner: "Tempestade elétrica! Caem raios: afaste-se das marcas amarelas" },
  eclipse: { name: "Eclipse", dur: 40, types: ["dark", "ghost"], banner: "Eclipse! A luz se apaga e saem os Pokémon da noite... e algum shiny" },
  golden: { name: "Pokémon dourado", dur: 25, banner: "Um Pokémon dourado! Solta moedas a cada golpe. Pegue-o antes que escape!" },
};

const STRIKE_WARN = 1.2; // seconds between the yellow mark and the bolt
const STRIKE_RADIUS = 1.8;

export class ZoneEvents {
  constructor(run) {
    this.run = run;
    this.active = null; // { kind, name, t, dur, marks, strikeCd, golden }
  }

  /** Seconds left of the active event (0 when none). */
  get left() {
    return this.active ? Math.max(0, this.active.dur - this.active.t) : 0;
  }

  get xpMul() {
    return (this.active && ZONE_EVENTS[this.active.kind].xpMul) || 1;
  }

  startRandom() {
    this.start(this.run.rng.pick(Object.keys(ZONE_EVENTS)));
  }

  start(kind) {
    const def = ZONE_EVENTS[kind];
    if (!def || this.active) return;
    const run = this.run;
    this.active = { kind, name: def.name, t: 0, dur: def.dur, marks: [], strikeCd: 1, golden: null };
    run.banner(def.banner);
    run.shake(0.15);
    if (def.types) {
      const spawned = this.spawnKin(def.types, 3 + run.stage);
      if (kind === "eclipse" && spawned[0]) spawned[0].shiny = true;
    }
    if (kind === "golden") {
      const spot = run.director.spawnPoint(12, 18);
      const e = spot && run.spawnEnemy(PACK.goldenRunner, spot.x, spot.z, "elite");
      if (e) {
        e.golden = true;
        e.flees = true;
        this.active.golden = e;
      }
    }
  }

  /** `n` enemies of the event's types at 20–27 u, from the zone's evolution stages (the director's cards as fallback). */
  spawnKin(types, n) {
    const run = this.run;
    const maxStage = run.stage === 1 ? 0 : run.stage === 2 ? 1 : 2;
    let pool = run.data.pokemon.filter((p) => !p.legendary && !p.mythical && p.evoStage <= maxStage && p.types.some((t) => types.includes(t)));
    if (!pool.length) pool = run.director.cards.map((c) => run.data.get(c.id)).filter(Boolean);
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
      const spot = run.director.spawnPoint(20, 27);
      const e = spot && run.spawnEnemy(run.rng.pick(pool).id, spot.x, spot.z, "normal");
      if (e) out.push(e);
    }
    return out;
  }

  update(dt) {
    const ev = this.active;
    if (!ev) return;
    ev.t += dt;
    if (ev.kind === "storm") this.updateStorm(ev, dt);
    if (ev.t < ev.dur) return;
    const g = ev.golden;
    if (g?.alive && !(g.dying > 0)) {
      g.alive = false;
      this.run.banner("O Pokémon dourado escapou!");
    }
    this.active = null;
  }

  updateStorm(ev, dt) {
    const run = this.run;
    const p = run.player;
    ev.strikeCd -= dt;
    if (ev.strikeCd <= 0 && ev.t < ev.dur - STRIKE_WARN) {
      ev.strikeCd = 1.4;
      // Near the player, so standing still is what gets punished.
      const a = run.rng.range(0, Math.PI * 2);
      const r = run.rng.range(0, 6);
      ev.marks.push({ x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, t: 0 });
    }
    for (let i = ev.marks.length - 1; i >= 0; i--) {
      const m = ev.marks[i];
      m.t += dt;
      if (m.t < STRIKE_WARN) continue;
      ev.marks.splice(i, 1);
      run.ring(m.x, 0.1, m.z, STRIKE_RADIUS * 1.4, 0xffd030, 0.35);
      run.burst(m.x, 1, m.z, 0xffd030, 12, "star");
      run.hitAround(m.x, m.z, STRIKE_RADIUS, 30 * run.director.hpMult(), { type: "electric", cls: "special" });
      if (Math.hypot(p.x - m.x, p.z - m.z) <= STRIKE_RADIUS) run.hitPlayer(p.maxHp * 0.15, null);
      run.shake(0.1);
    }
  }

  /** Run.hitEnemy: the golden runner drops a coin per hit, at most ~7 a second. */
  onHit(e) {
    const run = this.run;
    if (!e.golden || run.time - (e.coinT ?? -1) < 0.15) return;
    e.coinT = run.time;
    run.spawnPickup(e.x, e.z, "coin", 1);
  }

  /** Run.killEnemy: a shower of coins when the golden runner falls, whatever killed it. */
  onKill(e) {
    if (!e.golden) return;
    const run = this.run;
    for (let i = 0; i < 12; i++) run.spawnPickup(e.x + run.rng.range(-1.5, 1.5), e.z + run.rng.range(-1.5, 1.5), "coin", 1);
    run.banner("Pokémon dourado derrotado! Chuva de moedas!");
  }
}
