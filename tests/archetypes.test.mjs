// Every damaging archetype must actually damage a target in front of the player. Measuring each one
// found three that did not: lob (exploded in place), orbit (sampled its ring once per cast) and
// random/Metronome (no power of its own). Trail needs movement; buff and weather deal no damage.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";
import { buildMoveDef } from "../src/game/rules.js";

const NO_DAMAGE = new Set(["buff", "weather", "trail", "fusion"]);

test("each damaging archetype hurts a stationary target 3 units away within 10 s", () => {
  const { run: probe } = makeRun();
  const byArch = new Map();
  for (const mv of probe.data.moves) {
    const def = buildMoveDef(mv, probe.rules);
    if (def && !NO_DAMAGE.has(def.arch) && !byArch.has(def.arch)) byArch.set(def.arch, mv);
  }
  assert.ok(byArch.size >= 20, `archetypes covered: ${byArch.size}`);
  const silent = [];
  for (const [arch, mv] of byArch) {
    const { run } = makeRun();
    run.director.update = () => {};
    const p = run.player;
    p.iframes = 1e9;
    p.moves = [{ def: buildMoveDef(mv, run.rules), level: 1, timer: 0.1, mods: { dmg: 1, cd: 1, count: 0, area: 1, speed: 1, dur: 1, pierce: 0, crit: 0, status: 1, bounce: 0 } }];
    const e = run.spawnEnemy(16, p.x + 3, p.z, "normal");
    e.hp = e.maxHp = 1e9;
    e.speed = 0;
    e.types = [];
    for (let i = 0; i < 600; i++) run.update(1 / 60);
    if (e.hp >= e.maxHp) silent.push(`${arch} (${mv.name})`);
  }
  assert.deepEqual(silent, []);
});

function withDef(run, name) {
  const def = buildMoveDef(run.data.moves.find((m) => m.name === name), run.rules);
  const mv = { def, level: 1, timer: 0.1, mods: { dmg: 1, cd: 1, count: 0, area: 1, speed: 1, dur: 1, pierce: 0, crit: 0, status: 1, bounce: 0 } };
  run.player.moves = [mv];
  return mv;
}

test("orbit at the projectile cap does not hijack an existing (hostile) projectile", () => {
  const { run } = makeRun();
  const mv = withDef(run, "Petal Dance");
  const e = run.spawnEnemy(16, run.player.x + 3, run.player.z, "normal");
  run.spawnHostileProjectile(e, 0, 0, 1, 99);
  const hostile = run.projectiles.at(-1);
  while (run.projectiles.length <= 600) run.projectiles.unshift({ ...hostile, hits: new Set() }); // fill to the cap; the real hostile one stays last
  const last = run.projectiles.at(-1);
  run.fireMove(mv);
  assert.equal(last.orbit, undefined, "the hostile projectile stays hostile");
  assert.equal(run.projectiles.filter((pr) => pr.orbit).length, 0);
});

test("an orb never hits the same enemy twice within 0.5 s, sweeping in and out of several", () => {
  const { run } = makeRun();
  run.director.update = () => {};
  run.player.iframes = 1e9;
  const mv = withDef(run, "Bone Rush");
  const radius = 1.6 + mv.def.area * 0.5;
  for (const a of [0, 1.1, 2.3, 3.9, 5.2]) {
    const e = run.spawnEnemy(16, run.player.x + Math.cos(a) * radius, run.player.z + Math.sin(a) * radius, "normal");
    e.hp = e.maxHp = 1e9;
    e.speed = 0;
  }
  const gaps = [];
  const watched = new WeakSet();
  for (let i = 0; i < 600; i++) {
    for (const pr of run.projectiles) {
      if (!pr.orbit || watched.has(pr)) continue;
      watched.add(pr);
      const last = new Map();
      const set = pr.orbit.hitT.set.bind(pr.orbit.hitT);
      pr.orbit.hitT.set = (id, time) => {
        if (last.has(id)) gaps.push(time - last.get(id));
        last.set(id, time);
        return set(id, time);
      };
    }
    run.update(1 / 60);
  }
  assert.ok(gaps.length > 10, "orbs re-hit enemies: " + gaps.length);
  assert.deepEqual(gaps.filter((g) => g < 0.5 - 1e-9), [], "no re-hit closer than 0.5 s");
});

