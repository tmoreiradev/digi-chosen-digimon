// In-run HUD: player card, region info, threat meter, minimap and ability bar.

import { el, clear, typeCss } from "./dom.js";
import { creatureSprite } from "../render/creature.js";
import { paintSpritePortrait } from "../render/sprites.js";
import { clamp, fmtClock, fmtTime } from "../core/math.js";

export class Hud {
  constructor(root) {
    this.root = root;
    this.build();
  }

  build() {
    clear(this.root);
    this.root.className = "hud";

    // Top-left: player card
    this.portrait = el("canvas", { class: "hud-portrait", width: 96, height: 96 });
    this.name = el("div", { class: "hud-name" });
    this.shinyBadge = el("span", { class: "hud-shiny" }, "★");
    this.types = el("div", { class: "hud-types" });
    this.evoHint = el("div", { class: "hud-evo" });
    this.level = el("div", { class: "hud-level" });
    this.root.append(
      el(
        "div",
        { class: "hud-card" },
        el("div", { class: "hud-portrait-wrap" }, this.portrait, this.level),
        el("div", { class: "hud-info" }, this.name, this.shinyBadge, this.types, this.evoHint)
      )
    );

    // Top-centre: region + threat
    this.region = el("div", { class: "hud-region" });
    this.zonePips = el("div", { class: "hud-pips" });
    this.difficulty = el("span", { class: "hud-diff" });
    this.clock = el("div", { class: "hud-clock" });
    this.threatLabel = el("div", { class: "hud-threat-label" });
    this.threatBar = el("div", { class: "hud-threat" });
    this.runTimer = el("div", { class: "hud-runtime" });
    // Boss bar: shown under the region block only while a boss is alive.
    this.bossName = el("div", { class: "hud-boss-name" });
    this.bossFill = el("i", { class: "fill boss" });
    this.bossText = el("span", { class: "bar-text" });
    this.bossWrap = el("div", { class: "hud-boss" }, this.bossName, el("div", { class: "bar boss" }, this.bossFill, this.bossText));
    this.root.append(
      el(
        "div",
        { class: "hud-top" },
        el("div", { class: "hud-regionline" }, this.region, this.zonePips, this.difficulty),
        this.clock,
        this.threatLabel,
        this.threatBar,
        this.runTimer,
        this.bossWrap
      )
    );

    // Top-right: minimap
    this.minimap = el("canvas", { class: "hud-minimap", width: 220, height: 220 });
    this.root.append(el("div", { class: "hud-map-wrap" }, this.minimap));

    // Left: currency
    this.gold = el("div", { class: "hud-res" });
    this.dust = el("div", { class: "hud-res" });
    this.kills = el("div", { class: "hud-res" });
    this.root.append(el("div", { class: "hud-res-wrap" }, this.gold, this.dust, this.kills));

    // Bottom-left: move slots + ult
    this.slots = el("div", { class: "hud-slots" });
    this.ult = el("div", { class: "hud-ult" });
    this.root.append(el("div", { class: "hud-bottom" }, this.slots, this.ult));

    // Bottom: health + xp bars
    this.hpFill = el("i", { class: "fill hp" });
    this.hpText = el("span", { class: "bar-text" });
    this.xpFill = el("i", { class: "fill xp" });
    this.xpText = el("span", { class: "bar-text" });
    this.root.append(
      el(
        "div",
        { class: "hud-bars" },
        el("div", { class: "bar hp" }, this.hpFill, this.hpText),
        el("div", { class: "bar xp" }, this.xpFill, this.xpText)
      )
    );

    // Banners
    this.bannerHost = el("div", { class: "hud-banners" });
    this.root.append(this.bannerHost);

    this.portraitCtx = this.portrait.getContext("2d");
    this.mapCtx = this.minimap.getContext("2d");
    this.lastSpecies = -1;
    this.lastNickname = null;
    this.portraitReady = false;
  }

  banner(text) {
    const node = el("div", { class: "banner" }, text);
    this.bannerHost.append(node);
    setTimeout(() => node.classList.add("out"), 1600);
    setTimeout(() => node.remove(), 2200);
  }

