// 14th Codex round (phases 9–11): Poké Doll applied at pickup, stopped statuses really stop, the
// capture weaken check shared by every damage path, and a weakened/caught boss's pending attacks die.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, withRandom } from "./_helpers.mjs";
import { SCRIPTED } from "../src/game/scripted.js";

const frames = (run, n) => {
  for (let i = 0; i < n; i++) run.update(1 / 60);
};
function setup(opts) {
  const made = makeRun(opts);
  made.run.director.update = () => {};
  made.run.player.moves.length = 0;
  made.run.player.stats.evasion = 0;
  return made;
}
const UNIMPLEMENTED = []; // since phase 23 every scripted item is offered (Secret Key and Dowsing Machine adapted)

test("the scripted items without an implementation all exist in the data and none is offered", () => {
  const { run } = setup();
  const pool = new Set(run.itemPool().map((u) => u.key));
  const noMods = run.rules.upgrades.filter((u) => !(u.mods ?? []).length).map((u) => u.key);
  assert.equal(noMods.length, SCRIPTED.size + UNIMPLEMENTED.length, "all 38 scripted items are implemented");
  for (const k of UNIMPLEMENTED) {
    assert.ok(noMods.includes(k), `${k} is a scripted item in rules.json`);
    assert.ok(!SCRIPTED.has(k) && !pool.has(k), `${k} is not offered`);
  }
});

test("Poké Doll scales the allies' passive on pickup, no other recompute needed", () => {
  const { run } = setup();
  const p = run.player;
  run.allies.recruit(run.data.get(16), 1, false);
  run.recompute(p);
  const before = p.stats.damage;
  run.applyChoice({ kind: "item", key: "poke-doll" });
  const boost = run.rules.allies.supportBoost;
  assert.ok(Math.abs(p.stats.damage / before - (1 + boost * 1.5) / (1 + boost)) < 1e-9, `damage ${before} → ${p.stats.damage}`);
});

test("frozen, asleep and rooted enemies neither move nor bite until the status ends", () => {
  for (const status of ["freeze", "sleep", "root"]) {
    const { run } = setup();
    const p = run.player;
    p.iframes = 0;
    const e = run.spawnEnemy(16, p.x + 0.5, p.z, "normal"); // already touching
    e.statuses[status] = 1;
    const x0 = e.x;
    const hp = p.hp;
    frames(run, 30);
    assert.ok(Math.abs(e.x - x0) < 1e-6, `${status}: no movement`);
    assert.equal(p.hp, hp, `${status}: no contact damage`);
    frames(run, 60);
    assert.ok(p.hp < hp, `${status}: bites again once it wears off`);
  }
});

test("items' area damage, burn ticks and thorns all hand a low alpha to the capture flow", () => {
  const { run } = setup();
  const p = run.player;
  p.iframes = 1e9;
  const pct = run.rules.capture.weakenHpPct;

  const a = run.spawnEnemy(16, p.x + 2, p.z, "alpha");
  a.hp = a.maxHp * (pct + 0.02);
  run.hitAround(a.x, a.z, 1, a.maxHp * 0.05, { type: "fire", cls: "special" });
  assert.equal(a.captureReady, true, "area damage weakens");
  run.capture.reset();
  a.captureReady = false;

  const b = run.spawnEnemy(16, p.x + 2, p.z + 3, "alpha");
  b.hp = b.maxHp * (pct + 0.005);
  b.statuses.burn = 5;
  b.burnDps = b.maxHp * 0.02;
  frames(run, 60);
  assert.equal(b.captureReady, true, "a burn tick weakens");
  run.capture.reset();
  b.captureReady = false;

  p.iframes = 0;
  p.stats.thorns = 1e3;
  const c = run.spawnEnemy(16, p.x + 0.5, p.z, "alpha");
  c.hp = c.maxHp * (pct + 0.005);
  c.maxHp = Math.max(c.maxHp, 1e4); // thorns must not kill it outright
  c.hp = c.maxHp * (pct + 0.005);
  run.hitPlayer(1, c);
  assert.equal(c.captureReady, true, "thorns weaken");
});

/** Put the zone guardian up and make its RNG land every meteor 2 units from the player. */
function guardianWithMeteors(run) {
  run.player.iframes = 1e9;
  run.stageTime = 299.99;
  frames(run, 2);
  const boss = run.boss;
  assert.ok(boss.alive);
  run.rng.range = (lo) => lo; // a = 0, r = 2: every meteor hits
  boss.windup = 0;
  boss.active = null;
  boss.nextMove = "meteor";
  boss.release();
  assert.ok(run.timers.length >= 5, "meteors scheduled");
  run.player.iframes = 0;
  return boss;
}

test("meteors already scheduled still land on a boss that keeps fighting (control)", () => {
  const { run } = setup();
  guardianWithMeteors(run);
  const hp = run.player.hp;
  frames(run, 150);
  assert.ok(run.player.hp < hp, "the control case takes meteor damage");
});

test("weakening the boss cancels its scheduled meteors and pools", () => {
  const { run } = setup();
  const boss = guardianWithMeteors(run);
  boss.nextMove = "pools";
  boss.release();
  assert.ok(run.zones.some((z) => z.hostile), "pools on the ground");
  const e = boss.enemy;
  e.hp = e.maxHp * 0.05;
  run.hitEnemy(e, 1, null);
  assert.equal(e.captureReady, true);
  const hp = run.player.hp;
  frames(run, 150);
  assert.equal(run.player.hp, hp, "no meteor lands while the boss is down");
  assert.ok(!run.zones.some((z) => z.hostile), "its pools are gone");
});

test("catching the boss cancels its scheduled meteors; the next zone starts clean", () => {
  const { run } = setup();
  const boss = guardianWithMeteors(run);
  const e = boss.enemy;
  e.hp = e.maxHp * 0.05;
  run.hitEnemy(e, 1, null);
  run.player.x = e.x;
  run.player.z = e.z;
  assert.equal(withRandom(0, () => run.capture.throw()), "caught");
  assert.equal(run.stage, 2);
  const hp = run.player.hp;
  frames(run, 150);
  assert.equal(run.player.hp, hp, "no meteor from the caught guardian");
});
