// World events: chests, shops and altars that spawn in the world and can be
// interacted with by pressing E when nearby. Opening one pauses the game and
// shows a panel; closing it resumes.
//
// Each event lives at a world position and despawns after its lifetime.
//   chest   - one-time loot: coins + possibly a vitamin or heal
//   shop    - buy items with gold (heals, vitamins, XP boost)
//   altar   - free full heal, consumed on use

import { clamp, dist } from "../core/math.js";
import { el, clear } from "../ui/dom.js";
import { applyVitaminPick } from "./vitamins.js";
import { MAX_LEVEL } from "./rules.js";

export const SHOP_ITEMS = [
  { key: "heal-small", title: "Potion", desc: "Restore 30 HP.", cost: 25, kind: "heal", amount: 30, rarity: 1 },
  { key: "heal-full", title: "Full Restore", desc: "Restore to full HP.", cost: 75, kind: "heal-full", rarity: 2 },
  { key: "vitamin", title: "Vitamin", desc: "Random permanent stat boost.", cost: 120, kind: "vitamin", rarity: 2 },
  { key: "xp-boost", title: "Rare Candy", desc: "Gain 1 level worth of XP.", cost: 100, kind: "xp", rarity: 1 },
];

const CHEST_LOOT = [
  { kind: "coins", min: 15, max: 45, weight: 60 },
  { kind: "coins", min: 40, max: 90, weight: 25 },
  { kind: "heal", amount: 30, weight: 10 },
  { kind: "vitamin", weight: 5 },
];

export class WorldEvents {
  constructor(run) {
    this.run = run;
    this.events = [];
    this.nextId = 1;
    this.spawnTimer = 0;
    this.spawnInterval = 90; // seconds between spawns
    this.panel = null; // { close }
    this.opts = run.opts; // callbacks: onBanner, onSfx, onWorldEventOpen, onWorldEventClose
  }

  /* ------------------------------------------------------------- spawning */

  spawn(kind, x, z) {
    const biome = this.run.biome;
    const half = biome.size / 2 - 6;
    const rng = this.run.rng;
    if (x == null) x = rng.range(-half, half);
    if (z == null) z = rng.range(-half, half);
    this.events.push({
      id: this.nextId++,
      kind,
      x, z,
      life: kind === "shop" ? 150 : 75,
      interacted: false,
    });
  }

  update(dt) {
    // Spawn new events on a timer (max 2 active at once).
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval && this.events.length < 2) {
      this.spawnTimer = 0;
      const roll = this.run.rng.range(0, 1);
      const kind = roll < 0.5 ? "chest" : roll < 0.8 ? "shop" : "altar";
      this.spawn(kind);
    }

