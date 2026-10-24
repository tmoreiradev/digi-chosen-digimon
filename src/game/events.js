// World events: chests, shops and altars that spawn in the world and can be
// interacted with by pressing E when nearby. Opening one pauses the game and
// shows a panel; closing it resumes.
//
// Each event lives at a world position and despawns after its lifetime.
//   chest   - one-time loot: coins + possibly a vitamin or heal
//   shop    - buy items with gold (heals, vitamins, XP boost)
//   altar   - free full heal, consumed on use

import { clamp, dist } from "../core/math.js";
import { el } from "../ui/dom.js";
import { tr } from "../core/lang.js";
import { applyVitaminPick } from "./vitamins.js";
import { MAX_LEVEL } from "./rules.js";

export const SHOP_ITEMS = [
  { key: "heal-small", title: "Poção", desc: "Restaura 30 HP.", cost: 25, kind: "heal", amount: 30, rarity: 1 },
  { key: "heal-full", title: "Restaurador", desc: "Restaura todo o HP.", cost: 75, kind: "heal-full", rarity: 2 },
  { key: "vitamin", title: "Vitamina", desc: "Bônus permanente aleatório de atributo.", cost: 120, kind: "vitamin", rarity: 2 },
  { key: "xp-boost", title: "Doce Raro", desc: "Ganha 1 nível de XP.", cost: 100, kind: "xp", rarity: 1 },
];

