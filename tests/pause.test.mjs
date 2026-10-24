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
  screens.getRun = () => run;
  return { root, screens, run };
}

const h2 = (root) => root.all().filter((n) => n.tagName === "h2").map((n) => n.textContent);

test("Pokédex, Apelido and Item Segurado return to the pause menu without resuming", () => {
  const { root, screens, run } = setup();
  let resumed = 0;
  screens.showPause(() => resumed++, () => {}, () => {});
  assert.deepEqual(h2(root), ["Pausado"]);

  screens.showPokedex();
  assert.deepEqual(h2(root), ["Pokédex"]);
  findButtons(root, /^Fechar/)[0].click();
  assert.deepEqual(h2(root), ["Pausado"], "Pokédex → Fechar goes back to the pause menu");

  screens.showNickname();
  const input = root.all().find((n) => n.tagName === "input");
  input.value = "  Bulba ";
  findButtons(root, /^Salvar/)[0].click();
  assert.deepEqual(h2(root), ["Pausado"]);
  assert.equal(run.player.nickname, "Bulba");
  assert.equal(profile.data.nickname, "Bulba");

  screens.showNickname();
  findButtons(root, /^Cancelar/)[0].click();
  assert.deepEqual(h2(root), ["Pausado"]);
  assert.equal(run.player.nickname, "Bulba", "Cancelar keeps the previous nickname");

  screens.showHeldItem();
  findButtons(root, /^Fechar/)[0].click();
  assert.deepEqual(h2(root), ["Pausado"]);

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

test("Conquistas lists every achievement and task with progress and returns to pause", async () => {
  const { withRandom, spawnAlpha } = await import("./_helpers.mjs");
  const { ACHIEVEMENTS, DEX_TASKS } = await import("../src/game/achievements.js");
  const { root, screens, run } = setup();
  let resumed = 0;
  screens.showPause(() => resumed++, () => {}, () => {});
  assert.ok(findButtons(root, /^Conquistas/).length, "the pause menu has the button");

  withRandom(0.99, () => run.capture.caught(spawnAlpha(run, 16)));
  screens.showAchievements();
  assert.deepEqual(h2(root), ["Conquistas"]);
  const rows = root.querySelectorAll(".ach-row");
  assert.equal(rows.length, ACHIEVEMENTS.length + DEX_TASKS.length);
  const first = rows[0];
  assert.ok(first.classList.contains("on"), "first catch is unlocked");
  assert.equal(first.querySelector(".ach-mark").textContent, "✓");
  assert.equal(first.querySelector(".ach-meta").querySelector("b").textContent, "1 / 1");
  const grass = rows[ACHIEVEMENTS.length];
  assert.equal(grass.classList.contains("on"), false);
  assert.equal(grass.querySelector(".ach-meta").querySelector("b").textContent, "0 / 5");
  assert.match(root.querySelector(".card").textContent, /1 \/ 8 conquistas · 0 \/ 5 tarefas/);

  findButtons(root, /^Fechar/)[0].click();
  assert.deepEqual(h2(root), ["Pausado"]);
  assert.equal(resumed, 0);
});

test("opening a chest freezes the rest of that simulation step (no hit can land under the panel)", async () => {
  const { makeRun: mk } = await import("./_helpers.mjs");
  dom.register("ui");
  const { run } = mk({ profile });
  const p = run.player;
  p.stats.evasion = 0;
  p.iframes = 0;
  const e = run.spawnEnemy(16, p.x + 0.5, p.z, "normal");
  e.atkCd = 0;
  run.events.events.length = 0;
  run.events.spawn("chest", p.x + 1, p.z);
  run.opts.input.capturePressed = true; // E
  const hp = p.hp;
  run.update(1 / 60);
  assert.ok(run.stateEventPanel, "the panel opened in this step");
  assert.equal(p.hp, hp, "the adjacent enemy did not get its contact hit in the same step");
  run.update(1 / 60);
  assert.equal(p.hp, hp, "and the world stays frozen while the panel is up");
  run.events.panel.close();
  assert.equal(run.stateEventPanel, false);
});

test("title and results read the single Pokédex list", async () => {
  const { withRandom, spawnAlpha } = await import("./_helpers.mjs");
  const { root, screens, run } = setup();
  withRandom(0.99, () => run.capture.caught(spawnAlpha(run, 16)));
  screens.showTitle();
  const stats = root.querySelector(".title-stats").textContent;
  assert.match(stats, /Capturados: 1 \/ 1025/);
  assert.match(stats, /Parceiros: \d+ \/ 40/);

  screens.showResults(run, false);
  assert.equal(profile.data.caught, undefined);
  assert.ok(profile.data.pokedex.seen.includes(run.player.speciesId), "the partner played is seen");
  assert.deepEqual(profile.data.pokedex.caught, [16], "but not counted as caught");
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

test("the trainer name (the profile's) is on the title screen and on the results", () => {
  const { root, screens, run } = setup();
  accounts.create("Ash", "");
  screens.showTitle();
  assert.match(root.querySelector(".title-stats").textContent, /Treinador: Ash/);
  run.state = "dead";
  screens.showResults(run, false);
  assert.ok(root.all().some((n) => /^Ash · /.test(n.textContent ?? "")), "results line starts with the trainer");
});

test("a guest, even an old save named Guest, shows as Convidado", () => {
  const { root, screens } = setup();
  accounts.current.name = "Guest"; // an old guest save
  screens.showTitle();
  assert.match(root.querySelector(".title-stats").textContent, /Treinador: Convidado/);
});
