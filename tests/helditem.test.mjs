// Bug C: the held-item screen's check mark must follow the live selection and persist to the profile.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom, findButtons } from "./_dom.mjs";

const dom = installFakeDom();
const { Screens } = await import("../src/ui/screens.js");
const { accounts, profile } = await import("../src/ui/account.js");
const { makeRun, loadData } = await import("./_helpers.mjs");

const STORE_KEY = "pokebonk-clone.accounts.v1"; // unchanged on purpose: existing saves keep loading

function setup() {
  dom.store.clear();
  accounts.current = null;
  accounts.load();
  const data = loadData();
  const root = document.createElement("div");
  const screens = new Screens(root, data);
  const { run } = makeRun({ profile });
  screens.getRun = () => run;
  return { root, screens, run };
}

const checked = (root) => findButtons(root, /✓$/).map((b) => b.textContent.replace(/ ✓$/, "").split(" — ")[0]);
const savedHeldItem = () => {
  const store = JSON.parse(localStorage.getItem(STORE_KEY));
  return Object.values(store.guests)[0].progress.heldItem;
};

test("the check mark moves with the selection and the choice is persisted", () => {
  const { root, screens, run } = setup();
  screens.showHeldItem();
  assert.deepEqual(checked(root), ["Nenhum"]);

  findButtons(root, /^Leftovers/)[0].click();
  assert.deepEqual(checked(root), ["Leftovers"], "check mark follows the new selection without reopening");
  assert.equal(run.player.heldItem, "leftovers");
  assert.equal(profile.data.heldItem, "leftovers");
  assert.equal(savedHeldItem(), "leftovers");

  findButtons(root, /^Choice Band/)[0].click();
  assert.deepEqual(checked(root), ["Choice Band"]);
  assert.equal(savedHeldItem(), "choice-band");

  findButtons(root, /^Nenhum/)[0].click();
  assert.deepEqual(checked(root), ["Nenhum"]);
  assert.equal(run.player.heldItem, null);
  assert.equal(savedHeldItem(), null);
});

test("only items with an implemented effect are offered", async () => {
  const { root, screens } = setup();
  screens.showHeldItem();
  const offered = findButtons(root, / — /).map((b) => b.textContent.split(" — ")[0]);
  const { HELD_ITEMS } = await import("../src/game/scripted.js");
  assert.deepEqual(offered, HELD_ITEMS.map((k) => loadData().items[k].name));
  assert.ok(offered.length >= 12);
});

test("the selection is restored by a new run and shown on reopen", () => {
  const { root, screens } = setup();
  screens.showHeldItem();
  findButtons(root, /^Choice Band/)[0].click();

  const { run: next } = makeRun({ profile });
  assert.equal(next.player.heldItem, "choice-band", "createPlayer restores the held item");
  screens.getRun = () => next;
  screens.showHeldItem();
  assert.deepEqual(checked(root), ["Choice Band"]);
});

test("Fechar returns to the pause menu without resuming", () => {
  const { root, screens } = setup();
  let resumed = 0;
  screens.showPause(() => resumed++, () => {}, () => {});
  screens.showHeldItem();
  findButtons(root, /^Fechar/)[0].click();
  assert.ok(root.all().some((n) => n.tagName === "h2" && n.textContent === "Pausado"));
  assert.equal(resumed, 0);
});

test("the held-item descriptions describe the engine's effect, in pt-BR (not the items.json flavour text)", async () => {
  const { HELD_ITEM_DESC_PT } = await import("../src/core/i18n.js");
  const { root, screens } = setup();
  screens.showHeldItem();
  const descs = Object.fromEntries(
    findButtons(root, / — /).map((b) => {
      const [name, rest] = b.textContent.split(" — ");
      return [name, rest.replace(/ ✓$/, "")];
    })
  );
  const { HELD_ITEMS } = await import("../src/game/scripted.js");
  const data = loadData();
  assert.deepEqual(descs, Object.fromEntries(HELD_ITEMS.map((k) => [data.items[k].name, HELD_ITEM_DESC_PT[k]])));
  for (const d of Object.values(descs)) assert.doesNotMatch(d, /held by a Pokémon/);
});

test("picking a stat held item in the pause applies at once and survives a new run", () => {
  const { root, screens, run } = setup();
  const crit = run.player.stats.critChance;
  screens.showHeldItem();
  findButtons(root, /^Scope Lens/)[0].click();
  assert.ok(Math.abs(run.player.stats.critChance - crit - 0.1) < 1e-9, "recomputed on the spot");
  const { run: next } = makeRun({ profile });
  assert.ok(Math.abs(next.player.stats.critChance - crit - 0.1) < 1e-9, "a new run starts with it");
  screens.getRun = () => next;
  screens.showHeldItem();
  findButtons(root, /^Nenhum/)[0].click();
  assert.ok(Math.abs(next.player.stats.critChance - crit) < 1e-9, "taking it off removes the bonus");
});

test("Life Orb: x1.3 damage, 2 % of max HP per cast, never the last point", () => {
  const { run } = makeRun();
  run.director.update = () => {};
  const p = run.player;
  const e = run.spawnEnemy(16, p.x + 3, p.z, "normal");
  e.hp = e.maxHp = 1e9;
  e.speed = 0;
  const NORMAL = { type: "normal", cls: "special" };
  const orig = Math.random;
  Math.random = () => 0.999;
  try {
    let b = e.hp;
    run.hitEnemy(e, 100, NORMAL, true);
    const plain = b - e.hp;
    p.heldItem = "life-orb";
    b = e.hp;
    run.hitEnemy(e, 100, NORMAL, true);
    assert.ok(Math.abs((b - e.hp) / plain - 1.3) < 1e-9);
  } finally {
    Math.random = orig;
  }
  p.iframes = 1e9;
  p.moves[0].timer = 0;
  const hp = p.hp;
  run.update(1 / 60);
  assert.ok(Math.abs(hp - p.hp - p.maxHp * 0.02) < 1e-6, "one cast, 2 % of max HP");
  p.hp = 1;
  p.moves[0].timer = 0;
  run.update(1 / 60);
  assert.equal(p.hp, 1, "never below 1");
});