// Events appear 12–24 units from the player: on a 360-unit arena a run used to go ten
// minutes without one in reach when they were scattered anywhere.
const SPAWN_MIN = 12;
const SPAWN_MAX = 24;

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
    if (x == null || z == null) {
      const p = this.run.player;
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(SPAWN_MIN, SPAWN_MAX);
      x = clamp(p.x + Math.cos(a) * r, -half, half);
      z = clamp(p.z + Math.sin(a) * r, -half, half);
    }
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

  // Interact with the nearest event: open its panel (the game pauses). An event is consumed
  // when it is USED (chest opened, altar heals), not when it is looked at; shops expire only.
  interact() {
    const p = this.run.player;
    const ev = this.findNear(p.x, p.z);
    if (!ev || this.panel) return null;
    this.openPanel(ev);
    return ev;
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
      const loot = (ev.loot ??= this.rollChestLoot()); // rolled once: leaving and coming back does not reroll
      body.append(
        el("p", {}, "Um baú empoeirado. O que tem dentro?"),
        el("div", { class: "event-loot-preview" }, this.lootText(loot)),
        el("div", { class: "event-hint" }, "Aperte 1 para abrir, 2 para sair.")
      );
      const openBtn = el("button", { class: "btn", onclick: () => {
        ev.interacted = true; // consumed
        this.giveChestLoot(run, loot);
        this.opts.onBanner?.(`Baú aberto: ${this.lootText(loot)}`);
        this.opts.onSfx?.("pickup");
        close();
      } }, "Abrir ", el("kbd", {}, "1"));
      const leaveBtn = el("button", { class: "btn ghost", onclick: close }, "Sair ", el("kbd", {}, "2"));
      footer.append(openBtn, leaveBtn);

      this._panelKey = (e) => {
        if (!this.panel) { window.removeEventListener("keydown", this._panelKey); this._panelKey = null; return; }
        if (e.code === "Digit1") { e.preventDefault(); openBtn.click(); }
        else if (e.code === "Digit2") { e.preventDefault(); close(); }
      };
    } else if (ev.kind === "shop") {
      // The stock belongs to the shop: rolled once (leaving and coming back used to reroll it for free);
      // a paid renewal rerolls it.
      const items = (ev.stock ??= this.shopSelection());
      // The wallet is run.stats.gold (what the HUD shows); player.stats.gold is the coin multiplier.
      const goldLine = () => "Mercadorias à venda. Seu ouro: " + Math.floor(run.stats.gold) + "G";
      const goldText = el("p", { class: "shop-gold" }, goldLine());
      body.append(goldText);
      const list = el("div", { class: "shop-list" });
      const buyButtons = [];
      items.forEach((it, i) => {
        const btn = el("button", { class: "btn" }, "Comprar ", el("kbd", {}, String(i + 1)));
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
          el("div", { class: "shop-price" }, this.price(run, it) + "G"),
          btn
        );
        list.append(row);
      });
      body.append(list);
      body.append(el("div", { class: "event-hint" }, "Aperte 1-3 para comprar, R para renovar, 0 para sair."));
      const renewBtn = el("button", { class: "btn ghost" }, `Renovar ${this.renewPrice(run, ev)}G `, el("kbd", {}, "R"));
      renewBtn.onclick = (e) => {
        e?.preventDefault?.();
        if (!this.renew(run, ev)) return;
        close();
        this.openPanel(ev); // redraw with the new stock
      };
      const leaveBtn = el("button", { class: "btn ghost", onclick: close }, "Sair ", el("kbd", {}, "0"));
      footer.append(renewBtn, leaveBtn);
      const refresh = () => {
        goldText.textContent = goldLine();
        buyButtons.forEach((b, i2) => {
          const it2 = items[i2];
          const ok = run.stats.gold >= this.price(run, it2) && this.canApply(run, it2);
          b.disabled = !ok;
          b.className = "btn" + (ok ? "" : " disabled");
        });
        const canRenew = run.stats.gold >= this.renewPrice(run, ev);
        renewBtn.disabled = !canRenew;
        renewBtn.className = "btn ghost" + (canRenew ? "" : " disabled");
      };
      refresh();

      this._panelKey = (e) => {
        if (!this.panel) { window.removeEventListener("keydown", this._panelKey); this._panelKey = null; return; }
        const idx = parseInt(e.code.replace("Digit", ""), 10);
        if (!isNaN(idx) && idx >= 1 && idx <= items.length) {
          e.preventDefault();
          const btn = buyButtons[idx - 1];
          if (btn && !btn.disabled) btn.click();
        } else if (e.code === "KeyR") {
          e.preventDefault();
          if (!renewBtn.disabled) renewBtn.click();
        } else if (e.code === "Digit0") { e.preventDefault(); close(); }
      };
    } else if (ev.kind === "altar") {
      const missing = p.maxHp - p.hp;
      body.append(
        el("p", {}, "Um altar antigo vibra com poder."),
        missing > 0
          ? el("p", {}, `Restaurar ${missing} HP e ficar com a vida cheia?`)
          : el("p", {}, "Você já está com o HP cheio.")
      );
      if (missing > 0) {
        const healBtn = el("button", { class: "btn", onclick: () => {
          ev.interacted = true; // consumed
          p.hp = p.maxHp;
          this.opts.onBanner?.("O altar restaurou seu HP.");
          this.opts.onSfx?.("levelUp");
          close();
        } }, "Curar ", el("kbd", {}, "1"));
        footer.append(healBtn);
      }
      const leaveBtn = el("button", { class: "btn ghost", onclick: close }, "Sair ", el("kbd", {}, "2"));
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

  /** Renewal price: 20G, +15G per renewal of this shop, with the Gold Teeth discount. */
  renewPrice(run, ev) {
    return this.price(run, { cost: 20 + 15 * (ev.renewals ?? 0) });
  }

  /** Pay to reroll a shop's stock. False when the wallet is short. */
  renew(run, ev) {
    const cost = this.renewPrice(run, ev);
    if (run.stats.gold < cost) return false;
    run.stats.gold -= cost;
    ev.renewals = (ev.renewals ?? 0) + 1;
    ev.stock = this.shopSelection();
    this.opts.onBanner?.(`Estoque renovado por ${cost}G.`);
    return true;
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
    if (loot.kind === "coins") return loot.amount + " de ouro";
    if (loot.kind === "heal") return "Poção (" + loot.amount + " HP)";
    if (loot.kind === "vitamin") return "Vitamina";
    return loot.amount + " de ouro";
  }

  giveChestLoot(run, loot) {
    const p = run.player;
    if (loot.kind === "coins") {
      run.stats.gold += loot.amount;
    } else if (loot.kind === "heal") {
      run.healPlayer(loot.amount);
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

  /** Shop price after Gold Teeth (−8 % per copy, at most −24 %). */
  price(run, it) {
    const teeth = Math.min(3, run.upgrades?.get("gold-teeth")?.count ?? 0);
    return Math.round(it.cost * (1 - 0.08 * teeth));
  }

  /** Buy an item: apply the effect first and charge only when it applied. */
  buy(run, it) {
    const cost = this.price(run, it);
    if (run.stats.gold < cost || !this.canApply(run, it)) return false;
    if (!this.applyShopItem(run, it)) return false;
    run.stats.gold -= cost;
    this.opts.onBanner?.(`Comprou ${it.title} por ${cost}G.`);
    this.opts.onSfx?.("pickup");
    return true;
  }

  applyShopItem(run, it) {
    const p = run.player;
    if (it.kind === "heal") {
      run.healPlayer(it.amount);
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
        const label = tr(ev.kind === "chest" ? "Baú — E" : ev.kind === "shop" ? "Loja — E" : "Altar — E");
        const labelY = sy - zoom * 2.2;
        ctx.fillText(label, sx, labelY);
        ctx.fillStyle = "#ffd166";
        ctx.fillText(label, sx, labelY);
      }
    }
  }

  titleFor(ev) {
    if (ev.kind === "chest") return "Baú do Tesouro";
    if (ev.kind === "shop") return "Loja Ambulante";
    return "Altar Antigo";
  }
}
