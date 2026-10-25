// Combat phase: overheal, the statuses moves really carry (paralysis/stun/knock were dead under
// their data names), Wet, Confused, Charmed, Heal Block, sleep and root as in the upstream glossary,
// the elemental reactions and the dive.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, withRandom, spawnAlpha } from "./_helpers.mjs";
import { REACTIONS } from "../src/game/combat.js";

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
function dummy(run, x, z, tier = "normal") {
  const e = run.spawnEnemy(16, x, z, tier);
  e.hp = e.maxHp = 1e6;
  e.types = [];
  return e;
}
/** One explicit hit of `type`, no crit, no status roll; returns the damage dealt. */
function hit(run, e, type, extra = {}) {
  const before = e.hp;
  withRandom(0.999, () => run.hitEnemy(e, 100, { type, cls: "special", ...extra }, true));
  return before - e.hp;
}

test("overheal: heals past max HP become extra HP (up to the stat) that soaks damage before the shield", () => {
  const { run } = setup();
  const p = run.player;
  p.stats.overheal = 0.2;
  p.hp = p.maxHp - 10;
  run.healPlayer(1000);
  assert.equal(p.hp, p.maxHp);
  assert.ok(Math.abs(p.overhealHp - p.maxHp * 0.2) < 1e-9, "capped at 20 % of max HP");
  p.shield = 50;
  p.iframes = 0;
  const over = p.overhealHp;
  run.hitPlayer(5 / (1 - p.stats.armor / (p.stats.armor + 45)), null);
  assert.ok(Math.abs(p.overhealHp - (over - 5)) < 1e-6, "overheal took it");
  assert.equal(p.shield, 50, "the shield untouched");
  const { run: r2 } = setup();
  r2.player.hp = r2.player.maxHp;
  r2.healPlayer(1000);
  assert.ok(!(r2.player.overhealHp > 0), "no overheal stat, no extra HP");
});

test("the statuses moves carry now work: paralysis halves speed, stun pins, knock pushes; bosses shrug stun and knock", () => {
  const { run } = setup();
  const p = run.player;
  p.iframes = 1e9;
  const e = run.spawnEnemy(16, p.x + 10, p.z, "normal");
  withRandom(0, () => run.hitEnemy(e, 1, { type: "electric", cls: "special", status: "paralysis", statusChance: 1 }, true));
  assert.ok(e.statuses.para > 0, "\"paralysis\" (data name) lands as para");
  const x0 = e.x;
  frames(run, 30);
  const slow = x0 - e.x;
  const free = run.spawnEnemy(16, p.x + 10, p.z + 3, "normal");
  const f0 = free.x;
  frames(run, 30);
  assert.ok(slow < (f0 - free.x) * 0.75, `paralysed moves slower (${slow.toFixed(2)} vs ${(f0 - free.x).toFixed(2)})`);

  const s = run.spawnEnemy(16, p.x + 6, p.z - 3, "normal");
  withRandom(0, () => run.hitEnemy(s, 1, { type: "rock", cls: "physical", status: "stun", statusChance: 1 }, true));
  const sx = s.x;
  frames(run, 20);
  assert.ok(Math.abs(s.x - sx) < 1e-6, "stunned: pinned");

  const k = run.spawnEnemy(16, p.x + 2, p.z, "normal");
  const kx = k.x;
  withRandom(0, () => run.hitEnemy(k, 1, { type: "fighting", cls: "physical", status: "knock", statusChance: 1 }, true));
  assert.ok(Math.abs(k.x - kx - 1.5) < 1e-6, "knocked 1.5 u away from the player");

  const b = run.spawnEnemy(16, p.x + 2, p.z + 2, "boss");
  const bx = b.x;
  withRandom(0, () => {
    run.hitEnemy(b, 1, { type: "fighting", cls: "physical", status: "knock", statusChance: 1 }, true);
    run.hitEnemy(b, 1, { type: "rock", cls: "physical", status: "stun", statusChance: 1 }, true);
  });
  assert.equal(b.x, bx);
  assert.ok(!(b.statuses.stun > 0));
});

test("wet lasts 5 s; heal block keeps an escaped alpha weak", () => {
  const { run } = setup();
  const p = run.player;
  p.iframes = 1e9;
  const e = dummy(run, p.x + 5, p.z);
  withRandom(0, () => run.hitEnemy(e, 1, { type: "water", cls: "special", status: "wet", statusChance: 1 }, true));
  assert.equal(e.statuses.wet, 5);
  const a = spawnAlpha(run, 16);
  a.hp = a.maxHp * 0.05;
  run.hitEnemy(a, 1, null);
  a.statuses.healblock = 6;
  p.x = a.x;
  p.z = a.z;
  withRandom(0.999, () => run.capture.throw());
  assert.ok(a.hp < a.maxHp * 0.1, "no recovery to 30 % under Heal Block");
});

