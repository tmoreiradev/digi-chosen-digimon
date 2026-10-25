// A bot that plays a run the way a (cautious, average) human would, through the same
// surfaces main.js uses: the shared `input` object, rollChoices/applyChoice for level-ups,
// tryEvolve per level, and the chest/shop/altar panel's own buttons in the fake DOM.
//
// It reacts every 6 frames (100 ms), holds keys between decisions, flees nearby enemies,
// drifts to XP orbs when safe, walks to chests/shops/altars when it wants them, dashes
// when cornered, fires the ultimate in crowds, throws the ball at a weakened alpha, and
// keeps away from the arena edge, and in classic mode walks to the guardian altar and wakes
// the guardian once the zone has run five minutes. It is not good at the game; it is consistent.
import { makeRng } from "../src/core/rng.js";

const STEP = 1 / 60;
const DECIDE_EVERY = 6;

export function playRun({ run, input, calls, seed = 7, maxSeconds = 600, godMode = false, log = () => {} }) {
  const rng = makeRng(seed);
  const origRandom = Math.random;
  Math.random = () => rng.next(); // the game's own Math.random calls become reproducible
  const bot = new Bot(run, input, rng);
  const summary = { frames: 0, levelUps: 0, choices: {}, shops: 0, chests: 0, altars: 0, throws: 0, dashes: 0, ults: 0, evolutions: 0, maxEnemies: 0, invariantFailures: [] };
  let pendingLevelUps = 0;
  const prevOnLevelUp = run.opts.onLevelUp;
  run.opts.onLevelUp = () => {
    pendingLevelUps++;
    summary.levelUps++;
    prevOnLevelUp?.();
  };
  try {
    const maxFrames = Math.round(maxSeconds / STEP);
    for (let frame = 0; frame < maxFrames && run.state === "running"; frame++) {
      summary.frames = frame + 1;
      if (godMode) run.player.iframes = 1e9;
      if (run.stateEventPanel) {
        bot.handlePanel(summary); // main.js freezes the simulation while a panel is open
        continue;
      }
      if (frame % DECIDE_EVERY === 0) bot.decide(summary);
      run.update(STEP);
      const p = run.player;
      if (p.level > p.lastEvoCheck) {
        p.lastEvoCheck = p.level;
        if (run.tryEvolve()) summary.evolutions++;
      }
      input.jumpPressed = false;
      input.ultPressed = false;
      input.capturePressed = false;
      while (pendingLevelUps > 0) {
        pendingLevelUps--;
        const choices = run.rollChoices();
        if (!choices.length) continue;
        const choice = bot.pickChoice(choices);
        summary.choices[choice.kind] = (summary.choices[choice.kind] ?? 0) + 1;
        run.applyChoice(choice);
      }
      const alive = run.enemies.filter((e) => e.alive).length;
      if (alive > summary.maxEnemies) summary.maxEnemies = alive;
      if (frame % 30 === 0) checkInvariants(run, summary, frame);
      if (frame % 3600 === 0 && frame > 0) log(`t=${Math.round(run.time)}s lv${p.level} hp${Math.round(p.hp)}/${p.maxHp} zone${run.stage}${run.sanctuary ? " sanctuary" : ""} enemies=${alive} gold=${Math.floor(run.stats.gold)} kills=${run.stats.kills}`);
    }
  } finally {
    Math.random = origRandom;
    run.opts.onLevelUp = prevOnLevelUp;
  }
  summary.time = run.time;
  summary.state = run.state;
  summary.level = run.player.level;
  summary.kills = run.stats.kills;
  summary.stage = run.stage;
  summary.sanctuary = run.sanctuary;
  summary.allies = run.allies.list.length;
  summary.gold = Math.floor(run.stats.gold);
  return summary;
}

