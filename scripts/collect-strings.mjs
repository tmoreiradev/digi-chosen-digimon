// Lists every interface string that reaches the screen in English mode without a translation.
// It plays the screens, level-up cards, world events, achievements and full bot runs (classic and
// tower) in the fake DOM used by the tests. Usage: node scripts/collect-strings.mjs [--json]
// The test tests/lang.test.mjs runs the same sweep and fails if anything is left.

import { installFakeDom } from "../tests/_dom.mjs";

export async function collectMissing() {
  const dom = installFakeDom();
  dom.register("ui");
  const { setLang, tr, TR_MISSING } = await import("../src/core/lang.js");
  setLang("en");
  TR_MISSING.clear();
  const { makeRun, loadData } = await import("../tests/_helpers.mjs");
  const { playRun } = await import("../tests/_bot.mjs");
  const { Screens } = await import("../src/ui/screens.js");
  const { Hud } = await import("../src/ui/hud.js");
  const { LevelUpPanel } = await import("../src/ui/levelup.js");
  const { accounts, profile } = await import("../src/ui/account.js");
  const { ACHIEVEMENTS, DEX_TASKS } = await import("../src/game/achievements.js");

  const data = loadData();
  accounts.load();
  // What actually ended up on screen (text nodes, including direct textContent writes), not only
  // what went through tr(): a sink that skips tr() shows up here.
  const rendered = new Set();
  const scan = (node) => {
    for (const n of node?.all?.() ?? []) if (n.tagName === "#text" && n.data) rendered.add(n.data);
  };
  const root = document.createElement("div");
  const screens = new Screens(root, data);
  const seeRun = (run) => {
    screens.getRun = () => run;
    for (const show of [
      () => screens.showTitle(),
      () => screens.showHelp(),
      () => screens.showAccountPicker(),
      () => screens.showAccountManage(),
      () => screens.showPicker(),
      () => screens.showSetup(),
      () => screens.showPause?.(() => {}, () => {}),
      () => screens.showHeldItem(),
      () => screens.showAchievements?.(),
      () => screens.showNickname?.(),
      () => screens.showPokedex?.(),
      () => ((run.state = "dead"), screens.showResults(run, false)),
      () => ((run.state = "victory"), screens.showResults(run, true)),
    ]) {
      show();
      scan(root);
    }
  };
  // Account errors go through tr() where they are shown.
  for (const r of [accounts.create("", ""), accounts.create("Ash", ""), accounts.create("Ash", ""), accounts.login("Nobody", ""), accounts.login("Ash", "x")]) {
    if (r.error) tr(r.error);
  }
  accounts.create("Brock", "pw");
  tr(accounts.login("Brock", "wrong").error ?? "");

  const hudRoot = document.createElement("div");
  const hud = new Hud(hudRoot);
  const panel = new LevelUpPanel(document.createElement("div"));

  const sweepRun = (run, calls) => {
    hud.update(run);
    scan(hudRoot);
    for (const b of calls.banners) tr(b);
    for (const f of run.floaters) tr(String(f.text));
    for (let i = 0; i < 40; i++) {
      const choices = run.rollChoices();
      panel.show?.(choices);
      scan(panel.root ?? panel.el ?? panel.node);
      panel.close?.();
    }
  };

  // A few species so kits, abilities and evolutions vary.
  for (const speciesId of [1, 4, 7, 25, 92, 133]) {
    const { run, calls } = makeRun({ speciesId, profile });
    seeRun(run);
    sweepRun(run, calls);
  }
  // Full bot runs: banners, bosses, evolutions, captures, events.
  const bot = [];
  for (const [mode, seed] of [["classic", 23], ["tower", 42], ["endless", 5]]) {
    const { run, input, calls } = makeRun({ mode, profile });
    const banners = [];
    const orig = run.banner.bind(run);
    run.banner = (t) => {
      banners.push(t);
      return orig(t);
    };
    const floaters = [];
    const of = run.floater.bind(run);
    run.floater = (x, y, z, text, c) => {
      floaters.push(String(text));
      return of(x, y, z, text, c);
    };
    let frames = 0;
    const upd = run.update.bind(run);
    run.update = (dt) => {
      upd(dt);
      if (++frames % 600 === 0) hud.update(run);
    };
    bot.push({ mode, ...playRun({ run, input, calls, seed, maxSeconds: 25 * 60, godMode: true }) });
    for (const b of banners) tr(b);
    for (const f of floaters) tr(f);
    sweepRun(run, calls);
    seeRun(run);
  }
  // World event panels, every kind.
  {
    const { run } = makeRun({ profile });
    run.stats.gold = 1000;
    for (const kind of ["chest", "shop", "altar"]) {
      run.events.events.length = 0;
      run.events.spawn(kind, run.player.x + 1, run.player.z);
      run.events.openPanel(run.events.events[0]);
      const ui = document.getElementById("ui");
      scan(ui);
      // Buy something so the shop refreshes its gold line (a direct textContent write).
      ui.all().find((n) => n.tagName === "button" && !n.disabled && /^(Buy|Comprar)/.test(n.textContent))?.click();
      scan(ui);
      run.events.panel?.close?.();
    }
    for (const loot of [{ kind: "coins", amount: 10 }, { kind: "heal", amount: 30 }, { kind: "vitamin" }]) tr(run.events.lootText(loot));
  }
  for (const a of ACHIEVEMENTS) {
    tr(a.title);
    tr(a.desc);
  }
  for (const t of DEX_TASKS) {
    tr(t.title);
    tr(t.desc);
  }
  return { missing: [...TR_MISSING].sort(), rendered: [...rendered].sort(), bot };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("collect-strings.mjs")) {
  const { missing } = await collectMissing();
  if (process.argv.includes("--json")) console.log(JSON.stringify(missing, null, 1));
  else {
    console.log(missing.join("\n"));
    console.log(`\n${missing.length} strings without an English translation`);
  }
}
