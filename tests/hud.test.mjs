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

test("slots and ultimate are rebuilt only when the loadout changes; bars still move every frame", () => {
  const root = document.createElement("div");
  const hud = new Hud(root);
  const { run } = makeRun();
  const p = run.player;
  hud.update(run);
  const slot = root.querySelector(".slot");
  const fill = root.querySelector(".ult-fill");
  assert.ok(slot && fill);

  p.moves[0].timer = p.moves[0].def.cd; // on cooldown
  p.ultCharge = 0.5;
  hud.update(run);
  assert.equal(root.querySelector(".slot"), slot, "same slot element: no rebuild");
  assert.equal(root.querySelector(".ult-fill"), fill, "same ult element: no rebuild");
  assert.equal(slot.className, "slot");
  assert.equal(root.querySelector(".slot-cd").style.width, "100%");
  assert.equal(fill.style.width, "50%");

  p.moves[0].timer = 0;
  p.ultCharge = 1;
  hud.update(run);
  assert.equal(slot.className, "slot ready");
  assert.ok(root.querySelector(".hud-ult").className.includes("ready"));

  p.moveSlots += 1; // a new slot changes the loadout
  hud.update(run);
  assert.notEqual(root.querySelector(".slot"), slot, "rebuilt on a loadout change");
  assert.equal(root.querySelectorAll(".slot").length, p.moveSlots, "one more slot");
});

test("switching the language rebuilds the cached species block (type chips, evolution hint)", async () => {
  const { setLang } = await import("../src/core/lang.js");
  const root = document.createElement("div");
  const hud = new Hud(root);
  const { run } = makeRun();
  setLang("pt-BR");
  hud.update(run);
  const chips = () => root.all().filter((n) => n.classList?.contains("chip")).map((n) => n.textContent);
  assert.deepEqual(chips(), ["Planta", "Veneno"]);
  setLang("en");
  hud.update(run); // same species, same nickname: only the language changed
  assert.deepEqual(chips(), ["Grass", "Poison"]);
  setLang("pt-BR");
});
