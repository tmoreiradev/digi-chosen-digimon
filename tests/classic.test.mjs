// Classic mode: zone guardians, the sanctuary with the biome's legendary, and victory.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";
import { toughness } from "../src/game/rules.js";

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
  assert.ok(calls.banners.some((b) => /guardião da Floresta Verde/.test(b)));

  frames(run, 60);
  assert.equal(run.boss.enemy, guardian, "no second guardian while the first lives");
  assert.equal(run.stage, 1);

  guardian.hp = 0;
  frames(run, 1);
  assert.equal(run.stage, 2);
  assert.ok(run.stageTime < 1, "zone timer restarts");
  assert.ok(calls.banners.includes("Zona 1 limpa!"));
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
  assert.ok(calls.banners.some((b) => /santuário/i.test(b)));

  frames(run, 60); // one second: the horde fades and nothing new spawns
  assert.equal(run.enemies.filter((e) => e.alive && e.dying <= 0).length, 0);
  assert.equal(run.boss.alive, false, "the legendary takes a moment to arrive");

  frames(run, 100); // past the 2.5 s arrival delay
  assert.ok(run.boss.alive);
  assert.equal(run.boss.kind, "legendary");
  assert.ok(run.biome.legendaries.includes(run.boss.enemy.species.id), "picked from biome.legendaries");
  assert.ok(calls.banners.some((b) => /o lendário!/.test(b)));

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

for (const status of ["burn", "poison"]) {
  test(`${status} ticks on a boss go through the same budget`, () => {
    const { run } = makeRun();
    const p = run.player;
    const e = run.boss.spawn(123, p.x + 5, p.z, "guardian");
    e[status + "Dps"] = 1e9;
    e.statuses[status] = 3;
    const hp0 = e.hp;
    run.updateEnemies(1 / 60);
    assert.ok(e.hp > 0, "a tick cannot delete a boss either");
    assert.ok(hp0 - e.hp <= run.boss.capRate * 3 + 1e-6, "at most three seconds of budget");
    assert.ok(hp0 - e.hp > 0, "but the tick does land");
  });
}

test("tower: the director rests; waves and guardians scale by the floor's virtual minutes, not wall time", () => {
  const { run } = makeRun({ mode: "tower" });
  run.player.iframes = 1e9;
  frames(run, 60);
  assert.equal(run.director.elapsed, 0, "director.update never runs in the tower");
  const waveEnemy = (stageTime) => {
    const r = makeRun({ mode: "tower" }).run;
    r.stageTime = stageTime;
    r.enemies.length = 0;
    r.tower.wave = 2;
    r.tower.spawnWave(r);
    return r.enemies.find((e) => e.tier === "normal");
  };
  const early = waveEnemy(0);
  const late = waveEnemy(600);
  assert.equal(early.maxHp, late.maxHp, "ten minutes of wall time change nothing on the same floor and wave");
  const { run: r2 } = makeRun({ mode: "tower" });
  const expected = r2.director.hpMultAt(r2.tower.curveStage, r2.tower.vmin);
  r2.enemies.length = 0;
  r2.tower.spawnWave(r2);
  const e = r2.enemies.find((x) => x.tier === "normal");
  const base = (12 + e.species.bst * 0.055) * toughness(r2.tower.vmin * 60); // toughness follows the floor's minutes too
  assert.ok(Math.abs(e.maxHp / base - expected) < 1e-6, `HP = base x floor curve once (got x${(e.maxHp / base).toFixed(2)}, curve ${expected.toFixed(2)})`);
});

