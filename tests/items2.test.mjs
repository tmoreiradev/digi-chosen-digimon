// Phase 17: the second wave of upstream scripted items (14 of the 16 left out in phase 11); phase 23
// adds Secret Key and Dowsing Machine, adapted to the Ancient Altar and chests (no Unown altars here).
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./_dom.mjs";

installFakeDom().register("ui");
const { makeRun, withRandom } = await import("./_helpers.mjs");

function setup(opts) {
  const made = makeRun(opts);
  made.run.director.update = () => {};
  made.run.player.moves.length = 0;
  made.run.player.stats.evasion = 0;
  return made;
}
const give = (run, key, n = 1) => {
  for (let i = 0; i < n; i++) run.applyChoice({ kind: "item", key });
  run.player.stats.evasion = 0;
};
const frames = (run, n) => {
  for (let i = 0; i < n; i++) run.update(1 / 60);
};
function sturdy(run, x, z, tier = "normal") {
  const e = run.spawnEnemy(16, x, z, tier);
  e.hp = e.maxHp = 1e6;
  e.speed = 0;
  return e;
}
const NORMAL = { type: "normal", cls: "special" };

test("Eviolite: +50 % armour and +25 % HP only while the species can evolve", () => {
  const { run } = setup(); // Bulbasaur evolves
  const p = run.player;
  const armor = p.stats.armor;
  const hp = p.maxHp;
  give(run, "eviolite");
  assert.ok(Math.abs(p.stats.armor / armor - 1.5) < 1e-9);
  assert.equal(p.maxHp, Math.round(hp * 1.25));
  const { run: end } = setup({ speciesId: 3 }); // Venusaur: end of the line
  const a3 = end.player.stats.armor;
  give(end, "eviolite");
  assert.equal(end.player.stats.armor, a3, "no bonus at the end of the line");
});

test("Adrenaline Orb: a hit gives 3 s of extra move and attack speed", async () => {
  const { itemAtkMul, itemMoveMul } = await import("../src/game/scripted.js");
  const { run } = setup();
  const p = run.player;
  give(run, "adrenaline-orb");
  p.iframes = 0;
  run.hitPlayer(5, null);
  assert.equal(p.adrenalineT, 3);
  assert.ok(Math.abs(itemMoveMul(run) - 1.2) < 1e-9 && Math.abs(itemAtkMul(run) - 1.12) < 1e-9);
  frames(run, 60);
  assert.ok(p.adrenalineT > 1.9 && p.adrenalineT < 2.1);
  frames(run, 130);
  assert.ok(p.adrenalineT <= 0, "wears off");
  assert.equal(itemMoveMul(run), 1);
});

test("Metal Powder: standing still for half a second raises armour (damage taken drops)", async () => {
  const { itemArmorMul, itemAtkMul } = await import("../src/game/scripted.js");
  const { run, input } = setup();
  give(run, "metal-powder");
  frames(run, 20);
  assert.equal(itemArmorMul(run), 1, "not yet");
  frames(run, 20);
  assert.ok(Math.abs(itemArmorMul(run) - 1.3) < 1e-9);
  assert.ok(Math.abs(itemAtkMul(run) - 1.08) < 1e-9);
  input.right = true;
  frames(run, 1);
  assert.equal(itemArmorMul(run), 1, "moving resets it");
});

test("Cell Battery: attack speed grows with the kill streak and resets on a hit", async () => {
  const { itemAtkMul } = await import("../src/game/scripted.js");
  const { run } = setup();
  const p = run.player;
  give(run, "cell-battery");
  for (let i = 0; i < 30; i++) run.killEnemy(run.spawnEnemy(16, 5, 5, "normal"), NORMAL);
  assert.equal(p.streak, 30);
  assert.ok(Math.abs(itemAtkMul(run) - 1.045) < 1e-9);
  p.iframes = 0;
  run.hitPlayer(5, null);
  assert.equal(p.streak, 0);
  assert.equal(itemAtkMul(run), 1);
});

