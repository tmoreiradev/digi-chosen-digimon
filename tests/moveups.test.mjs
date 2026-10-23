// Move-upgrade cards must change what the attacks do, not only what mv.mods stores:
// pierce goes through more enemies, bounce ricochets, crit and status chances rise.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, loadData, withRandom } from "./_helpers.mjs";
import { buildMoveDef } from "../src/game/rules.js";

const data = loadData();
// A starter whose first kit move is a plain projectile ("bolt"), so shots fly straight.
const bolter = data.rules.roster.find((r) => {
  const m = data.getMoveByKey(r.kit[0]);
  return m && buildMoveDef(m, data.rules)?.arch === "bolt";
});
assert.ok(bolter, "the roster has a starter with a bolt as first move");

function shooter() {
  const { run } = makeRun({ speciesId: bolter.id });
  const p = run.player;
  p.x = 0;
  p.z = 0;
  const mv = p.moves[0];
  assert.equal(mv.def.arch, "bolt");
  return { run, mv };
}
const fly = (run, frames = 90) => {
  for (let i = 0; i < frames; i++) run.updateProjectiles(1 / 60);
};
const damaged = (e) => e.maxHp - e.hp;

test("+1 pierce: the bolt goes on to a second enemy in line (it used to stop at the first)", () => {
  for (const pierce of [0, 1]) {
    const { run, mv } = shooter();
    const a = run.spawnEnemy(16, 3, 0, "normal");
    const b = run.spawnEnemy(16, 6, 0, "normal");
    mv.mods.pierce = pierce;
    assert.equal(run.effectiveDef(mv).pierce, pierce);
    run.fireMove(mv);
    fly(run);
    assert.ok(damaged(a) > 0, "the first enemy is hit");
    assert.equal(damaged(b) > 0, pierce > 0, `second enemy hit only with pierce (pierce=${pierce})`);
  }
});

test("+1 bounce: the bolt ricochets to an enemy that was not in its path", () => {
  for (const bounce of [0, 1]) {
    const { run, mv } = shooter();
    const a = run.spawnEnemy(16, 3, 0, "normal");
    const b = run.spawnEnemy(16, 3, 5, "normal"); // off the line of fire
    mv.mods.bounce = bounce;
    run.fireMove(mv);
    fly(run);
    assert.ok(damaged(a) > 0);
    assert.equal(damaged(b) > 0, bounce > 0, `off-line enemy hit only with a bounce (bounce=${bounce})`);
  }
});

test("+crit raises the crit chance of every hit", () => {
  const { run, mv } = shooter();
  const p = run.player;
  const e = run.spawnEnemy(16, 3, 0, "normal");
  const hit = (crit) => {
    mv.mods.crit = crit;
    const before = e.hp;
    withRandom(0.99, () => run.hitEnemy(e, 10, run.effectiveDef(mv))); // 0.99 never crits naturally
    return before - e.hp;
  };
  const plain = hit(0);
  const critted = hit(1); // chance >= 1 after the upgrade
  assert.ok(Math.abs(critted / plain - p.stats.critDamage) < 1e-6, `crit multiplies by critDamage (${critted / plain} vs ${p.stats.critDamage})`);
});

test("+status raises the chance that a hit applies the move's status", () => {
  const { run, mv } = shooter();
  const e = run.spawnEnemy(16, 3, 0, "normal");
  if (!mv.def.status) mv.def = { ...mv.def, status: "burn", statusChance: 0.12 };
  const status = mv.def.status;
  mv.mods.status = 1;
  withRandom(0.5, () => run.hitEnemy(e, 1, run.effectiveDef(mv))); // 0.5 >= base 0.12-0.3: no status
  assert.equal(e.statuses[status] ?? 0, 0);
  mv.mods.status = 10; // x10 chance: certain
  withRandom(0.5, () => run.hitEnemy(e, 1, run.effectiveDef(mv)));
  assert.ok((e.statuses[status] ?? 0) > 0, `${status} applied once the chance is upgraded`);
});
