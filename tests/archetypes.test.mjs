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

test("an orb hits the same enemy at most every 0.5 s", () => {
  const { run } = makeRun();
  run.director.update = () => {};
  run.player.iframes = 1e9;
  const mv = withDef(run, "Petal Dance");
  const big = run.spawnEnemy(16, run.player.x + 2, run.player.z, "boss");
  big.hp = big.maxHp = 1e9;
  big.speed = 0;
  big.radius = 6; // always touching every orb
  const times = [];
  const orig = run.hitEnemy.bind(run);
  run.hitEnemy = (e, ...a) => {
    if (e === big) times.push(run.time);
    return orig(e, ...a);
  };
  run.fireMove(mv);
  mv.timer = 1e9;
  const orbs = run.projectiles.filter((pr) => pr.orbit).length;
  for (let i = 0; i < 120; i++) run.update(1 / 60);
  assert.ok(times.length >= orbs * 3 && times.length <= orbs * 5, `${times.length} hits from ${orbs} orbs in 2 s`);
});

test("Metronome's estimate is the mean full cast of its pool over its cooldown", () => {
  const { run } = makeRun();
  const mv = withDef(run, "Metronome");
  const pool = run.metronomePool();
  const mean = pool.reduce((t, d) => t + run.castDamage(d, mv), 0) / pool.length;
  const cd = Math.max(0.12, mv.def.cd / run.player.stats.attackSpeed);
  assert.ok(Math.abs(run.playerExpectedDps() - mean / cd) < 1e-9);
  run.player.stats.physical *= 2; // the called moves' class now counts
  assert.ok(run.playerExpectedDps() > mean / cd, "physical bonus reaches the physical moves Metronome calls");
});
