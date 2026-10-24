// BACKLOG 11: upgrades without stat mods (upstream scripted items) were never offered. The ones the
// engine implements (src/game/scripted.js) now enter the pool with real effects; the `type:` tag of
// the 18 type items finally applies (+30 % per copy); the rest stay out.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun, withRandom } from "./_helpers.mjs";
import { SCRIPTED } from "../src/game/scripted.js";
import { describeUpgrade } from "../src/game/rules.js";
import { ITEM_DESC_PT } from "../src/core/i18n.js";
import { SHOP_ITEMS } from "../src/game/events.js";

function setup() {
  const made = makeRun();
  made.run.director.update = () => {};
  made.run.player.moves.length = 0; // no auto-attacks: every hit below is explicit
  made.run.player.stats.evasion = 0;
  return made;
}
const give = (run, key, n = 1) => {
  for (let i = 0; i < n; i++) run.applyChoice({ kind: "item", key });
  run.player.stats.evasion = 0; // applyChoice recomputes the stats (the data carries `mods: []`)
};
function sturdy(run, x = 3, z = 0, tier = "normal") {
  const e = run.spawnEnemy(16, x, z, tier);
  e.hp = e.maxHp = 1e6;
  return e;
}
const NORMAL = { type: "normal", cls: "special" };
/** Damage one explicit hit deals; noReact skips the crit roll so multipliers compare cleanly. */
function hit(run, e, def = NORMAL, { dmg = 100, noReact = true, rnd = 0.999 } = {}) {
  const before = e.hp;
  withRandom(rnd, () => run.hitEnemy(e, dmg, def, noReact));
  return before - e.hp;
}
const lethal = (run) => {
  run.player.iframes = 0;
  run.player.hp = 1;
  run.hitPlayer(1e6, null);
};

test("the pool offers mod items and the implemented scripted items, never the rest", () => {
  const { run } = setup();
  const keys = new Set(run.itemPool().map((u) => u.key));
  assert.ok(keys.has("charcoal"), "mod item");
  for (const k of SCRIPTED) assert.ok(keys.has(k), `scripted item offered: ${k}`);
  const scripted = run.rules.upgrades.filter((u) => !(u.mods ?? []).length).map((u) => u.key);
  assert.deepEqual(scripted.filter((k) => !keys.has(k)), [], "every scripted item of the data is now offered");
  for (const k of SCRIPTED) {
    assert.ok(run.rules.upgrades.some((u) => u.key === k), `${k} exists in rules.json`);
    assert.ok(ITEM_DESC_PT[k], `${k} has a pt-BR description`);
  }
  assert.equal(describeUpgrade(run.rules.upgrades.find((u) => u.key === "shell-bell")), ITEM_DESC_PT["shell-bell"]);
  give(run, "focus-sash");
  assert.ok(!run.itemPool().some((u) => u.key === "focus-sash"), "max 1: a taken Focus Sash leaves the pool");
});

test("type items: the tag is +30 % per copy to moves of that type", () => {
  const { run } = setup();
  const e = sturdy(run);
  const base = hit(run, e, { type: "fire", cls: "special" });
  give(run, "charcoal");
  assert.ok(Math.abs(run.player.stats.typeBoost.fire - 1.3) < 1e-9);
  const boosted = hit(run, e, { type: "fire", cls: "special" });
  assert.ok(Math.abs(boosted / base - 1.3 * 1.03) < 1e-6, `fire ×1.3 (tag) ×1.03 (mod): ${boosted / base}`);
  const normal = hit(run, e, NORMAL);
  assert.ok(Math.abs(normal / base - 1.03) < 1e-6, "other types get only the +3 % mod");
  give(run, "charcoal");
  assert.ok(Math.abs(run.player.stats.typeBoost.fire - 1.6) < 1e-9, "stacks per copy");
});

test("Metronome: +2 %/s without being hit, capped at +40 %", () => {
  const { run } = setup();
  const e = sturdy(run);
  const base = hit(run, e);
  give(run, "metronome");
  assert.ok(Math.abs(hit(run, e) / base - 1.4) < 1e-6, "never hit yet: full bonus");
  run.player.lastHitT = run.time;
  assert.ok(Math.abs(hit(run, e) / base - 1) < 1e-6, "just hit: no bonus");
  run.time += 10;
  assert.ok(Math.abs(hit(run, e) / base - 1.2) < 1e-6, "10 s later: +20 %");
});

test("Binding Band and Full Heal: more damage to statused enemies", () => {
  const { run } = setup();
  const e = sturdy(run);
  const base = hit(run, e);
  give(run, "binding-band");
  assert.ok(Math.abs(hit(run, e) / base - 1) < 1e-6, "no status: nothing");
  e.statuses.root = 2;
  assert.ok(Math.abs(hit(run, e) / base - 1.2) < 1e-6, "rooted: +20 %");
  give(run, "full-heal");
  e.statuses.burn = 2;
  assert.ok(Math.abs(hit(run, e) / base - 1.2 * 1.12) < 1e-6, "two statuses: +12 % on top");
});

