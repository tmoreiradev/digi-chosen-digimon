// Level-up panel: close() hides the cards without picking (used when a run ends mid-choice).
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./_dom.mjs";

installFakeDom();
const { LevelUpPanel } = await import("../src/ui/levelup.js");

test("close() hides the cards, deactivates the panel and does not call onPick", () => {
  const picks = [];
  const root = document.createElement("div");
  const panel = new LevelUpPanel(root, (...a) => picks.push(a));
  panel.show([{ kind: "item", key: "charcoal", title: "Charcoal", sub: "+3% damage", lines: [] }]);
  assert.equal(panel.active, true);
  assert.equal(root.className, "levelup show");
  assert.equal(root.querySelectorAll(".lu-card").length, 1);

  panel.close();
  assert.equal(panel.active, false);
  assert.equal(root.className, "levelup");
  assert.equal(root.children.length, 0);
  assert.deepEqual(picks, []);
  assert.equal(panel.key("Digit1"), false, "keys are ignored once closed");
});