test("confused enemies wander, never bite the player and hurt the enemies they bump into", () => {
  const { run } = setup();
  const p = run.player;
  p.iframes = 0;
  const c = dummy(run, p.x + 0.4, p.z);
  c.statuses.confusion = 3;
  c.speed = 0; // stays on top of the player and the other enemy
  const other = dummy(run, c.x + 0.3, c.z);
  other.speed = 0;
  other.statuses.stun = 10; // so it does not bite either
  const hp = p.hp;
  frames(run, 60);
  assert.equal(p.hp, hp, "no bite from a confused enemy");
  assert.ok(other.hp < other.maxHp, "it hurt its neighbour");
});

test("charmed: common enemies stop attacking, stronger ones hit 40 % softer", () => {
  const bite = (tier, charmed) => {
    const { run } = setup();
    const p = run.player;
    const e = run.spawnEnemy(16, p.x + 0.3, p.z, tier);
    e.speed = 0;
    if (charmed) e.statuses.charm = 3;
    const hp = p.hp;
    p.iframes = 0;
    withRandom(0.999, () => frames(run, 2));
    return hp - p.hp;
  };
  assert.ok(bite("normal", false) > 0);
  assert.equal(bite("normal", true), 0);
  const elite = bite("elite", false);
  assert.ok(Math.abs(bite("elite", true) / elite - 0.6) < 1e-6);
});

test("sleep: one x1.8 hit wakes it; root slows by 65 % instead of pinning", () => {
  const { run } = setup();
  const e = dummy(run, 5, 5);
  const base = hit(run, e, "normal");
  e.statuses.sleep = 3;
  assert.ok(Math.abs(hit(run, e, "normal") / base - 1.8) < 1e-9);
  assert.equal(e.statuses.sleep, 0, "awake");
  assert.ok(Math.abs(hit(run, e, "normal") / base - 1) < 1e-9, "no second x1.8");

  const { run: r2 } = setup();
  const p = r2.player;
  p.iframes = 1e9;
  const rooted = r2.spawnEnemy(16, p.x + 10, p.z, "normal");
  const free = r2.spawnEnemy(16, p.x + 10, p.z + 4, "normal");
  rooted.statuses.root = 2;
  const [r0, f0] = [rooted.x, free.x];
  frames(r2, 30);
  const ratio = (r0 - rooted.x) / (f0 - free.x);
  assert.ok(ratio > 0.2 && ratio < 0.5, `rooted moves at about 35 % (${ratio.toFixed(2)})`);
});

test("every reaction boosts the hit by its multiplier, counts, and consumes its status when it should", () => {
  for (const r of REACTIONS) {
    const { run } = setup();
    const e = dummy(run, 5, 5);
    const type = r.types[0];
    const base = hit(run, e, type);
    e.statuses[r.status] = 3;
    const boosted = hit(run, e, type);
    const sleepMul = r.status === "sleep" ? 1.8 : 1;
    const freezeMul = r.status === "freeze" ? 1.2 : 1;
    assert.ok(Math.abs(boosted / base - r.mul * sleepMul * freezeMul) < 1e-9, `${r.key}: x${(boosted / base).toFixed(2)}`);
    assert.equal(run.stats.reactions, 1, `${r.key} counted`);
    assert.ok(run.floaters.some((f) => f.text === r.name), `${r.key} floater`);
    if (r.consume && r.key !== "flashfreeze") assert.ok(!(e.statuses[r.status] > 0), `${r.key} consumed ${r.status}`);
  }
});