test("Reaper Cloth and Thick Club scale with kills and armour", () => {
  const { run } = setup();
  const e = sturdy(run);
  const base = hit(run, e);
  give(run, "reaper-cloth");
  run.stats.kills = 1000;
  assert.ok(Math.abs(hit(run, e) / base - 1.1) < 1e-6, "1000 kills: +10 %");
  run.stats.kills = 9000;
  assert.ok(Math.abs(hit(run, e) / base - 1.3) < 1e-6, "capped at +30 %");
  run.stats.kills = 0;
  give(run, "thick-club");
  run.player.stats.armor = 50;
  const phys = { type: "normal", cls: "physical" };
  const basePhys = hit(run, e, phys) / (1 + 0.25);
  assert.ok(basePhys > 0);
  run.player.stats.armor = 0;
  assert.ok(Math.abs(hit(run, e, phys) - basePhys) < 1e-6, "no armour: no bonus");
  assert.ok(Math.abs(hit(run, e) / base - 1) < 1e-6, "special moves ignore Thick Club");
});

test("Stick: a 3 % roll does ×8 and says Bonk!", () => {
  const { run } = setup();
  const e = sturdy(run);
  const base = hit(run, e, NORMAL, { noReact: false, rnd: 0.5 });
  give(run, "stick");
  assert.ok(Math.abs(hit(run, e, NORMAL, { noReact: false, rnd: 0.5 }) - base) < 1e-6, "roll above 3 %: normal hit");
  const crit = run.player.stats.critDamage; // rnd 0 also crits; both hits below crit
  const bonk = hit(run, e, NORMAL, { noReact: false, rnd: 0 });
  assert.ok(Math.abs(bonk / (base * crit) - 8) < 1e-6, `×8: ${bonk / (base * crit)}`);
  assert.ok(run.floaters.some((f) => f.text === "Bonk!"));
});

test("Shell Bell heals a share of damage dealt; Grip Claw roots; Awakening sleeps", () => {
  const { run } = setup();
  const p = run.player;
  const e = sturdy(run);
  give(run, "shell-bell");
  p.hp = p.maxHp - 50;
  const dealt = hit(run, e, NORMAL, { dmg: 1000 });
  assert.ok(Math.abs(p.hp - (p.maxHp - 50 + dealt * 0.008 * p.stats.healing)) < 1e-6, "0.8 % of the damage, times the healing stat");
  give(run, "grip-claw");
  give(run, "awakening");
  hit(run, e, NORMAL, { rnd: 0.999 });
  assert.equal(e.statuses.root, 0);
  assert.equal(e.statuses.sleep, 0);
  hit(run, e, NORMAL, { rnd: 0 });
  assert.equal(e.statuses.root, 2);
  assert.equal(e.statuses.sleep, 3);
});

test("Razor Fang executes common enemies under the threshold, never alphas or bosses", () => {
  const { run } = setup();
  give(run, "razor-fang");
  const e = run.spawnEnemy(16, 3, 0, "normal");
  e.hp = e.maxHp * 0.07;
  hit(run, e, NORMAL, { dmg: 0.001 });
  assert.ok(e.hp <= 0 && e.dying > 0, "executed");
  const a = run.spawnEnemy(16, 3, 2, "alpha");
  a.hp = a.maxHp * 0.07;
  hit(run, a, NORMAL, { dmg: 0.001 });
  assert.ok(a.hp > 0, "an alpha stays alive for the capture flow");
  give(run, "razor-fang");
  const f = run.spawnEnemy(16, 3, 4, "normal");
  f.hp = f.maxHp * 0.11;
  hit(run, f, NORMAL, { dmg: 0.001 });
  assert.ok(f.hp <= 0, "two copies: 12 % threshold");
});