test("Metronome's estimate matches what it actually deals (simulated, deterministic random)", () => {
  let seed = 12345;
  const orig = Math.random;
  Math.random = () => {
    // mulberry32: a deterministic, well-mixed stream
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  try {
    const { run } = makeRun();
    run.director.update = () => {};
    run.player.iframes = 1e9;
    withDef(run, "Metronome");
    const est = run.playerExpectedDps();
    const e = run.spawnEnemy(16, run.player.x + 2, run.player.z, "boss");
    e.hp = e.maxHp = 1e9;
    e.speed = 0;
    e.types = [];
    for (let i = 0; i < 60 * 290; i++) run.update(1 / 60); // before the zone guardian shows up at 300 s
    const ratio = (e.maxHp - e.hp) / 290 / est;
    assert.ok(ratio > 0.6 && ratio < 1.5, "measured/estimate = " + ratio.toFixed(2));
  } finally {
    Math.random = orig;
  }
});

test("trail: the estimate counts its ticks, +dur and the real tick multipliers", () => {
  for (const [name, dur, extra, crit] of [["Flame Wheel", 1, 0, 0], ["Flame Wheel", 2, 0, 0], ["Flame Wheel", 1, 0, 0.5]]) {
    {
      const { run } = makeRun();
      run.director.update = () => {};
      run.player.iframes = 1e9;
      const mv = withDef(run, name);
      mv.mods.dur = dur;
      mv.mods.count += extra;
      mv.mods.crit += crit; // a card crit does not reach the zone ticks
      run.player.stats.physical *= 3; // nor does the physical bonus: ticks are special hits
      const est = run.playerExpectedDps();
      const e = run.spawnEnemy(16, run.player.x + 2, run.player.z, "boss"); // in contact, as a chasing boss is
      e.hp = e.maxHp = 1e9;
      e.speed = 0;
      e.types = [];
      const d0 = run.stats.damage;
      for (let i = 0; i < 3600; i++) run.update(1 / 60);
      const ratio = (run.stats.damage - d0) / 60 / est;
      assert.ok(ratio > 0.75 && ratio < 1.25, name + " dur " + dur + " +" + extra + " crit " + crit + ": measured/estimate = " + ratio.toFixed(2));
    }
  }
});

test("trap ring: the estimate holds on average over the side the boss stands on (+dur too)", () => {
  for (const [extra, dur] of [[0, 1], [0, 2], [1, 1], [2, 1], [3, 1]]) {
    let measured = 0;
    let est = 0;
    const bearings = 8;
    for (let k = 0; k < bearings; k++) {
      const { run } = makeRun();
      run.director.update = () => {};
      run.player.iframes = 1e9;
      const mv = withDef(run, "Spikes");
      mv.mods.count += extra;
      mv.mods.dur = dur;
      est = run.playerExpectedDps();
      const a = ((k + 0.5) / bearings) * Math.PI * 2;
      const e = run.spawnEnemy(16, run.player.x + Math.cos(a) * 2, run.player.z + Math.sin(a) * 2, "boss");
      e.hp = e.maxHp = 1e9;
      e.speed = 0;
      e.types = [];
      for (let i = 0; i < 1800; i++) run.update(1 / 60);
      measured += (e.maxHp - e.hp) / 30 / bearings;
    }
    const ratio = measured / est;
    assert.ok(ratio > 0.75 && ratio < 1.25, "Spikes +" + extra + " dur " + dur + ", mean over bearings: measured/estimate = " + ratio.toFixed(2));
  }
});
