// 16th Codex round: a boss pool ticking under its own boss could weaken it (hostile zones went
// through hitEnemy) and still hit the player in the same tick. Hostile pools now hurt only the player.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";

const frames = (run, n) => {
  for (let i = 0; i < n; i++) run.update(1 / 60);
};

test("a boss pool hurts the player but never the horde or the boss itself", () => {
  const { run } = makeRun();
  run.director.update = () => {};
  const p = run.player;
  p.moves.length = 0;
  p.stats.evasion = 0;
  p.iframes = 1e9;
  run.stageTime = 299.99;
  frames(run, 2);
  const g = run.boss.enemy;
  g.x = p.x;
  g.z = p.z;
  g.hp = g.maxHp * (run.rules.capture.weakenHpPct + 0.001); // one pool tick would have weakened it
  const minion = run.spawnEnemy(16, p.x + 0.5, p.z, "normal");
  const minionHp = minion.hp;
  run.zonesHostile(g, p.x, p.z, 3, 5, 50);
  run.zones.at(-1).tick = 0;
  p.iframes = 0;
  const hp = p.hp;
  const bossHp = g.hp;
  run.updateProjectiles(1 / 60); // zones tick here; no contact damage from updateEnemies
  assert.ok(p.hp < hp, "the player standing in the pool takes damage");
  assert.equal(g.hp, bossHp, "the boss is not hurt by its own pool");
  assert.ok(!g.captureReady, "and not weakened by it");
  assert.equal(minion.hp, minionHp, "the horde is not hurt either");
});
