// BACKLOG 23: playerExpectedDps sizes the boss HP budget. It used to underestimate the player 2–5x
// (no damage/physical/special/STAB/crit/projectile terms, attack speed counted twice, no allies).
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";

function levelled(speciesId) {
  const { run } = makeRun({ speciesId });
  run.director.update = () => {};
  run.player.iframes = 1e9;
  for (let i = 0; i < 8; i++) run.addXp(run.player.xpNext);
  return run;
}

test("the estimate tracks measured single-target damage within a factor of 1.5", () => {
  for (const sp of [1, 4, 7, 25, 92]) {
    const run = levelled(sp);
    const est = run.playerExpectedDps();
    const e = run.spawnEnemy(16, run.player.x + 3, run.player.z, "normal");
    e.hp = e.maxHp = 1e9;
    e.speed = 0;
    const d0 = run.stats.damage;
    for (let i = 0; i < 1800; i++) run.update(1 / 60);
    const ratio = (run.stats.damage - d0) / 30 / est;
    assert.ok(ratio > 1 / 1.5 && ratio < 1.5, `species ${sp}: measured/estimate = ${ratio.toFixed(2)}`);
  }
});

test("attack speed counts once; allies add their own damage", () => {
  const run = levelled(4);
  const base = run.playerExpectedDps();
  run.player.stats.attackSpeed *= 2;
  const fast = run.playerExpectedDps();
  assert.ok(fast / base < 2.01 && fast / base > 1.5, `x2 attack speed → x${(fast / base).toFixed(2)} (capped cooldowns can shave it)`);
  run.player.stats.attackSpeed /= 2;
  run.allies.recruit(run.data.get(16), 1, false);
  assert.ok(run.playerExpectedDps() > base, "an ally raises the estimate");
});