test("Shed Shell: longer dash invulnerability and faster recharge; Soda Pop: the dash hurts the crowd", () => {
  const { run, input } = setup();
  const p = run.player;
  give(run, "shed-shell");
  give(run, "soda-pop");
  const e = sturdy(run, p.x + 2, p.z);
  input.right = true;
  input.dash = true;
  run.update(1 / 60);
  assert.ok(p.iframes > 0.3, "invulnerable for longer");
  assert.ok(Math.abs(p.dashCd - 1.26) < 0.02);
  assert.ok(e.hp < e.maxHp, "bubble wave hit the enemy beside the player");
});

test("Ice Heal: hitting a frozen enemy deals +60 %, thaws it and chills its neighbours", () => {
  const { run } = setup();
  const e = sturdy(run, 3, 0);
  const n = sturdy(run, 4, 0);
  const before = e.hp;
  withRandom(0.999, () => run.hitEnemy(e, 100, NORMAL, true));
  const plain = before - e.hp;
  give(run, "ice-heal");
  e.statuses.freeze = 2;
  const b2 = e.hp;
  withRandom(0.999, () => run.hitEnemy(e, 100, NORMAL, true));
  assert.ok(Math.abs((b2 - e.hp) / plain - 1.6 * 1.2) < 1e-6, "x1.6 on top of the x1.2 every frozen target takes");
  assert.equal(e.statuses.freeze, 0, "thawed");
  assert.ok(n.statuses.para > 0, "the neighbour is chilled");
});

test("Griseous Orb: a kill can drop a shadow that hurts and curses the neighbours", () => {
  const { run } = setup();
  give(run, "griseous-orb");
  const victim = run.spawnEnemy(16, 10, 10, "normal");
  const n = sturdy(run, 11, 10);
  withRandom(0.999, () => run.killEnemy(victim, NORMAL));
  assert.equal(n.hp, n.maxHp, "no shadow above 12 %");
  const v2 = run.spawnEnemy(16, 10, 10, "normal");
  withRandom(0, () => run.killEnemy(v2, NORMAL));
  assert.ok(n.hp < n.maxHp);
  assert.ok(n.statuses.curse > 0);
});

test("Electirizer strikes the nearest enemies every 2.5 s (+1 per copy)", () => {
  const { run } = setup();
  run.player.iframes = 1e9;
  give(run, "electirizer", 2);
  const es = [3, 4, 5, 6, 7, 8].map((x) => sturdy(run, run.player.x + x, run.player.z));
  frames(run, 160);
  const hit = es.filter((e) => e.hp < e.maxHp).length;
  assert.equal(hit, 4, "2 + 2 copies");
  assert.ok(es[0].hp < es[0].maxHp && es[5].hp === es[5].maxHp, "the nearest ones");
});

test("Silph Scope marks the toughest nearby enemy: +40 % damage; a new mark when it falls", () => {
  const { run } = setup();
  run.player.iframes = 1e9;
  give(run, "silph-scope");
  const weak = sturdy(run, 3, 0);
  const tough = sturdy(run, 4, 0, "elite");
  tough.maxHp = 2e6;
  tough.hp = 2e6;
  frames(run, 2);
  assert.equal(tough.marked, true);
  assert.ok(!weak.marked);
  const b = tough.hp;
  withRandom(0.999, () => run.hitEnemy(tough, 100, NORMAL, true));
  const marked = b - tough.hp;
  const b2 = weak.hp;
  withRandom(0.999, () => run.hitEnemy(weak, 100, NORMAL, true));
  assert.ok(Math.abs(marked / (b2 - weak.hp) - 1.4) < 1e-6);
  run.killEnemy(tough, NORMAL);
  frames(run, 30);
  assert.equal(weak.marked, true, "re-marked at once, not after 6 s");
});