/** Things that must hold at any moment of any run; failures are collected, not thrown, so one run reports them all. */
export function checkInvariants(run, summary, frame) {
  const p = run.player;
  const fail = (what) => {
    if (summary.invariantFailures.length < 20) summary.invariantFailures.push(`frame ${frame} (t=${run.time.toFixed(1)}): ${what}`);
  };
  for (const k of ["x", "z", "hp", "maxHp", "xp", "xpNext", "level"]) if (!Number.isFinite(p[k])) fail(`player.${k} is ${p[k]}`);
  if (p.hp < 0 || p.hp > p.maxHp + 1e-6) fail(`player hp ${p.hp} outside [0, ${p.maxHp}]`);
  if (p.level < 50 && p.xp >= p.xpNext) fail(`xp ${p.xp} >= xpNext ${p.xpNext} at level ${p.level}`);
  if (run.stats.levels !== p.level - 1) fail(`stats.levels ${run.stats.levels} != level-1 ${p.level - 1}`);
  const half = run.biome.size / 2 + 1e-6;
  if (Math.abs(p.x) > half || Math.abs(p.z) > half) fail(`player outside the arena (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
  if (run.enemies.length > 260) fail(`${run.enemies.length} enemy entries (cap 260)`);
  if (run.enemies.some((e) => !e.alive)) fail("dead enemy entries left in the list");
  for (const e of run.enemies) {
    if (!Number.isFinite(e.x) || !Number.isFinite(e.z) || !Number.isFinite(e.hp)) {
      fail(`enemy ${e.species.name} has a non-finite field`);
      break;
    }
  }
  for (const k of ["gold", "kills", "damage", "dust"]) if (!Number.isFinite(run.stats[k]) || run.stats[k] < 0) fail(`stats.${k} is ${run.stats[k]}`);
  if (run.allies.list.length > run.allies.cap) fail(`${run.allies.list.length} allies over the cap ${run.allies.cap}`);
  if (run.boss.alive && !run.boss.enemy) fail("boss.alive without an enemy");
}

class Bot {
  constructor(run, input, rng) {
    this.run = run;
    this.input = input;
    this.rng = rng;
    this.wander = { x: 1, z: 0, until: 0 };
    this.visited = new Map(); // event id -> gold when last looked at (events are not consumed by looking)
  }

  decide(summary) {
    const run = this.run;
    const p = run.player;
    const input = this.input;
    let fx = 0;
    let fz = 0;
    let nearest = Infinity;
    let crowd = 0;
    for (const e of run.enemies) {
      if (!e.alive || e.dying > 0 || e.captureReady) continue;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 0.01;
      if (d < nearest) nearest = d;
      if (d < 8) crowd++;
      if (d < 9) {
        const w = ((9 - d) / d) * (e.tier === "boss" ? 1.5 : 1);
        fx += (dx / d) * w;
        fz += (dz / d) * w;
      }
    }
    // XP orbs and loot when nobody is breathing down our neck.
    if (nearest > 3.5) {
      let best = null;
      let bd = 14;
      for (const pk of run.pickups) {
        const d = Math.hypot(pk.x - p.x, pk.z - p.z);
        if (d < bd) {
          bd = d;
          best = pk;
        }
      }
      if (best) {
        fx += ((best.x - p.x) / (bd || 1)) * 0.7;
        fz += ((best.z - p.z) / (bd || 1)) * 0.7;
      }
    }
    // Five minutes into a classic zone: go wake the guardian, whatever is around.
    const altar = run.mode === "classic" && !run.zoneBossSpawned && run.stageTime >= 300 ? run.events.guardianAltar : null;
    // A chest, shop or altar worth the walk.
    const ev = altar ?? this.wantedEvent(nearest);
    if (ev) {
      const d = Math.hypot(ev.x - p.x, ev.z - p.z) || 1;
      const pull = altar ? 2.5 : 0.9;
      fx += ((ev.x - p.x) / d) * pull;
      fz += ((ev.z - p.z) / d) * pull;
      if (d < 1.8) input.capturePressed = true; // E opens it
    }
    // Stay off the walls.
    const half = run.biome.size / 2;
    if (p.x > half - 10) fx -= 1.5;
    if (p.x < -half + 10) fx += 1.5;
    if (p.z > half - 10) fz -= 1.5;
    if (p.z < -half + 10) fz += 1.5;
    // Nothing to do: wander, changing direction now and then.
    if (Math.abs(fx) < 0.2 && Math.abs(fz) < 0.2) {
      if (run.time > this.wander.until) {
        const a = this.rng.range(0, Math.PI * 2);
        this.wander = { x: Math.cos(a), z: Math.sin(a), until: run.time + this.rng.range(1, 3) };
      }
      fx = this.wander.x;
      fz = this.wander.z;
    }
    input.left = fx < -0.2;
    input.right = fx > 0.2;
    input.up = fz < -0.2;
    input.down = fz > 0.2;

    input.dash = nearest < 1.6 && p.dashCd <= 0;
    if (input.dash) summary.dashes++;
    if (p.ultCharge >= 1 && p.ultCd <= 0 && crowd >= 4) {
      input.ultPressed = true;
      summary.ults++;
    }
    if (run.capture.canThrow()) {
      input.capturePressed = true;
      summary.throws++;
    }
  }

  wantedEvent(nearestEnemy) {
    const run = this.run;
    const p = run.player;
    if (nearestEnemy < 4) return null; // not with enemies on us
    const ev = run.events.findNear(p.x, p.z, 40);
    if (!ev || ev.kind === "guardian") return null; // the guardian is woken on schedule (decide)
    const seenWith = this.visited.get(ev.id);
    if (ev.kind === "altar") return p.hp < p.maxHp * 0.6 && seenWith === undefined ? ev : null;
    if (ev.kind === "shop") {
      // Worth a (re)visit only with enough gold for something new since the last look.
      if (run.stats.gold < 25) return null;
      return seenWith === undefined || run.stats.gold - seenWith >= 75 ? ev : null;
    }
    return seenWith === undefined ? ev : null; // a chest is opened on the first visit anyway
  }

  /** The panel is open (simulation frozen): act like a human reading it, through its buttons. */
  handlePanel(summary) {
    const run = this.run;
    const p = run.player;
    const ui = document.getElementById("ui");
    const buttons = ui.all().filter((n) => n.tagName === "button");
    const byText = (re) => buttons.find((b) => re.test(b.textContent));
    const title = ui.querySelector("h2")?.textContent ?? "";
    const ev = run.events.findNear(p.x, p.z);
    if (ev) this.visited.set(ev.id, run.stats.gold);
    // Every interface language: the bot reads the panel like a player would.
    const LEAVE = /^(Sair|Leave|Salir)/;
    if (/Baú|Chest|Cofre/.test(title)) {
      summary.chests++;
      const open = byText(/^(Abrir|Open)/);
      if (open) {
        open.click();
        summary.chestsOpened = (summary.chestsOpened ?? 0) + 1;
      }
    } else if (/Altar/.test(title)) {
      summary.altars++;
      (byText(/^(Curar|Heal)/) ?? byText(LEAVE)).click();
    } else if (/Loja|Shop|Tienda/.test(title)) {
      summary.shops++;
      for (const row of ui.querySelectorAll(".shop-row")) {
        const name = row.querySelector(".shop-title").textContent;
        const btn = row.querySelector("button");
        if (btn.disabled) continue;
        const want =
          (/^(Doce Raro|Rare Candy|Caramelo Raro)$/.test(name) && run.stats.gold >= 100) ||
          (/^(Poção|Potion|Poción)$/.test(name) && p.hp < p.maxHp * 0.5) ||
          (/^(Restaurador|Full Restore|Restaurar Todo)$/.test(name) && p.hp < p.maxHp * 0.35) ||
          (/^(Vitamina|Vitamin)$/.test(name) && run.stats.gold >= 200);
        if (want) {
          btn.click();
          summary.bought = (summary.bought ?? 0) + 1;
        }
      }
      if (ev) this.visited.set(ev.id, run.stats.gold); // after buying, so the next look needs new gold
      byText(LEAVE)?.click();
    } else {
      run.events.panel?.close();
    }
    if (run.stateEventPanel) run.events.panel?.close(); // never get stuck on an unknown panel
  }

  /** Prefers new moves, then items by rarity, then move upgrades; otherwise whatever came up. */
  pickChoice(choices) {
    const score = (c) =>
      c.kind === "newMove" ? 50 : c.kind === "item" ? 30 + (c.rarity ?? 0) * 3 : c.kind === "upMove" ? 25 : c.kind === "fusion" ? 20 : c.kind === "slot" ? 15 : 10 + (c.rarity ?? 0);
    let best = choices[0];
    for (const c of choices) if (score(c) + this.rng.range(0, 5) > score(best) + this.rng.range(0, 5)) best = c;
    return best;
  }
}
