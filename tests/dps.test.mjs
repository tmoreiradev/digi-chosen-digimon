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

test("the estimate tracks measured single-target damage within 25 % (typeless target)", () => {
  for (const sp of [4, 7, 25, 63, 74, 92, 133]) {
    const run = levelled(sp);
    const est = run.playerExpectedDps();
    const e = run.spawnEnemy(16, run.player.x + 3, run.player.z, "boss") /* boss-sized target, as in a boss fight */;
    e.hp = e.maxHp = 1e9;
    e.speed = 0;
    e.types = []; // no type chart in the way: the estimate has no enemy terms
    const d0 = run.stats.damage;
    for (let i = 0; i < 1800; i++) run.update(1 / 60);
    const ratio = (run.stats.damage - d0) / 30 / est;
    assert.ok(ratio > 0.75 && ratio < 1.25, `species ${sp}: measured/estimate = ${ratio.toFixed(2)}`);
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

test("chain jumps add nothing against a lone target; ally hits take the player's multipliers", () => {
  const run = levelled(25); // Pikachu: Thunderbolt is a chain
  const chain = run.player.moves.find((m) => m.def.arch === "chain");
  assert.ok(chain, "a chain move");
  const base = run.playerExpectedDps();
  chain.mods.count += 3;
  assert.equal(run.playerExpectedDps(), base, "+3 jumps: same single-target DPS");

  const r2 = levelled(4);
  r2.allies.recruit(r2.data.get(16), 1, false);
  const before = r2.playerExpectedDps();
  r2.player.stats.critChance = 1;
  r2.player.heldItem = "choice-band";
  const moves = r2.player.moves.splice(0); // keep only the ally in the sum
  const allyOnly = r2.playerExpectedDps();
  r2.player.stats.critChance = 0;
  r2.player.heldItem = null;
  const allyPlain = r2.playerExpectedDps();
  r2.player.moves.push(...moves);
  assert.ok(Math.abs(allyOnly / allyPlain - 1.5 * r2.player.stats.critDamage) < 1e-9, "crit and Choice Band reach the ally term");
  assert.ok(before > allyPlain);
});

test("orb and boomerang: +count raises the estimate as much as the measured damage", () => {
  for (const [sp, arch] of [[25, "orb"], [74, "boomerang"]]) {
    const measure = (extra) => {
      const run = levelled(sp);
      run.player.moves = run.player.moves.filter((m) => m.def.arch === arch);
      assert.equal(run.player.moves.length, 1, sp + " has a " + arch);
      run.player.moves[0].mods.count += extra;
      const est = run.playerExpectedDps();
      const e = run.spawnEnemy(16, run.player.x + 3, run.player.z, "boss") /* boss-sized target, as in a boss fight */;
      e.hp = e.maxHp = 1e9;
      e.speed = 0;
      e.types = [];
      const d0 = run.stats.damage;
      for (let i = 0; i < 1800; i++) run.update(1 / 60);
      return { est, meas: (run.stats.damage - d0) / 30 };
    };
    const a = measure(0);
    const b = measure(1);
    assert.ok(b.est > a.est * 1.5, arch + ": +1 projectile doubles the estimate");
    assert.ok(b.meas > a.meas * 1.5, arch + ": and the measured damage (the fan no longer misses with an even count)");
    const r = b.meas / b.est;
    assert.ok(r > 0.75 && r < 1.25, arch + " +1: measured/estimate = " + r.toFixed(2));
    for (const extra of [3, 5]) {
      const c = measure(extra); // wide fans: the outer projectiles pass beside the boss
      const rc = c.meas / c.est;
      assert.ok(rc > 0.75 && rc < 1.25, arch + " +" + extra + ": measured/estimate = " + rc.toFixed(2));
    }
  }
});

test("lob bombs fly to the target, explode on landing only, and +count is counted", () => {
  const run = levelled(74); // Geodude: Rock Throw is a lob
  const p = run.player;
  run.player.moves = run.player.moves.filter((m) => m.def.arch === "lob");
  const e = run.spawnEnemy(16, p.x + 8, p.z, "normal");
  e.hp = e.maxHp = 1e9;
  e.speed = 0;
  e.types = [];
  const near = run.spawnEnemy(16, p.x + 3, p.z, "normal"); // under the arc, not the target
  near.hp = near.maxHp = 1e9;
  near.speed = 0;
  run.player.moves[0].timer = 0;
  // aim at the far one
  const nearest = run.nearestEnemy.bind(run);
  run.nearestEnemy = () => e.id;
  run.update(1 / 60);
  run.nearestEnemy = nearest;
  const bomb = run.projectiles.find((pr) => pr.lob);
  assert.ok(bomb, "a bomb was thrown");
  for (let i = 0; i < 60 && run.projectiles.includes(bomb); i++) run.update(1 / 60);
  assert.ok(!run.projectiles.includes(bomb), "it landed");
  assert.ok(Math.abs(bomb.x - e.x) < 2.5, `landed near the target (x ${bomb.x.toFixed(1)} vs ${e.x})`);
  assert.equal(near.hp, near.maxHp, "the enemy under the arc was not hit in the air");
  assert.ok(e.hp < e.maxHp, "the target took the blast");

  for (const extra of [3, 5]) {
    const r = levelled(74);
    r.player.moves = r.player.moves.filter((m) => m.def.arch === "lob");
    r.player.moves[0].mods.count += extra;
    const est = r.playerExpectedDps();
    const t = r.spawnEnemy(16, r.player.x + 3, r.player.z, "boss");
    t.hp = t.maxHp = 1e9;
    t.speed = 0;
    t.types = [];
    const d0 = r.stats.damage;
    for (let i = 0; i < 1800; i++) r.update(1 / 60);
    const ratio = (r.stats.damage - d0) / 30 / est;
    assert.ok(ratio > 0.75 && ratio < 1.25, `lob +${extra}: measured/estimate = ${ratio.toFixed(2)}`);
  }
});
