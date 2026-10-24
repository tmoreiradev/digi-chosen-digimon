// Bug B: Rare Candy from the shop left xpNext stale; every level source now shares Run.addXp.
import test from "node:test";
import assert from "node:assert/strict";
import { makeRun } from "./_helpers.mjs";
import { xpForLevel, MAX_LEVEL } from "../src/game/rules.js";
import { SHOP_ITEMS } from "../src/game/events.js";

const candy = SHOP_ITEMS.find((it) => it.kind === "xp");
const potion = SHOP_ITEMS.find((it) => it.kind === "heal");

test("shop Rare Candy: level, xp, xpNext, stats, moves, run stats and callback stay in sync", () => {
  const { run, calls } = makeRun();
  const p = run.player;
  assert.equal(p.level, 1);
  assert.equal(p.xpNext, xpForLevel(1));
  const maxHpBefore = p.maxHp;
  assert.equal(p.moves.length, 1, "kit move 1 at level 1");
  p.xp = 5;
  run.stats.gold = 150;

  assert.equal(run.events.buy(run, candy), true);

  assert.equal(p.level, 2);
  assert.equal(p.xpNext, xpForLevel(2), "xpNext follows the new level (was stuck at 15)");
  assert.equal(p.xp, 5, "XP already earned inside the level is preserved");
  assert.ok(p.maxHp > maxHpBefore, "stats recomputed for the new level");
  assert.equal(p.moves.length, 2, "kit move 2 unlocks at level 2");
  assert.equal(run.stats.levels, 1);
  assert.equal(calls.levelUps, 1, "upgrade choice requested exactly once");
  assert.equal(run.stats.gold, 150 - candy.cost, "gold charged once, after the effect applied");
});

test("ground Rare Candy uses the same rule as the shop", () => {
  const { run, calls } = makeRun();
  const p = run.player;
  p.xp = 7;
  run.collect({ kind: "candy", value: 1 });
  assert.equal(p.level, 2);
  assert.equal(p.xp, 7);
  assert.equal(p.xpNext, xpForLevel(2));
  assert.equal(calls.levelUps, 1);
  assert.equal(run.stats.levels, 1);
});

test("XP orbs chain several levels with a consistent xpNext", () => {
  const { run, calls } = makeRun();
  const p = run.player;
  run.collect({ kind: "xp", value: 1000 });
  assert.ok(p.level > 5);
  assert.ok(p.xp < p.xpNext);
  assert.equal(p.xpNext, xpForLevel(p.level));
  assert.equal(run.stats.levels, p.level - 1);
  assert.equal(calls.levelUps, p.level - 1);
});

test("not enough gold: nothing applied, nothing charged", () => {
  const { run, calls } = makeRun();
  run.stats.gold = candy.cost - 1;
  assert.equal(run.events.buy(run, candy), false);
  assert.equal(run.player.level, 1);
  assert.equal(run.stats.gold, candy.cost - 1);
  assert.equal(calls.levelUps, 0);
});

test("level cap: Rare Candy is refused and not charged", () => {
  const { run, calls } = makeRun();
  const p = run.player;
  p.level = MAX_LEVEL;
  p.xpNext = xpForLevel(MAX_LEVEL);
  run.stats.gold = 500;
  assert.equal(run.events.canApply(run, candy), false);
  assert.equal(run.events.applyShopItem(run, candy), false);
  assert.equal(run.events.buy(run, candy), false);
  assert.equal(p.level, MAX_LEVEL);
  assert.equal(run.stats.gold, 500);
  assert.equal(calls.levelUps, 0);
  // Orbs at the cap keep the bar full without leveling.
  run.collect({ kind: "xp", value: 10000 });
  assert.equal(p.level, MAX_LEVEL);
  assert.equal(p.xp, p.xpNext);
});

test("the shop wallet is run.stats.gold, not the coin multiplier player.stats.gold", () => {
  const { run } = makeRun();
  const p = run.player;
  run.stats.gold = 100;
  p.stats.gold = 1;
  p.hp = p.maxHp - 50;
  assert.equal(run.events.buy(run, potion), true);
  assert.equal(run.stats.gold, 100 - potion.cost);
  assert.equal(p.stats.gold, 1, "the multiplier stat is untouched");
  assert.equal(p.hp, p.maxHp - 50 + potion.amount * p.stats.healing); // every heal goes through healPlayer

  run.events.giveChestLoot(run, { kind: "coins", amount: 30 });
  assert.equal(run.stats.gold, 100 - potion.cost + 30, "chest coins land in the wallet");
});
