// Spawn director: the zone's scripted timeline, species cards, free elites and the final swarm.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";
import { ZONE_SECS } from "../src/game/director.js";

test("the timeline spans the ten-minute zone: a card every 48–72 s up to 9.6 min, alphas at 150/330/480", () => {
  const { run } = makeRun();
  const tl = run.director.timeline;
  const cards = tl.filter((e) => e.kind === "card").map((e) => e.t);
  assert.ok(cards[0] === 60, "the first new species arrives at one minute");
  for (let i = 1; i < cards.length; i++) {
    const gap = cards[i] - cards[i - 1];
    assert.ok(gap >= 48 - 1e-9 && gap <= 72 + 1e-9, `card gap ${gap.toFixed(1)} s`);
  }
  assert.ok(cards.at(-1) < 9.6 * 60 && cards.at(-1) > 7 * 60, "cards keep coming late in the zone");
  assert.deepEqual(tl.filter((e) => e.kind === "alpha").map((e) => e.t), [150, 330, 480]);
  assert.ok(tl.every((e) => e.t < ZONE_SECS), "everything happens before the zone clock runs out");
  for (let i = 1; i < tl.length; i++) assert.ok(tl[i].t >= tl[i - 1].t, "sorted");
  // Zone 1 gets its first horde and elite wave later than the others.
  assert.ok(tl.some((e) => e.t === 235 && (e.kind === "swarm" || e.kind === "stampede")));
  assert.ok(tl.some((e) => e.t === 330 && e.kind === "elitewave"));
  run.stage = 2;
  run.director.onStage(2);
  const tl2 = run.director.timeline;
  assert.ok(tl2.some((e) => e.t === 200 && (e.kind === "swarm" || e.kind === "stampede")));
  assert.ok(tl2.some((e) => e.t === 270 && e.kind === "elitewave"));
});

test("every third card is a resident of the region; a new card outweighs the older ones", () => {
  const { run } = makeRun();
  const d = run.director;
  const residents = new Set(d.residentPool.map((p) => p.id));
  assert.ok(residents.size > 0, "the forest lists residents");
  // The constructor drew three cards: the second (index 1) is the resident one.
  assert.ok(residents.has(d.cards[1].id), "card 2 of 3 is a resident");
  d.addCard();
  const last = d.cards.at(-1);
  assert.equal(last.weight, 1.4);
  assert.ok(d.cards.slice(0, -1).every((c) => c.weight < 1.4));
  assert.ok(Math.abs(last.cost - (1 + d.data.get(last.id).bst / 220)) < 1e-9, "cost 1 + BST/220");
});

test("free spawns turn elite with a chance that grows by the minute and the zone, never in zone 1's first 90 s", () => {
  const { run } = makeRun();
  const d = run.director;
  d.rng = { chance: (p) => p > 0 }; // any positive chance hits
  run.stageTime = 89;
  assert.equal(d.eliteRoll(), false, "no elite before 90 s in zone 1");
  let seen = null;
  d.rng = { chance: (p) => ((seen = p), false) };
  run.stageTime = 300;
  d.eliteRoll();
  assert.ok(Math.abs(seen - (0.012 + 5 * 0.004)) < 1e-9, `zone 1 minute 5: ${seen}`);
  run.stage = 2;
  run.stageTime = 30;
  d.eliteRoll();
  assert.ok(Math.abs(seen - (0.012 + 0.5 * 0.004 + 0.03)) < 1e-9, "zone 2 rolls from the first second");
});

test("the final swarm spawns faster and adds elites", () => {
  const { run } = makeRun();
  run.player.iframes = 1e9;
  const d = run.director;
  run.stageTime = 120;
  for (const e of run.enemies) e.alive = false;
  run.update(1 / 60);
  const count = (fn) => {
    run.enemies.length = 0;
    d.spawnAccum = 0;
    for (let i = 0; i < 120; i++) d.update(1 / 60);
    return run.enemies.filter(fn).length;
  };
  const calm = count(() => true);
  d.startFinalSwarm();
  const swarm = count(() => true);
  assert.ok(swarm >= calm * 4, `six times the spawn rate (calm ${calm}, swarm ${swarm})`);
  let elites = 0;
  for (let k = 0; k < 10 && !elites; k++) elites = count((e) => e.tier === "elite");
  assert.ok(elites > 0, "elite bursts during the swarm");
});

test("strong species with no evolution line (BST ≥ 420) wait for zone 3", () => {
  const { run } = makeRun();
  const d = run.director;
  const strong = (p) => p.evoStage === 0 && p.bst >= 420 && !d.data.evolutionsOf(p.id).length;
  assert.equal(d.pool.filter(strong).length, 0, "zone 1 has none (Pheromosa used to open runs)");
  run.stage = 3;
  d.onStage(3);
  assert.ok(d.pool.some(strong), "zone 3 adds them");
});

test("a free elite drops a rare candy only sometimes; wave elites, alphas and bosses always do", () => {
  const { run } = makeRun();
  const p = run.player;
  const drops = (tier, random, free = tier === "elite") => {
    const orig = Math.random;
    Math.random = () => random;
    try {
      const e = run.spawnEnemy(16, p.x + 6, p.z, tier);
      e.freeElite = free;
      const before = run.pickups.length;
      run.killEnemy(e);
      return run.pickups.slice(before).filter((k) => k.kind === "candy").length;
    } finally {
      Math.random = orig;
    }
  };
  assert.equal(drops("elite", 0.5), 0, "no candy on a miss");
  assert.equal(drops("elite", 0.1), 1, "15 % hit");
  assert.equal(drops("elite", 0.99, false), 1, "an elite-wave elite keeps its candy");
  assert.ok(drops("alpha", 0.99) >= 1, "alphas keep their candy");
});