test("Old Rod: a Magikarp hits an enemy every 9 s; sometimes a Gyarados", () => {
  const { run } = setup();
  run.player.iframes = 1e9;
  give(run, "old-rod");
  const e = sturdy(run, 4, 0);
  withRandom(0.999, () => frames(run, 60 * 9 + 2));
  const one = e.maxHp - e.hp;
  assert.ok(one > 0, "Magikarp");
  assert.ok(run.floaters.some((f) => f.text === "Magikarp!"));
  e.hp = e.maxHp;
  run.player.rodT = 0;
  withRandom(0, () => run.update(1 / 60));
  assert.ok(Math.abs((e.maxHp - e.hp) / one - 5 / 1.5) < 0.05, "Gyarados hits 5/1.5 as hard");
});

test("TM Case lifts the move cap from 8 to 10", () => {
  const { run } = setup({ speciesId: 4 });
  const p = run.player;
  run.learnKitMoves(p);
  const mv = p.moves[0];
  const offered = () => {
    for (let i = 0; i < 200; i++) if (run.rollChoices().some((c) => c.kind === "upMove" && c.title === mv.def.name)) return true;
    return false;
  };
  mv.level = 8;
  assert.equal(offered(), false, "capped at 8");
  give(run, "tm-case");
  assert.equal(offered(), true, "8 → 9 with the TM Case");
  mv.level = 10;
  assert.equal(offered(), false, "capped at 10 with it");
});

test("Max Ether lifts the vitamin cap from 10 to 12", async () => {
  const { vitaminChoices } = await import("../src/game/vitamins.js");
  const { run } = setup();
  const def = run.rules.vitamins[0];
  run.player.vitamins.set(def.key, { level: 10, acc: 1 });
  const offered = () => {
    for (let i = 0; i < 200; i++) if (run.rollChoices().some((c) => c.kind === "upVit" && c.vit === def.key)) return true;
    return false;
  };
  assert.equal(offered(), false, "capped at 10");
  give(run, "max-ether");
  assert.equal(offered(), true, "10 → 11 with Max Ether");
  run.player.vitamins.get(def.key).level = 12;
  assert.equal(offered(), false, "capped at 12 with it");
  void vitaminChoices;
});

test("Silph Scope: the mark also counts for item area damage, status ticks and thorns; a second copy marks a second enemy", () => {
  const { run } = setup();
  run.player.iframes = 1e9;
  give(run, "silph-scope");
  const a = sturdy(run, 3, 0, "elite");
  const b = sturdy(run, 4, 3);
  a.marked = true;
  const before = [a.hp, b.hp];
  run.hitAround(3.5, 1.5, 10, 100, NORMAL);
  assert.ok(Math.abs((before[0] - a.hp) / (before[1] - b.hp) - 1.4) < 1e-9, "area damage x1.4 on the mark");
  a.statuses.burn = 5;
  b.statuses.burn = 5;
  a.burnDps = b.burnDps = 60;
  const h = [a.hp, b.hp];
  frames(run, 1);
  assert.ok(Math.abs((h[0] - a.hp) / (h[1] - b.hp) - 1.4) < 1e-6, "burn ticks x1.4");
  give(run, "silph-scope");
  run.player.scopeT = 0;
  frames(run, 1);
  assert.equal(run.enemies.filter((e) => e.marked).length, 2, "two copies, two marks");
});

test("Silph Scope: a burn applied by a hit on the mark is boosted once, not twice; thorns hit the mark harder", () => {
  const { run } = setup();
  run.player.iframes = 1e9;
  give(run, "silph-scope");
  run.player.scopeT = 1e9; // keep the marks as set here
  const a = sturdy(run, 3, 0);
  const b = sturdy(run, 4, 3);
  a.marked = true;
  const burn = { type: "fire", cls: "special", status: "burn", statusChance: 1 };
  withRandom(0, () => {
    run.hitEnemy(a, 100, burn, true);
    run.hitEnemy(b, 100, burn, true);
  });
  assert.ok(Math.abs(a.burnDps - b.burnDps) < 1e-9, "same stored DPS");
  const h = [a.hp, b.hp];
  frames(run, 1);
  assert.ok(Math.abs((h[0] - a.hp) / (h[1] - b.hp) - 1.4) < 1e-6, "x1.4 on the tick, once");

  const p = run.player;
  p.stats.thorns = 50;
  const bh = [a.hp, b.hp];
  p.iframes = 0;
  run.hitPlayer(1, a);
  p.iframes = 0;
  run.hitPlayer(1, b);
  assert.ok(Math.abs((bh[0] - a.hp) / (bh[1] - b.hp) - 1.4) < 1e-9, "thorns x1.4 on the mark");
});

