// HUD boss bar: shown only while a boss is alive, with name, kind, phase and HP.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./_dom.mjs";

installFakeDom();
const { Hud } = await import("../src/ui/hud.js");
const { makeRun } = await import("./_helpers.mjs");

test("the boss bar appears during a boss fight and tracks its HP", () => {
  const root = document.createElement("div");
  const hud = new Hud(root);
  const { run } = makeRun();
  hud.update(run);
  const wrap = root.querySelector(".hud-boss");
  assert.ok(wrap, "the bar exists in the HUD");
  assert.equal(wrap.classList.contains("show"), false, "hidden without a boss");

  const e = run.boss.spawn(123, run.player.x + 5, run.player.z, "guardian");
  hud.update(run);
  assert.equal(wrap.classList.contains("show"), true);
  assert.equal(root.querySelector(".hud-boss-name").textContent, "Scyther · Guardião");
  assert.equal(root.querySelector(".fill.boss").style.width, "100%");
  assert.match(root.querySelector(".bar.boss").querySelector(".bar-text").textContent, /^Fase 1 · \d+ \/ \d+$/);

  e.hp = e.maxHp / 2;
  hud.update(run);
  assert.equal(root.querySelector(".fill.boss").style.width, "50%");

  e.hp = 0;
  run.boss.update(1 / 60);
  hud.update(run);
  assert.equal(wrap.classList.contains("show"), false, "hidden again once the boss falls");
});

test("the legendary is labelled as such", () => {
  const root = document.createElement("div");
  const hud = new Hud(root);
  const { run } = makeRun();
  run.boss.spawn(151, run.player.x + 5, run.player.z, "legendary");
  hud.update(run);
  assert.equal(root.querySelector(".hud-boss-name").textContent, "Mew · Lendário");
});
