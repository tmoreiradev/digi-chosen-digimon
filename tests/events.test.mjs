// World events: spawn within reach of the player; consumed only when used (chest opened, altar
// heals), never by looking; a chest's loot is rolled once.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom, findButtons } from "./_dom.mjs";

const dom = installFakeDom();
const ui = dom.register("ui");
const { makeRun } = await import("./_helpers.mjs");

const open = (run) => {
  const ev = run.events.interact();
  assert.ok(ev, "an event is in reach");
  assert.ok(run.stateEventPanel);
  return ev;
};
const click = (re) => {
  const b = findButtons(ui, re)[0];
  assert.ok(b, `button ${re}`);
  b.click();
};

test("events spawn 12-24 units from the player, inside the arena", () => {
  const { run } = makeRun();
  const p = run.player;
  const half = run.biome.size / 2 - 6;
  p.x = -170;
  p.z = 170; // a corner: clamping must keep them inside
  for (let i = 0; i < 40; i++) {
    run.events.events.length = 0;
    run.events.spawn(i % 2 ? "chest" : "shop");
    const ev = run.events.events[0];
    const d = Math.hypot(ev.x - p.x, ev.z - p.z);
    assert.ok(d <= 24 + 1e-9, `within reach (${d.toFixed(1)})`);
    assert.ok(Math.abs(ev.x) <= half && Math.abs(ev.z) <= half, "inside the arena");
  }
  p.x = 0;
  p.z = 0;
  run.events.events.length = 0;
  run.events.spawn("altar");
  const ev = run.events.events[0];
  assert.ok(Math.hypot(ev.x, ev.z) >= 12 - 1e-9, "not on top of the player");
});

test("a chest survives a look, keeps the same loot, and is consumed when opened", () => {
  const { run } = makeRun();
  const p = run.player;
  run.events.events.length = 0;
  run.events.spawn("chest", p.x + 1, p.z);
  open(run);
  const preview = ui.querySelector(".event-loot-preview").textContent;
  click(/^Sair/);
  assert.equal(run.stateEventPanel, false);
  run.update(1 / 60);
  assert.equal(run.events.events.length, 1, "leaving does not consume the chest");
  open(run);
  assert.equal(ui.querySelector(".event-loot-preview").textContent, preview, "loot was rolled once");
  const gold = run.stats.gold;
  const hp = p.hp;
  click(/^Abrir/);
  assert.ok(run.stats.gold > gold || p.hp > hp || p.vitamins.size > 0, "the loot landed");
  run.update(1 / 60);
  assert.equal(run.events.events.length, 0, "opened: consumed");
});

test("a shop is never consumed by buying or leaving; it only expires", () => {
  const { run } = makeRun();
  const p = run.player;
  run.stats.gold = 1000;
  run.events.events.length = 0;
  run.events.spawn("shop", p.x + 1, p.z);
  open(run);
  const buy = findButtons(ui, /^Comprar/).find((b) => !b.disabled);
  assert.ok(buy, "something is affordable with 1000 gold");
  buy.click();
  assert.ok(run.stats.gold < 1000, "bought");
  click(/^Sair/);
  run.update(1 / 60);
  assert.equal(run.events.events.length, 1, "still there after buying and leaving");
  run.events.events[0].life = 0.001;
  run.update(1 / 60);
  assert.equal(run.events.events.length, 0, "gone when its time is up");
});

test("an altar is consumed by healing, not by leaving at full HP", () => {
  const { run } = makeRun();
  const p = run.player;
  run.events.events.length = 0;
  run.events.spawn("altar", p.x + 1, p.z);
  open(run); // full HP: only Leave is offered
  assert.equal(findButtons(ui, /^Curar/).length, 0);
  click(/^Sair/);
  run.update(1 / 60);
  assert.equal(run.events.events.length, 1);
  p.hp = 10;
  open(run);
  click(/^Curar/);
  assert.equal(p.hp, p.maxHp);
  run.update(1 / 60);
  assert.equal(run.events.events.length, 0, "healed: consumed");
});

test("a shop keeps its stock between visits; a paid renewal rerolls it and costs more each time", () => {
  const { run } = makeRun();
  const p = run.player;
  run.stats.gold = 1000;
  run.events.events.length = 0;
  run.events.spawn("shop", p.x + 1, p.z);
  const ev = run.events.events[0];
  const titles = () => ui.all().filter((n) => n.classList?.contains("shop-title")).map((n) => n.textContent);
  open(run);
  const first = titles();
  click(/^Sair/);
  for (let i = 0; i < 5; i++) {
    open(run);
    assert.deepEqual(titles(), first, "same stock on every visit");
    click(/^Sair/);
  }
  open(run);
  const price = run.events.renewPrice(run, ev);
  assert.equal(price, 20);
  click(/^Renovar/);
  assert.equal(run.stats.gold, 1000 - 20, "renewal charged");
  assert.equal(ev.renewals, 1);
  assert.ok(run.events.panel, "the shop panel is open again with the new stock");
  assert.deepEqual(titles(), ev.stock.map((it) => it.title));
  assert.equal(run.events.renewPrice(run, ev), 35, "the next renewal costs more");
  run.stats.gold = 10;
  click(/^Sair/);
  open(run);
  const renewBtn = findButtons(ui, /^Renovar/)[0];
  assert.ok(renewBtn.disabled, "cannot renew without the gold");
  click(/^Sair/);
});