  update(run) {
    const p = run.player;

    if (p.speciesId !== this.lastSpecies || p.nickname !== this.lastNickname) {
      this.lastSpecies = p.speciesId;
      this.lastNickname = p.nickname;
      this.name.textContent = p.nickname ?? p.species.name;
      this.name.style.color = p.nickname ? "#ffd700" : "";
      this.shinyBadge.style.display = p.shiny ? "inline" : "none";
      clear(this.types);
      for (const t of p.types) this.types.append(el("span", { class: "chip", style: { background: typeCss(t) } }, t));
      this.evoHint.textContent = "";
      this.portraitReady = false;
    }
    // The sheet loads asynchronously, so keep retrying until the real portrait
    // lands (the procedural sprite covers the wait).
    if (!this.portraitReady) this.portraitReady = this.drawPortrait(p.species);
    this.level.textContent = `Nv ${p.level}`;

    this.region.textContent = run.biome.name;
    clear(this.zonePips);
    for (let i = 0; i < 3; i++) this.zonePips.append(el("i", { class: "pip" + (i < run.stage ? " on" : "") }));
    this.difficulty.textContent = run.difficulty.name.toUpperCase();
    this.difficulty.className = "hud-diff " + run.difficulty.id;

    this.clock.textContent = fmtClock(8 * 3600 + run.time * 60);
    this.runTimer.textContent = `${fmtTime(run.time)} · ${run.sanctuary ? "Sanctuary" : "Zone " + run.stage}`;

    // Threat meter reflects enemy pressure over the stage.
    const threat = clamp(run.enemies.length / 70, 0, 1);
    const labels = ["CALM", "RESTLESS", "ALERT", "DANGER", "SWARMED"];
    this.threatLabel.textContent = labels[Math.min(labels.length - 1, Math.floor(threat * labels.length))];
    this.threatBar.style.setProperty("--v", `${Math.round(threat * 100)}%`);

    // Boss bar
    const boss = run.boss;
    const be = boss?.alive ? boss.enemy : null;
    if (be) {
      this.bossWrap.classList.add("show");
      const kind = boss.kind === "legendary" ? " · Legendary" : boss.kind === "guardian" ? " · Guardian" : "";
      this.bossName.textContent = `${boss.name}${kind}`;
      const pct = clamp(be.hp / be.maxHp, 0, 1);
      this.bossFill.style.width = `${pct * 100}%`;
      this.bossText.textContent = `Phase ${boss.phase} · ${Math.ceil(be.hp)} / ${Math.round(be.maxHp)}`;
    } else {
      this.bossWrap.classList.remove("show");
    }

    this.gold.textContent = `◈ ${Math.floor(run.stats.gold)}`;
    this.dust.textContent = `✦ ${run.stats.dust}`;
    this.kills.textContent = `☠ ${run.stats.kills}`;

    // Move slots
    clear(this.slots);
    p.moves.forEach((mv, i) => {
      const ready = mv.timer <= 0;
      this.slots.append(
        el(
          "div",
          { class: "slot" + (ready ? " ready" : "") },
          el("span", { class: "slot-key" }, String(i + 1)),
          el("span", { class: "slot-name" }, mv.def.name),
          el("i", { class: "slot-type", style: { background: typeCss(mv.def.type) } }),
          el("i", { class: "slot-cd", style: { width: `${clamp(mv.timer / Math.max(0.2, mv.def.cd), 0, 1) * 100}%` } })
        )
      );
    });
    for (let i = p.moves.length; i < p.moveSlots; i++) {
      this.slots.append(el("div", { class: "slot empty" }, el("span", { class: "slot-key" }, String(i + 1))));
    }

    // Ultimate
    const charge = p.ultCharge;
    this.ult.className = "hud-ult" + (charge >= 1 ? " ready" : "");
    this.ult.innerHTML = "";
    this.ult.append(
      el("span", { class: "ult-key" }, "R"),
      el("span", { class: "ult-name" }, run.ultimateName()),
      el("i", { class: "ult-fill", style: { width: `${charge * 100}%` } })
    );

    // Bars
    const hpPct = clamp(p.hp / p.maxHp, 0, 1);
    this.hpFill.style.width = `${hpPct * 100}%`;
    this.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    const xpPct = clamp(p.xp / p.xpNext, 0, 1);
    this.xpFill.style.width = `${xpPct * 100}%`;
    this.xpText.textContent = `XP ${Math.floor(p.xp)} / ${p.xpNext}`;

    this.drawMinimap(run);
  }

  drawPortrait(species) {
    const g = this.portraitCtx;
    const size = 96;
    g.clearRect(0, 0, size, size);
    const grad = g.createRadialGradient(size / 2, size * 0.55, 4, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(90,80,150,0.55)");
    grad.addColorStop(1, "rgba(10,8,24,0.85)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    g.fill();

    const sprite = creatureSprite(species);
    const s = 78;
    g.imageSmoothingEnabled = false;
    if (paintSpritePortrait(g, species.id, size / 2, size / 2 - 2, s)) return true;
    g.drawImage(sprite.canvas, size / 2 - s / 2, size - s + (s * sprite.originY) / sprite.canvas.height, s, s);
    return false;
  }

  drawMinimap(run) {
    const g = this.mapCtx;
    const size = 220;
    const c = size / 2;
    const r = size / 2 - 4;
    const half = run.biome.size / 2;
    const view = 70; // world units visible across the minimap

    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "rgba(20,18,38,0.88)";
    g.fillRect(0, 0, size, size);

    const scale = r / view;
    const px = run.player.x;
    const pz = run.player.z;

    // Enemies
    for (const e of run.enemies) {
      if (!e.alive) continue;
      const dx = (e.x - px) * scale;
      const dz = (e.z - pz) * scale;
      if (dx * dx + dz * dz > r * r) continue;
      const col = e.tier === "elite" ? "#60a5fa" : e.tier === "alpha" ? "#ff5a4a" : e.tier === "boss" ? "#ffd166" : "#e05a5a";
      g.fillStyle = col;
      g.fillRect(c + dx - 1.5, c + dz - 1.5, 3, 3);
    }

    // Pickups
    for (const pk of run.pickups) {
      const dx = (pk.x - px) * scale;
      const dz = (pk.z - pz) * scale;
      if (dx * dx + dz * dz > r * r) continue;
      g.fillStyle = pk.kind === "xp" ? "#60a5fa" : pk.kind === "candy" ? "#ff7ad9" : "#ffd166";
      g.fillRect(c + dx - 1, c + dz - 1, 2, 2);
    }

    // Player
    g.fillStyle = "#7dd3fc";
    g.beginPath();
    g.arc(c, c, 3.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(125,211,252,0.6)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(c, c);
    g.lineTo(c + run.player.facingX * 12, c + run.player.facingZ * 12);
    g.stroke();
    g.restore();

    // Ring
    g.strokeStyle = "rgba(200,190,255,0.45)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.stroke();
  }
}