test("reaction side effects: electrocute jumps, flash freeze, steam, wildfire, shatter, poison gas, nightmare, mind crash", () => {
  const scene = () => {
    const { run } = setup();
    run.player.iframes = 1e9;
    return { run, e: dummy(run, 5, 5), n: dummy(run, 7, 5), far: dummy(run, 30, 30) };
  };
  {
    const { run, e, n, far } = scene();
    e.statuses.wet = 5;
    n.statuses.wet = 5;
    far.statuses.wet = 5;
    hit(run, e, "electric");
    assert.ok(n.hp < n.maxHp && n.statuses.wet === 0, "jumped to the wet neighbour");
    assert.equal(far.hp, far.maxHp, "not beyond 9 u");
  }
  {
    const { run, e } = scene();
    e.statuses.wet = 5;
    hit(run, e, "ice");
    assert.ok(e.statuses.freeze > 0 && !(e.statuses.wet > 0), "wet + ice freezes at once");
  }
  {
    const { run, e, n } = scene();
    e.statuses.burn = 3;
    hit(run, e, "water");
    assert.ok(n.statuses.confusion > 0 && n.statuses.root > 0, "steam confuses and roots around");
  }
  {
    const { run, e, n } = scene();
    e.statuses.burn = 3;
    e.burnDps = 7;
    hit(run, e, "grass");
    assert.ok(n.statuses.burn > 0 && n.burnDps === 7 && e.statuses.burn > 0, "wildfire spreads, keeps the burn");
  }
  {
    const { run, e, n } = scene();
    e.statuses.freeze = 1.6;
    hit(run, e, "rock");
    assert.ok(n.hp < n.maxHp, "shatter shards");
  }
  {
    const { run, e, n } = scene();
    e.statuses.poison = 3;
    hit(run, e, "fire");
    assert.ok(n.hp < n.maxHp && n.statuses.poison > 0, "poison gas explodes and poisons");
  }
  {
    const { run, e } = scene();
    run.player.hp = 10;
    e.statuses.sleep = 3;
    hit(run, e, "ghost");
    assert.ok(run.player.hp > 10, "nightmare heals");
  }
  {
    const { run, e } = scene();
    e.statuses.para = 3;
    hit(run, e, "psychic");
    assert.ok(e.statuses.confusion > 0, "mind crash confuses");
  }
});

test("dive: Shift in the air slams down and the landing hurts around, more from higher", () => {
  const dive = (height) => {
    const { run, input } = setup();
    const p = run.player;
    p.iframes = 1e9;
    const e = dummy(run, p.x + 2, p.z);
    e.speed = 0;
    p.grounded = false;
    p.y = height;
    p.vy = 0;
    input.dash = true;
    run.update(1 / 60);
    input.dash = false;
    assert.equal(p.diving, true);
    for (let i = 0; i < 120 && !p.grounded; i++) run.update(1 / 60);
    assert.equal(p.diving, false, "landed");
    return e.maxHp - e.hp;
  };
  const low = dive(0.5);
  const high = dive(3);
  assert.ok(low > 0, "the shockwave hits");
  assert.ok(high > low * 1.5, `higher fall, harder hit (${low.toFixed(0)} → ${high.toFixed(0)})`);

  const { run, input } = setup(); // on the ground Shift is still the dash
  input.dash = true;
  input.right = true;
  run.update(1 / 60);
  assert.ok(run.player.dashT > 0 && !run.player.diving);
});

test("charm softens the boss's special attacks too (projectiles, pools, charges)", () => {
  const { run } = setup();
  const p = run.player;
  run.stageTime = 299.99;
  p.iframes = 1e9;
  frames(run, 2);
  const g = run.boss.enemy;
  const taken = (charmed) => {
    g.statuses.charm = charmed ? 3 : 0;
    p.iframes = 0;
    p.hp = p.maxHp;
    p.shield = 0;
    withRandom(0.999, () => run.hitPlayer(20, null, g)); // what a boss projectile or pool calls
    return p.maxHp - p.hp;
  };
  const plain = taken(false);
  assert.ok(Math.abs(taken(true) / plain - 0.6) < 1e-9);
  g.statuses.charm = 3;
  run.spawnHostileProjectile(g, 0, 0, 20, 2, 5); // sits on the player
  run.projectiles.at(-1).x = p.x;
  run.projectiles.at(-1).z = p.z;
  p.iframes = 0;
  p.hp = p.maxHp;
  withRandom(0.999, () => run.updateProjectiles(1 / 60));
  assert.ok(Math.abs((p.maxHp - p.hp) / plain - 0.6) < 1e-6, "a real projectile carries its owner");
});

test("area damage, reactions and the dive also wake a sleeper with the x1.8", () => {
  const { run } = setup();
  const e = dummy(run, 5, 5);
  run.hitAround(5, 5, 1, 100, { type: "normal", cls: "special" });
  const base = e.maxHp - e.hp;
  e.statuses.sleep = 3;
  const before = e.hp;
  run.hitAround(5, 5, 1, 100, { type: "normal", cls: "special" });
  assert.ok(Math.abs((before - e.hp) / base - 1.8) < 1e-9);
  assert.equal(e.statuses.sleep, 0);
});