test("tower guardians: own tiers for totem/summoner, boss for floors 5-7, HP capped by the floor curve and sized by the fight budget", () => {
  const guardianAt = (floor) => {
    const { run } = makeRun({ mode: "tower" });
    run.player.iframes = 1e9;
    run.tower.floor = floor;
    for (const e of run.enemies) e.alive = false;
    run.update(1 / 60);
    const e = run.tower.awakenGuardian();
    return { e, run };
  };
  const f1 = guardianAt(1);
  assert.equal(f1.e.tier, "totem");
  assert.equal(f1.run.boss.kind, "totem");
  const f2 = guardianAt(2);
  assert.equal(f2.e.tier, "summoner");
  const f7 = guardianAt(7);
  assert.equal(f7.e.tier, "boss");
  assert.equal(f7.run.boss.kind, "guardian");
  // Sized by the budget within [curve/4, curve]: a level-1 player's budget is tiny, so the floor is the quarter-curve.
  const curveHp = (12 + f7.e.species.bst * 0.055) * f7.run.director.hpMultAt(f7.run.tower.curveStage, f7.run.tower.vmin) * 70;
  assert.ok(f7.e.maxHp <= curveHp + 1e-6, "never above the floor curve");
  assert.ok(f7.e.maxHp >= curveHp * 0.25 - 1e-6, "never below a quarter of it");
  assert.ok(f7.e.maxHp < 200000, `the summit guardian is not a 300k-HP wall for a low-level player (got ${Math.round(f7.e.maxHp)})`);
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

test("the director keeps spawning after a massacre: corpses are dropped every frame", () => {
  const { run } = makeRun();
  const p = run.player;
  run.player.iframes = 1e9;
  for (let i = 0; i < 240; i++) run.spawnEnemy(16, p.x + 5 + (i % 10), p.z + Math.floor(i / 10), "normal");
  for (const e of run.enemies) e.alive = false; // all dead, none compacted yet
  assert.equal(run.enemies.length, 240);
  run.update(1 / 60); // updateEnemies drops the corpses
  assert.equal(run.enemies.filter((e) => !e.alive).length, 0);
  run.director.spawnAccum = 5; // enough accumulated time for several spawns
  run.director.update(1 / 60);
  assert.ok(run.enemies.filter((e) => e.alive).length > 0, "the population cap no longer counts the dead");
});

test("dying in the same step the legendary falls is a defeat, not a victory", () => {
  let victories = 0;
  let deaths = 0;
  const { run } = makeRun({ opts: { onVictory: () => victories++, onDeath: () => deaths++ } });
  const p = run.player;
  run.stage = 3;
  run.enterSanctuary();
  frames(run, 160); // the legendary arrives
  assert.equal(run.boss.kind, "legendary");
  p.iframes = 0;
  p.stats.evasion = 0;
  p.hp = 1;
  const killer = run.spawnEnemy(16, p.x + 0.3, p.z, "normal");
  killer.atkCd = 0;
  run.boss.enemy.hp = 0; // falls in this same step, after the contact hit lands
  frames(run, 1);
  assert.equal(run.state, "dead");
  assert.equal(deaths, 1);
  assert.equal(victories, 0);
});

test("the legendary falling before a boss timer kills you in the same step is a victory", () => {
  let victories = 0;
  let deaths = 0;
  const { run } = makeRun({ opts: { onVictory: () => victories++, onDeath: () => deaths++ } });
  const p = run.player;
  run.stage = 3;
  run.enterSanctuary();
  frames(run, 160);
  assert.equal(run.boss.kind, "legendary");
  p.iframes = 0;
  p.stats.evasion = 0;
  run.later(0, () => run.hitPlayer(1e9, null)); // a "meteor" that lands after boss.update in this step
  run.boss.enemy.hp = 0;
  frames(run, 1);
  assert.equal(run.state, "victory");
  assert.equal(victories, 1);
  assert.equal(deaths, 0);
  assert.equal(p.dead, false);
});

test("tower: every floor reaches its guardian through the waves alone (a 0 wave goal is 'no wave')", () => {
  const { run } = makeRun({ mode: "tower" });
  run.player.iframes = 1e9;
  const floors = run.rules.tower.floors;
  for (let floor = 1; floor <= floors.length; floor++) {
    run.tower.floor = floor;
    run.tower.enterFloor();
    let guard = 0;
    while (!run.boss.alive && guard++ < 10) {
      // "All of this wave's enemies fell": count them and drop them, or the enemy cap
      // would refuse the guardian after a few floors of untouched waves.
      for (const e of run.enemies) e.alive = false;
      run.tower.waveCount = 1000;
      run.tower.update(1 / 60);
    }
    assert.ok(run.boss.alive, `floor ${floor} (${floors[floor - 1].name}, waves ${JSON.stringify(floors[floor - 1].waves)}) awakens its guardian`);
    run.boss.enemy.hp = 0;
    run.boss.update(1 / 60); // defeat → next floor (or victory on 7)
  }
  assert.equal(run.state, "victory");
});

test("tower: a guardian refused by the enemy cap is retried, not marked pending forever", () => {
  const { run } = makeRun({ mode: "tower" });
  const p = run.player;
  run.player.iframes = 1e9;
  for (const e of run.enemies) e.alive = false;
  run.update(1 / 60);
  while (run.enemies.length < 260) run.spawnEnemy(16, p.x + 30, p.z + 30, "normal"); // arena full
  run.tower.wave = 3;
  run.tower.waveCount = 1000;
  run.tower.update(1 / 60);
  assert.equal(run.boss.alive, false, "no room for the guardian");
  assert.equal(run.tower.pendingGuardian, false, "so it is not pending");
  for (const e of run.enemies) e.alive = false; // the horde fades
  run.update(1 / 60); // compaction + another tower step
  assert.ok(run.boss.alive, "the guardian arrives as soon as there is room");
  assert.equal(run.tower.pendingGuardian, true);
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