    // Despawn old or already-interacted events.
    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i];
      ev.life -= dt;
      if (ev.life <= 0 || ev.interacted) this.events.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------- interaction */

  // Return the nearest non-interacted event within range of (x, z).
  findNear(x, z, range = 2.5) {
    let best = null;
    let bestD = range;
    for (const ev of this.events) {
      if (ev.interacted) continue;
      const d = dist(ev.x, ev.z, x, z);
      if (d < bestD) { bestD = d; best = ev; }
    }
    return best;
  }

  // Interact with the nearest event: mark it, open the panel, pause the game.
  interact() {
    const p = this.run.player;
    const ev = this.findNear(p.x, p.z);
    if (!ev || this.panel) return null;
    ev.interacted = true;
    this.openPanel(ev);
    return ev;
  }

  closePanel() {
    if (!this.panel) return;
    window.removeEventListener("keydown", this._panelKey);
    this._panelKey = null;
    this.panel.close();
    this.panel = null;
    this.run.stateEventPanel = false;
    if (this.opts.onWorldEventClose) this.opts.onWorldEventClose();
  }

  openPanel(ev) {
    const run = this.run;
    const p = run.player;
    const container = document.getElementById("ui");
    const backdrop = el("div", { class: "event-backdrop" });
    const panel = el("div", { class: "event-panel" });

    const close = () => {
      window.removeEventListener("keydown", this._panelKey);
      this._panelKey = null;
      this.panel = null;
      backdrop.remove();
      run.stateEventPanel = false;
      if (this.opts.onWorldEventClose) this.opts.onWorldEventClose();
    };

    const header = el("h2", {}, this.titleFor(ev));
    const body = el("div", { class: "event-body" });
    const footer = el("div", { class: "event-footer" });

    if (ev.kind === "chest") {
      const loot = this.rollChestLoot();
      body.append(
        el("p", {}, "A dusty chest. What's inside?"),
        el("div", { class: "event-loot-preview" }, this.lootText(loot)),
        el("div", { class: "event-hint" }, "Press 1 to open, 2 to leave.")
      );
      const openBtn = el("button", { class: "btn", onclick: () => {
        this.giveChestLoot(run, loot);
        this.opts.onBanner?.(`Chest opened: ${this.lootText(loot)}`);
        this.opts.onSfx?.("pickup");
        close();
      } }, "Open ", el("kbd", {}, "1"));
      const leaveBtn = el("button", { class: "btn ghost", onclick: close }, "Leave ", el("kbd", {}, "2"));
      footer.append(openBtn, leaveBtn);

      this._panelKey = (e) => {
        if (!this.panel) { window.removeEventListener("keydown", this._panelKey); this._panelKey = null; return; }
        if (e.code === "Digit1") { e.preventDefault(); openBtn.click(); }
        else if (e.code === "Digit2") { e.preventDefault(); close(); }
      };
    } else if (ev.kind === "shop") {
      const items = this.shopSelection();
      // The wallet is run.stats.gold (what the HUD shows); player.stats.gold is the coin multiplier.
      const goldLine = () => "Wares for sale. Your gold: " + Math.floor(run.stats.gold) + "G";
      const goldText = el("p", { class: "shop-gold" }, goldLine());
      body.append(goldText);
      const list = el("div", { class: "shop-list" });
      const buyButtons = [];
      items.forEach((it, i) => {
        const btn = el("button", { class: "btn" }, "Buy ", el("kbd", {}, String(i + 1)));
        btn.onclick = (e) => {
          e.preventDefault();
          if (this.buy(run, it)) refresh();
        };
        buyButtons.push(btn);
        const row = el("div", { class: "shop-row" });
        row.append(
          el("div", { class: "shop-info" },
            el("div", { class: "shop-title" }, it.title),
            el("div", { class: "shop-desc" }, it.desc)
          ),
          el("div", { class: "shop-price" }, it.cost + "G"),
          btn
        );
        list.append(row);
      });
      body.append(list);
      body.append(el("div", { class: "event-hint" }, "Press 1-3 to buy, 0 to leave."));
      const leaveBtn = el("button", { class: "btn ghost", onclick: close }, "Leave ", el("kbd", {}, "0"));
      footer.append(leaveBtn);
      const refresh = () => {
        goldText.textContent = goldLine();
        buyButtons.forEach((b, i2) => {
          const it2 = items[i2];
          const ok = run.stats.gold >= it2.cost && this.canApply(run, it2);
          b.disabled = !ok;
          b.className = "btn" + (ok ? "" : " disabled");
        });
      };
      refresh();

      this._panelKey = (e) => {
        if (!this.panel) { window.removeEventListener("keydown", this._panelKey); this._panelKey = null; return; }
        const idx = parseInt(e.code.replace("Digit", ""), 10);
        if (!isNaN(idx) && idx >= 1 && idx <= items.length) {
          e.preventDefault();
          const btn = buyButtons[idx - 1];
          if (btn && !btn.disabled) btn.click();
        } else if (e.code === "Digit0") { e.preventDefault(); close(); }
      };
    } else if (ev.kind === "altar") {
      const missing = p.maxHp - p.hp;
      body.append(
        el("p", {}, "An ancient altar hums with power."),
        missing > 0
          ? el("p", {}, `Restore ${missing} HP to full?`)
          : el("p", {}, "You are already at full HP.")
      );
      if (missing > 0) {
        const healBtn = el("button", { class: "btn", onclick: () => {
          p.hp = p.maxHp;
          this.opts.onBanner?.("Altar restored your HP.");
          this.opts.onSfx?.("levelUp");
          close();
        } }, "Heal ", el("kbd", {}, "1"));
        footer.append(healBtn);
      }
      const leaveBtn = el("button", { class: "btn ghost", onclick: close }, "Leave ", el("kbd", {}, "2"));
      footer.append(leaveBtn);

      this._panelKey = (e) => {
        if (!this.panel) { window.removeEventListener("keydown", this._panelKey); this._panelKey = null; return; }
        if (e.code === "Digit1" && missing > 0) { e.preventDefault(); footer.querySelector("button.btn").click(); }
        else if (e.code === "Digit2") { e.preventDefault(); close(); }
      };
    }

    panel.append(header, body, footer);
    backdrop.append(panel);
    container.append(backdrop);

    this.panel = { close };

    if (this.opts.onWorldEventOpen) this.opts.onWorldEventOpen();
    run.stateEventPanel = true;

    window.addEventListener("keydown", this._panelKey);
    backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });
  }

  shopRow(it, keyNum, p, run) {
    const row = el("div", { class: "shop-row" });
    row.append(
      el("div", { class: "shop-info" },
        el("div", { class: "shop-title" }, it.title),
        el("div", { class: "shop-desc" }, it.desc)
      ),
      el("div", { class: "shop-price" }, it.cost + "G"),
      el("button", {
        class: "btn " + (p.stats.gold < it.cost ? "disabled" : ""),
        disabled: p.stats.gold < it.cost,
      }, "Buy ", el("kbd", {}, String(keyNum)))
    );
    return row;
  }

  shopSelection() {
    const rng = this.run.rng;
    const pool = [...SHOP_ITEMS];
    const picked = [];
    while (picked.length < 3 && pool.length) {
      const roll = rng.range(0, 100);
      let acc = 0;
      let pick = null;
      for (const it of pool) {
        acc += (4 - it.rarity) * 20;
        if (roll < acc) { pick = it; break; }
      }
      if (!pick) pick = pool[pool.length - 1];
      picked.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return picked;
  }

  rollChestLoot() {
    const rng = this.run.rng;
    const roll = rng.range(0, 100);
    let acc = 0;
    for (const loot of CHEST_LOOT) {
      acc += loot.weight;
      if (roll < acc) {
        if (loot.kind === "coins") return { kind: "coins", amount: Math.floor(rng.range(loot.min, loot.max + 1)) };
        return { kind: loot.kind, amount: loot.amount };
      }
    }
    return { kind: "coins", amount: 20 };
  }

  lootText(loot) {
    if (loot.kind === "coins") return loot.amount + " gold";
    if (loot.kind === "heal") return "Potion (" + loot.amount + " HP)";
    if (loot.kind === "vitamin") return "Vitamin";
    return loot.amount + " gold";
  }

  giveChestLoot(run, loot) {
    const p = run.player;
    if (loot.kind === "coins") {
      run.stats.gold += loot.amount;
    } else if (loot.kind === "heal") {
      p.hp = Math.min(p.maxHp, p.hp + loot.amount);
      this.opts.onSfx?.("pickup");
    } else if (loot.kind === "vitamin") {
      this.applyShopItem(run, { kind: "vitamin" });
    }
  }

  /** False when the item's effect cannot be applied right now (e.g. Rare Candy at the level cap). */
  canApply(run, it) {
    if (it.kind === "xp") return run.player.level < MAX_LEVEL;
    return true;
  }

  /** Buy an item: apply the effect first and charge only when it applied. */
  buy(run, it) {
    if (run.stats.gold < it.cost || !this.canApply(run, it)) return false;
    if (!this.applyShopItem(run, it)) return false;
    run.stats.gold -= it.cost;
    this.opts.onBanner?.(`Bought ${it.title} for ${it.cost}G.`);
    this.opts.onSfx?.("pickup");
    return true;
  }

  applyShopItem(run, it) {
    const p = run.player;
    if (it.kind === "heal") {
      p.hp = Math.min(p.maxHp, p.hp + it.amount);
      return true;
    } else if (it.kind === "heal-full") {
      p.hp = p.maxHp;
      return true;
    } else if (it.kind === "vitamin") {
      const defs = run.rules.vitamins;
      const def = defs[Math.floor(run.rng.range(0, defs.length))];
      applyVitaminPick(run, def.key, 1);
      return true;
    } else if (it.kind === "xp") {
      // Rare Candy goes through Run's single level-up path, so xpNext, stats,
      // kit moves and the upgrade choice stay in sync. False at the level cap.
      if (!run.useRareCandy()) return false;
      this.opts.onSfx?.("pickup");
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------- drawing */

  draw(ctx, zoom, camX, camZ, w, h) {
    const run = this.run;
    const t = run.time;
    for (const ev of this.events) {
      const sx = (ev.x - camX) * zoom + w / 2;
      const sy = (ev.z - camZ) * zoom * 0.62 + h / 2;
      if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) continue;

      const pulse = 1 + 0.15 * Math.sin(t * 6);
      const u = zoom * 0.5 * pulse;
      ctx.save();
      ctx.translate(sx, sy);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(0, 1, u * 0.7, u * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      if (ev.kind === "chest") {
        ctx.fillStyle = "#8d6e63";
        ctx.fillRect(-u * 0.3, -u * 0.35, u * 0.6, u * 0.4);
        ctx.fillStyle = "#5d4037";
        ctx.fillRect(-u * 0.15, -u * 0.35, u * 0.3, u * 0.08);
        ctx.fillStyle = "#ffd166";
        ctx.beginPath();
        ctx.arc(0, -u * 0.1, u * 0.09, 0, Math.PI * 2);
        ctx.fill();
      } else if (ev.kind === "shop") {
        ctx.fillStyle = "#4caf50";
        ctx.beginPath();
        ctx.moveTo(0, -u * 0.45);
        ctx.lineTo(u * 0.35, u * 0.1);
        ctx.lineTo(-u * 0.35, u * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(-u * 0.12, u * 0.05, u * 0.24, u * 0.1);
      } else if (ev.kind === "altar") {
        ctx.fillStyle = "#90caf9";
        ctx.beginPath();
        ctx.arc(0, -u * 0.25, u * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2196f3";
        ctx.beginPath();
        ctx.rect(-u * 0.18, u * 0.05, u * 0.36, u * 0.25);
        ctx.fill();
      }

      ctx.restore();

      // Proximity hint when close enough to interact.
      const p = run.player;
      if (dist(ev.x, ev.z, p.x, p.z) < 1.9) {
        ctx.fillStyle = "rgba(20,16,40,0.85)";
        ctx.font = "700 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        const label = ev.kind === "chest" ? "Chest — E" : ev.kind === "shop" ? "Shop — E" : "Altar — E";
        const labelY = sy - zoom * 2.2;
        ctx.fillText(label, sx, labelY);
        ctx.fillStyle = "#ffd166";
        ctx.fillText(label, sx, labelY);
      }
    }
  }

  titleFor(ev) {
    if (ev.kind === "chest") return "Treasure Chest";
    if (ev.kind === "shop") return "Traveling Shop";
    return "Ancient Altar";
  }
}
