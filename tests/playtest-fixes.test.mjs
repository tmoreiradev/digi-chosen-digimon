// Fixes from the 30-minute playtest analysed by Codex (reviews/codex-playtest-2026-10-30.md).
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./_dom.mjs";

installFakeDom().register("ui");
const { Hud } = await import("../src/ui/hud.js");
const { Screens } = await import("../src/ui/screens.js");
const { makeRun, loadData } = await import("./_helpers.mjs");
const { MAX_LEVEL } = await import("../src/game/rules.js");
const { SHOP_ITEMS } = await import("../src/game/events.js");

const hudFor = (run) => {
  const root = document.createElement("div");
  const hud = new Hud(root);
  hud.update(run);
  return hud;
};

test("the tower HUD names the floor and shows the wave and the enemies left (not 'Zona 1')", () => {
  const { run } = makeRun({ mode: "tower" });
  const hud = hudFor(run);
  assert.match(hud.region.textContent, /^1F — /);
  assert.match(hud.runTimer.textContent, /Onda 1\/3 · \d+ restantes$/);
  assert.ok(!/Zona/.test(hud.runTimer.textContent));
  run.tower.pendingGuardian = true;
  hud.update(run);
  assert.match(hud.runTimer.textContent, /Guardião do andar$/);
});

test("the big clock is the run's length, a boss fight reads as BOSS, and level 50 says so", () => {
  const { run } = makeRun();
  run.time = 901;
  const hud = hudFor(run);
  assert.equal(hud.clock.textContent, "15:01");
  assert.match(hud.runTimer.textContent, /^🕗 /);
  run.boss.spawn(16, run.player.x + 6, run.player.z, "totem");
  hud.update(run);
  assert.equal(hud.threatLabel.textContent, "CHEFE");
  run.player.level = MAX_LEVEL;
  hud.update(run);
  assert.equal(hud.xpText.textContent, "Nível máximo");
});

test("a zone event shows its name, seconds left and rule on its own badge", () => {
  const { run } = makeRun();
  run.zoneEvent.start("storm");
  const hud = hudFor(run);
  assert.equal(hud.eventBadge.classList.contains("show"), true);
  assert.equal(hud.eventBadge.textContent, "Tempestade elétrica · 40s — Saia das marcas amarelas");
});

test("the shop will not sell a heal to a full-HP partner, and the sanctuary spawns no chest or shop", () => {
  const { run } = makeRun();
  const potion = SHOP_ITEMS.find((i) => i.kind === "heal");
  assert.equal(run.events.canApply(run, potion), false);
  run.player.hp -= 10;
  assert.equal(run.events.canApply(run, potion), true);

  run.sanctuary = true;
  const before = run.events.events.length;
  run.events.update(10_000);
  assert.equal(run.events.events.length, before);
});

test("results say levels gained and gold left, with grouped digits", () => {
  const root = document.createElement("div");
  const screens = new Screens(root, loadData());
  const { run } = makeRun();
  run.state = "dead";
  run.stats.damage = 8177652;
  screens.showResults(run, false);
  const texts = root.all().map((n) => n.textContent);
  assert.ok(texts.includes("níveis ganhos"));
  assert.ok(texts.includes("ouro final"));
  assert.ok(texts.includes("8.177.652"));
});