test("Poké Flute: the ultimate charges 25 % faster and recharges every move on cast", () => {
  const { run } = setup({ speciesId: 4 });
  const p = run.player;
  run.learnKitMoves(p);
  frames(run, 60);
  const plain = p.ultCharge;
  const { run: r2 } = setup({ speciesId: 4 });
  give(r2, "poke-flute");
  frames(r2, 60);
  assert.ok(Math.abs(r2.player.ultCharge / plain - 1.25) < 1e-6);
  r2.learnKitMoves(r2.player);
  for (const mv of r2.player.moves) mv.timer = 5;
  r2.player.ultCharge = 1;
  r2.castUltimate();
  assert.ok(r2.player.moves.every((mv) => mv.timer === 0));
  assert.equal(r2.player.fluteT, 6);
});

test("a capped hit on a marked boss still stores the full, unmarked burn", () => {
  const { run } = setup();
  run.player.iframes = 1e9;
  give(run, "silph-scope");
  run.player.scopeT = 1e9;
  run.stageTime = 299.99;
  frames(run, 2);
  const boss = run.boss;
  const g = boss.enemy;
  g.hp = g.maxHp = 1e9;
  const burn = { type: "fire", cls: "special", status: "burn", statusChance: 1 };
  const stored = (marked) => {
    g.marked = marked;
    g.burnDps = 0;
    boss.capBank = 1; // the cap lets almost nothing through
    boss.capT = run.time;
    withRandom(0, () => run.hitEnemy(g, 1000, burn, true));
    return g.burnDps;
  };
  const plain = stored(false);
  assert.ok(plain > 1, "the burn comes from the uncapped hit: " + plain);
  assert.ok(Math.abs(stored(true) - plain) < 1e-9, "marked or not, the same base burn");
});

test("Secret Key: the altar recharges instead of crumbling (45 s, 30 % faster per extra copy)", () => {
  const { run } = setup();
  const p = run.player;
  run.events.events.length = 0;
  run.events.spawn("altar", p.x + 1, p.z);
  const ev = run.events.events[0];
  give(run, "secret-key");
  p.hp = 10;
  run.events.openPanel(ev);
  document.getElementById("ui").all().find((n) => n.tagName === "button" && /^Curar/.test(n.textContent)).click();
  assert.equal(p.hp, p.maxHp);
  assert.equal(ev.interacted, false, "not consumed");
  assert.equal(ev.rechargeT, 45);
  assert.equal(run.events.findNear(ev.x, ev.z), null, "not usable while recharging");
  ev.rechargeT = 0.01;
  run.events.update(0.02);
  assert.equal(run.events.findNear(ev.x, ev.z), ev, "usable again");
  give(run, "secret-key");
  p.hp = 10;
  run.events.openPanel(ev);
  document.getElementById("ui").all().find((n) => n.tagName === "button" && /^Curar/.test(n.textContent)).click();
  assert.ok(Math.abs(ev.rechargeT - 31.5) < 1e-9, "two copies: 30 % faster");
});

test("Dowsing Machine: each new zone and tower floor brings 1 altar and 2 chests per copy", () => {
  const { run } = setup();
  run.events.events.length = 0;
  run.advanceStage();
  assert.equal(run.events.events.length, 0, "nothing without the item");
  give(run, "dowsing-machine");
  run.advanceStage();
  const kinds = run.events.events.map((e) => e.kind).sort();
  assert.deepEqual(kinds, ["altar", "chest", "chest"]);
  const { run: tower } = setup({ mode: "tower" });
  give(tower, "dowsing-machine", 2);
  tower.events.events.length = 0;
  tower.tower.floor = 2;
  tower.tower.enterFloor();
  assert.equal(tower.events.events.length, 6, "two copies on a new floor");
});
