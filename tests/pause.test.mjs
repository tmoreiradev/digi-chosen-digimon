// Pause submenus: Pokédex, nickname and held item keep the game paused and return to the pause menu.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom, findButtons } from "./_dom.mjs";

const dom = installFakeDom();
const { Screens } = await import("../src/ui/screens.js");
const { accounts, profile } = await import("../src/ui/account.js");
const { makeRun, loadData } = await import("./_helpers.mjs");

const STORE_KEY = "pokebonk-clone.accounts.v1";
const CURRENT_KEY = "pokebonk-clone.current.v1";

function setup() {
  dom.store.clear();
  accounts.current = null;
  accounts.load();
  const root = document.createElement("div");
  const screens = new Screens(root, loadData());
  const { run } = makeRun({ profile });
  globalThis.__PB__ = { run };
  return { root, screens, run };
}

const h2 = (root) => root.all().filter((n) => n.tagName === "h2").map((n) => n.textContent);

test("Pokédex, Apelido and Item Segurado return to the pause menu without resuming", () => {
  const { root, screens, run } = setup();
  let resumed = 0;
  screens.showPause(() => resumed++, () => {}, () => {});
  assert.deepEqual(h2(root), ["Paused"]);

  screens.showPokedex();
  assert.deepEqual(h2(root), ["Pokédex"]);
  findButtons(root, /^Fechar/)[0].click();
  assert.deepEqual(h2(root), ["Paused"], "Pokédex → Fechar goes back to the pause menu");

  screens.showNickname();
  const input = root.all().find((n) => n.tagName === "input");
  input.value = "  Bulba ";
  findButtons(root, /^Salvar/)[0].click();
  assert.deepEqual(h2(root), ["Paused"]);
  assert.equal(run.player.nickname, "Bulba");
  assert.equal(profile.data.nickname, "Bulba");

  screens.showNickname();
  findButtons(root, /^Cancelar/)[0].click();
  assert.deepEqual(h2(root), ["Paused"]);
  assert.equal(run.player.nickname, "Bulba", "Cancelar keeps the previous nickname");

  screens.showHeldItem();
  findButtons(root, /^Fechar/)[0].click();
  assert.deepEqual(h2(root), ["Paused"]);

  assert.equal(resumed, 0, "no submenu resumed the game");
});

test("nickname survives a new run and a reload of the store", () => {
  const { run, screens, root } = setup();
  screens.showNickname();
  root.all().find((n) => n.tagName === "input").value = "Bulba";
  findButtons(root, /^Salvar/)[0].click();

  const { run: next } = makeRun({ profile });
  assert.equal(next.player.nickname, "Bulba");
  assert.notEqual(next, run);

  accounts.current = null;
  accounts.load(); // re-read from the (fake) localStorage
  assert.equal(profile.data.nickname, "Bulba");
});

test("a save written before eggs/achievements/nickname existed still loads", () => {
  dom.store.clear();
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({
      guests: {},
      accounts: {
        Ash: {
          id: "Ash",
          name: "Ash",
          kind: "account",
          pass: "",
          createdAt: 1,
          progress: { unlocked: [1, 4, 7], caught: [1], pokedex: { seen: [1, 2], caught: [1] }, best: 120, runs: 3, settings: { volume: 0.3 } },
        },
      },
    })
  );
  localStorage.setItem(CURRENT_KEY, "a:Ash");
  accounts.current = null;
  accounts.load();
  assert.equal(accounts.current.name, "Ash");
  assert.equal(profile.data.best, 120);
  assert.equal(profile.data.settings.volume, 0.3);

  const { run } = makeRun({ profile });
  assert.equal(run.pokedex.seen.size, 2);
  assert.equal(run.player.nickname, null);
  assert.equal(run.player.heldItem, null);
  assert.deepEqual(profile.data.eggs, { active: null, steps: 0, needed: 0, hatchSpecies: null });
  assert.ok(profile.data.achievements);
});
