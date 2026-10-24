// 15th Codex round: a boss's attacks in flight die the instant it is weakened (not at the next
// Boss.update, after projectiles and zones already ticked), and a frozen/asleep/rooted/flinching
// boss aborts its charge instead of ramming through the status.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";

const frames = (run, n) => {
  for (let i = 0; i < n; i++) run.update(1 / 60);
};
function setup() {
  const made = makeRun();
  made.run.director.update = () => {};
  made.run.player.moves.length = 0;
  made.run.player.stats.evasion = 0;
  return made;
}
/** Zone guardian up, parked `dist` units to the player's right, no other enemies. */
function guardianAt(run, dist) {
  const p = run.player;
  p.iframes = 1e9;
  run.stageTime = 299.99;
  frames(run, 2);
  const boss = run.boss;
  const g = boss.enemy;
  for (const e of run.enemies) if (e !== g) {
    e.hp = 0;
    e.dying = 0.01;
  }
  frames(run, 2);
  g.x = p.x + dist;
  g.z = p.z;
  g.vx = g.vz = 0;
  boss.windup = 0;
  boss.active = null;
  p.iframes = 0;
  return { boss, g };
}
const hostileLeft = (run) => run.projectiles.filter((pr) => pr.hostile && !pr.cancelled).length + run.zones.filter((z) => z.hostile && !z.cancelled).length;

test("control: a hostile projectile about to land hits the player while the boss fights on", () => {
  const { run } = setup();
  const p = run.player;
  const { g } = guardianAt(run, 1.4);
  run.spawnHostileProjectile(g, Math.PI, 20, 10, 2, 0.6); // flies from the boss toward the player
  const hp = p.hp;
  frames(run, 5);
  assert.ok(p.hp < hp, "the control projectile lands");
});

test("a hit that weakens the boss kills its projectiles and pools before they can land", () => {
  const { run } = setup();
  const p = run.player;
  const { boss, g } = guardianAt(run, 1.4);
  run.spawnHostileProjectile(g, Math.PI, 20, 10, 2, 0.6);
  run.rng.range = (lo) => lo;
  boss.nextMove = "pools";
  boss.release();
  assert.ok(hostileLeft(run) >= 2, "projectile and pools in flight");
  g.hp = g.maxHp * 0.05;
  run.hitEnemy(g, 1, null); // the weakening hit, outside any update: cancellation must not wait for Boss.update
  assert.equal(g.captureReady, true);
  assert.equal(hostileLeft(run), 0, "everything flagged the instant the boss went down");
  const hp = p.hp;
  frames(run, 10);
  assert.equal(p.hp, hp, "nothing landed");
  assert.equal(run.projectiles.filter((pr) => pr.hostile).length + run.zones.filter((z) => z.hostile).length, 0, "and the loops dropped them");
});

test("control: an unhindered charge moves the boss and rams the player", () => {
  const { run } = setup();
  const p = run.player;
  const { boss, g } = guardianAt(run, 8);
  boss.nextMove = "charge";
  boss.release();
  const x0 = g.x;
  const hp = p.hp;
  frames(run, 30);
  assert.ok(Math.abs(g.x - x0) > 1, "the boss moved");
  assert.ok(p.hp < hp, "and hit the player");
});

test("a frozen, asleep, rooted or flinching boss aborts its charge and waits the status out", () => {
  for (const status of ["freeze", "sleep", "root", "flinch"]) {
    const { run } = setup();
    const p = run.player;
    const { boss, g } = guardianAt(run, 8);
    boss.nextMove = "charge";
    boss.release();
    assert.equal(boss.active?.kind, "charge");
    g.statuses[status] = 1;
    const x0 = g.x;
    const hp = p.hp;
    frames(run, 30);
    assert.ok(Math.abs(g.x - x0) < 1e-6, `${status}: the charge did not move it`);
    assert.equal(p.hp, hp, `${status}: no hit`);
    assert.equal(boss.active, null, `${status}: the pattern was dropped`);
    assert.equal(boss.windup, 0);
    const moveT = boss.moveT;
    frames(run, 60); // the status (1 s) wears off halfway through
    assert.ok(boss.moveT < moveT || boss.windup > 0 || boss.active !== null, `${status}: the controller resumed`);
  }
});
