// Zone map (M): discovered events, the always-visible guardian altar, and following an icon.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./_dom.mjs";

const dom = installFakeDom();
dom.register("ui");
const { makeRun } = await import("./_helpers.mjs");
const { ZoneMap } = await import("../src/ui/zonemap.js");
const { SEEN_RANGE } = await import("../src/game/events.js");

test("events are discovered within range; the guardian altar is on the map from the start", () => {
  const { run } = makeRun();
  const p = run.player;
  run.events.spawn("chest", p.x + SEEN_RANGE + 20, p.z);
  run.events.spawn("shop", p.x + 5, p.z);
  const map = new ZoneMap(document.getElementById("ui"));
  run.update(1 / 60);
  const kinds = () => map.shown(run).map((ev) => ev.kind).sort();
  assert.deepEqual(kinds(), ["guardian", "shop"], "the far chest is still undiscovered");
  p.x += SEEN_RANGE + 15; // walk towards the chest
  run.update(1 / 60);
  assert.deepEqual(kinds(), ["chest", "guardian", "shop"]);
});

test("clicking an icon follows it, clicking again stops; the follow ends with the event", () => {
  const { run } = makeRun();
  const map = new ZoneMap(document.getElementById("ui"));
  let closed = 0;
  map.open(run, () => closed++);
  assert.ok(map.active);
  const altar = run.events.guardianAltar;
  const at = map.toMap(altar.x, altar.z);
  assert.equal(map.click(at.x + 3, at.y - 3), altar, "a click near the icon picks it");
  assert.equal(run.events.followId, altar.id);
  map.click(at.x, at.y);
  assert.equal(run.events.followId, null, "a second click stops following");
  assert.equal(map.click(-50, -50), null, "a click on nothing does nothing");
  map.click(at.x, at.y);
  map.close();
  assert.equal(closed, 1);
  assert.equal(map.active, false);

  // The guardian wakes: the altar is spent and the compass lets go.
  run.callGuardian();
  run.events.guardianAltar.interacted = true;
  run.player.iframes = 1e9;
  run.update(1 / 60);
  assert.equal(run.events.followId, null);
});
