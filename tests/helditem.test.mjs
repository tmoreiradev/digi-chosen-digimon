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
  globalThis.__PB__ = { run };
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

test("only items with an implemented effect are offered", () => {
  const { root, screens } = setup();
  screens.showHeldItem();
  const offered = findButtons(root, / — /).map((b) => b.textContent.split(" — ")[0]);
  assert.deepEqual(offered, ["Leftovers", "Choice Band"]);
});

test("the selection is restored by a new run and shown on reopen", () => {
  const { root, screens } = setup();
  screens.showHeldItem();
  findButtons(root, /^Choice Band/)[0].click();

  const { run: next } = makeRun({ profile });
  assert.equal(next.player.heldItem, "choice-band", "createPlayer restores the held item");
  globalThis.__PB__ = { run: next };
  screens.showHeldItem();
  assert.deepEqual(checked(root), ["Choice Band"]);
});

test("Fechar returns to the pause menu without resuming", () => {
  const { root, screens } = setup();
  let resumed = 0;
  screens.showPause(() => resumed++, () => {}, () => {});
  screens.showHeldItem();
  findButtons(root, /^Fechar/)[0].click();
  assert.ok(root.all().some((n) => n.tagName === "h2" && n.textContent === "Paused"));
  assert.equal(resumed, 0);
});
