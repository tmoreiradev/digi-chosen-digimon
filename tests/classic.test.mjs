// Classic mode: zone guardians, the sanctuary with the biome's legendary, and victory.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";

const frames = (run, n) => {
  for (let i = 0; i < n; i++) run.update(1 / 60);
};

test("classic: the zone guardian spawns when the timer runs out and the zone waits for it to fall", () => {
  const { run, calls } = makeRun();
  run.player.iframes = 1e9;
  run.stageTime = 299.99;
  frames(run, 2);
  assert.equal(run.stage, 1, "the zone does not advance on the timer alone");
  assert.ok(run.boss.alive, "a guardian is up");
  assert.equal(run.boss.kind, "guardian");
  const guardian = run.boss.enemy;
  assert.ok(run.biome.guardians[0].includes(guardian.species.id), "picked from biome.guardians[zone]");
  assert.ok(calls.banners.some((b) => /guardian of the Green Forest/.test(b)));

  frames(run, 60);
  assert.equal(run.boss.enemy, guardian, "no second guardian while the first lives");
  assert.equal(run.stage, 1);

  guardian.hp = 0;
  frames(run, 1);
  assert.equal(run.stage, 2);
  assert.ok(run.stageTime < 1, "zone timer restarts");
  assert.ok(calls.banners.includes("Zone 1 cleared!"));
  assert.equal(run.zoneBossSpawned, false);
});

test("classic: after zone 3's guardian the sanctuary opens, the legendary arrives, beating it wins", () => {
  let victories = 0;
  const { run, calls } = makeRun({ opts: { onVictory: () => victories++ } });
  run.player.iframes = 1e9;
  for (let zone = 1; zone <= 3; zone++) {
    run.stageTime = 300;
    frames(run, 1);
    assert.equal(run.stage, zone);
    assert.equal(run.boss.kind, "guardian");
    run.boss.enemy.hp = 0;
    frames(run, 1);
  }
  assert.equal(run.sanctuary, true);
  assert.equal(run.stage, 3, "the stage counter stays at 3; the sanctuary is not zone 4");
  assert.ok(calls.banners.some((b) => /sanctuary/i.test(b)));

  frames(run, 60); // one second: the horde fades and nothing new spawns
  assert.equal(run.enemies.filter((e) => e.alive && e.dying <= 0).length, 0);
  assert.equal(run.boss.alive, false, "the legendary takes a moment to arrive");

  frames(run, 100); // past the 2.5 s arrival delay
  assert.ok(run.boss.alive);
  assert.equal(run.boss.kind, "legendary");
  assert.ok(run.biome.legendaries.includes(run.boss.enemy.species.id), "picked from biome.legendaries");
  assert.ok(calls.banners.some((b) => /the legendary!/.test(b)));

  run.boss.enemy.hp = 0;
  frames(run, 1);
  assert.equal(run.state, "victory");
  assert.equal(victories, 1);
  frames(run, 5);
  assert.equal(victories, 1, "victory fires once");
});

test("endless mode still advances on the timer without a guardian", () => {
  const { run } = makeRun({ mode: "endless" });
  run.stageTime = 300;
  frames(run, 1);
  assert.equal(run.stage, 2);
  assert.equal(run.boss.alive, false);
  assert.equal(run.sanctuary, false);
});

test("tower: a floor guardian's defeat still advances the floor (now through Run.onBossDefeated)", () => {
  const { run } = makeRun({ mode: "tower" });
  run.player.iframes = 1e9;
  assert.equal(run.tower.floor, 1);
  run.tower.awakenGuardian();
  assert.ok(run.boss.alive);
  run.boss.enemy.hp = 0;
  frames(run, 1);
  assert.equal(run.tower.floor, 2);
});

test("boss damage is capped to the fight budget and ramps after the stall limit", () => {
  const { run } = makeRun();
  const p = run.player;
  const e = run.boss.spawn(123, p.x + 5, p.z, "guardian");
  const hp0 = e.hp;
  run.hitEnemy(e, 1e9, { type: "normal", cls: "physical", status: null, statusChance: 0 });
  assert.ok(e.hp > 0, "one hit cannot delete a boss");
  assert.ok(hp0 - e.hp <= run.boss.capRate * 3 + 1e-6, "at most three seconds of budget per burst");
  assert.equal(run.boss.hitMul(), 1);
  run.boss.fightT = run.boss.fightSecs * 2 + 20;
  assert.equal(run.boss.hitMul(), 2, "2^(20/20) once the fight runs 20 s past twice its length");
  // The exhaust must widen the budget, not only the multiplier: refill the bank and hit again.
  run.time += 10;
  const hp1 = e.hp;
  run.hitEnemy(e, 1e9, { type: "normal", cls: "physical", status: null, statusChance: 0 });
  assert.ok(hp1 - e.hp > run.boss.capRate * 3 * 1.5, "an exhausted boss loses more than the base 3 s budget");
  assert.ok(hp1 - e.hp <= run.boss.capRate * 3 * 2 + 1e-6, "up to the budget scaled by the exhaust (x2)");
});

test("burn and poison ticks on a boss go through the same budget", () => {
  const { run } = makeRun();
  const p = run.player;
  const e = run.boss.spawn(123, p.x + 5, p.z, "guardian");
  e.burnDps = 1e9;
  e.statuses.burn = 3;
  const hp0 = e.hp;
  run.updateEnemies(1 / 60);
  assert.ok(e.hp > 0, "a tick cannot delete a boss either");
  assert.ok(hp0 - e.hp <= run.boss.capRate * 3 + 1e-6);
});

test("classic boss HP follows the boss curve, not the minute the zone happens to be at", () => {
  const hpAt = (stageTime) => {
    const { run } = makeRun();
    run.stageTime = stageTime;
    const e = run.boss.spawn(123, run.player.x + 5, run.player.z, "guardian");
    return e.maxHp;
  };
  const early = hpAt(0);
  const late = hpAt(299);
  assert.equal(early, late, "spawnEnemy's live curve used to make the minute-5 guardian ~4x tougher");
  assert.ok(early > 0);
  // The legendary is sized from zone 3 at minute 0, times legendaryHpMul.
  const { run } = makeRun();
  run.stage = 3;
  run.stageTime = 299;
  const legendary = run.boss.spawn(151, run.player.x + 5, run.player.z, "legendary");
  const guardianHere = hpAt(0);
  assert.ok(legendary.maxHp > guardianHere, "the legendary outclasses a zone-1 guardian");
  assert.ok(legendary.maxHp < guardianHere * 40, "but it is not the minute-5 live-curve monster");
});

test("the enemy list compacts dead entries so spawning never stalls for the rest of the run", () => {
  const { run } = makeRun();
  const p = run.player;
  for (let i = 0; i < 260; i++) run.spawnEnemy(16, p.x + 5 + (i % 10), p.z + Math.floor(i / 10), "normal");
  assert.equal(run.enemies.length, 260);
  assert.equal(run.spawnEnemy(16, p.x + 30, p.z, "normal"), null, "cap reached while everyone is alive");
  for (const e of run.enemies) e.alive = false;
  assert.ok(run.spawnEnemy(16, p.x + 30, p.z, "normal"), "spawns again once the dead are compacted");
  assert.equal(run.enemies.length, 1);
});