test("Berry Juice, Fire Stone and Leaf Stone trigger on kills", () => {
  const { run } = setup();
  const p = run.player;
  give(run, "berry-juice");
  p.hp = p.maxHp - 50;
  withRandom(0.999, () => run.killEnemy(run.spawnEnemy(16, 5, 5, "normal"), NORMAL));
  assert.equal(p.hp, p.maxHp - 50, "roll above 5 %: no heal");
  withRandom(0, () => run.killEnemy(run.spawnEnemy(16, 5, 5, "normal"), NORMAL));
  assert.ok(Math.abs(p.hp - (p.maxHp - 50 + p.maxHp * 0.02 * p.stats.healing)) < 1e-6, "2 % of max HP, times the healing stat");

  give(run, "fire-stone");
  const victim = run.spawnEnemy(16, 10, 10, "normal");
  victim.maxHp = 100;
  const near = sturdy(run, 11, 10);
  const far = sturdy(run, 20, 10);
  withRandom(0.999, () => run.killEnemy(victim, NORMAL));
  assert.equal(near.hp, 1e6, "not burned: no explosion");
  const victim2 = run.spawnEnemy(16, 10, 10, "normal");
  victim2.maxHp = 100;
  victim2.statuses.burn = 2;
  withRandom(0.999, () => run.killEnemy(victim2, NORMAL));
  assert.equal(near.hp, 1e6 - 40, "burned: 40 % of its max HP to neighbours");
  assert.equal(far.hp, 1e6, "out of range");

  give(run, "leaf-stone");
  p.hp = p.maxHp - 50;
  const victim3 = run.spawnEnemy(16, 10, 10, "normal");
  victim3.maxHp = 100;
  withRandom(0, () => run.killEnemy(victim3, NORMAL));
  assert.equal(near.hp, 1e6 - 40 - 30, "leaf whirl: 30 %");
  assert.ok(p.hp > p.maxHp - 50, "and a 1 % heal");
});

test("Guard Spec. blocks one hit every 14 s", () => {
  const { run } = setup();
  const p = run.player;
  give(run, "guard-spec");
  run.hitPlayer(20, null);
  assert.equal(p.hp, p.maxHp, "first hit blocked");
  p.iframes = 0;
  run.hitPlayer(20, null);
  assert.ok(p.hp < p.maxHp, "second hit lands");
  const hp = p.hp;
  p.iframes = 0;
  run.time += 14;
  run.hitPlayer(20, null);
  assert.equal(p.hp, hp, "blocked again after 14 s");
});

test("Focus Sash once per zone, Focus Band 15 % every 20 s, Revive / Max Revive once each", () => {
  const { run } = setup();
  const p = run.player;
  give(run, "focus-sash");
  lethal(run);
  assert.equal(p.hp, 1);
  assert.equal(run.state, "running");
  lethal(run);
  assert.equal(run.state, "dead", "second lethal in the same zone: dead");

  const { run: r2 } = setup();
  give(r2, "focus-sash");
  lethal(r2);
  r2.advanceStage();
  lethal(r2);
  assert.equal(r2.player.hp, 1, "the sash is back in the next zone");

  const { run: r3 } = setup();
  give(r3, "focus-band");
  withRandom(0.5, () => lethal(r3));
  assert.equal(r3.state, "dead", "roll above 15 %: no save");

  const { run: r4 } = setup();
  give(r4, "focus-band");
  withRandom(0, () => lethal(r4));
  assert.equal(r4.player.hp, 1);
  withRandom(0, () => lethal(r4));
  assert.equal(r4.state, "dead", "20 s cooldown");

  const { run: r5 } = setup();
  give(r5, "revive");
  give(r5, "max-revive");
  lethal(r5);
  assert.equal(r5.player.hp, Math.round(r5.player.maxHp * 0.6), "Max Revive first");
  lethal(r5);
  assert.equal(r5.player.hp, Math.round(r5.player.maxHp * 0.35), "then Revive");
  lethal(r5);
  assert.equal(r5.state, "dead");
});

test("S.S. Ticket, Poké Doll and Lemonade act on the ally team", () => {
  const { run } = setup();
  const cap = run.allies.cap;
  give(run, "ss-ticket");
  assert.equal(run.allies.cap, cap + 1);
  const pidgey = run.data.get(16);
  run.allies.recruit(pidgey, 1, false);
  const a = run.allies.list[0];
  const power = run.allies.power(a);
  const cd = run.allies.cooldown(a);
  const boost = run.allies.mods()[0][0].mul - 1;
  give(run, "lemonade");
  assert.ok(Math.abs(run.allies.power(a) / power - 1.25) < 1e-9);
  assert.ok(Math.abs(cd / run.allies.cooldown(a) - 1.15) < 1e-9);
  give(run, "poke-doll");
  assert.ok(Math.abs((run.allies.mods()[0][0].mul - 1) / boost - 1.5) < 1e-9);
});

test("Gold Teeth: the travelling shop charges 8 % less per copy, at most 24 %", () => {
  const { run } = setup();
  const potion = SHOP_ITEMS.find((it) => it.key === "heal-small");
  assert.equal(run.events.price(run, potion), 25);
  give(run, "gold-teeth");
  assert.equal(run.events.price(run, potion), 23);
  run.stats.gold = 23;
  run.player.hp = 1;
  assert.equal(run.events.buy(run, potion), true, "affordable at the discounted price");
  assert.equal(run.stats.gold, 0);
  give(run, "gold-teeth", 5);
  assert.equal(run.events.price(run, potion), 19, "−24 % floor");
});
