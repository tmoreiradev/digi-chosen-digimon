// Zone map (M): the whole arena with the world events discovered so far (the guardian altar
// always), the boss and the player. Clicking an icon follows it: a compass at the screen edge
// (Renderer.drawCompass) points to it with its distance. The game stays paused while it is open.

import { el, clear } from "./dom.js";
import { MAP_KINDS } from "../game/events.js";

const MAP_PX = 360;
const PICK_PX = 14; // click tolerance around an icon

export class ZoneMap {
  constructor(root) {
    this.root = root;
    this.node = null;
    this.run = null;
    this.onClose = null;
  }

  get active() {
    return !!this.node;
  }

  /** Events the map shows: discovered (or the guardian altar) and still standing. */
  shown(run) {
    return run.events.events.filter((ev) => ev.seen && !ev.interacted && MAP_KINDS[ev.kind]);
  }

  open(run, onClose) {
    if (this.node) return;
    this.run = run;
    this.onClose = onClose;
    this.canvas = el("canvas", { class: "zonemap-canvas", width: MAP_PX, height: MAP_PX });
    this.canvas.addEventListener("mousedown", (e) => {
      const r = this.canvas.getBoundingClientRect();
      const k = MAP_PX / (r.width || MAP_PX);
      this.click((e.clientX - r.left) * k, (e.clientY - r.top) * k);
    });
    this.legend = el("div", { class: "zonemap-legend" });
    const backdrop = el(
      "div",
      { class: "event-backdrop zonemap" },
      el(
        "div",
        { class: "event-panel zonemap-panel" },
        el("h2", {}, "Mapa da zona"),
        el("p", { class: "muted" }, "Para cima é o norte"),
        this.canvas,
        el("h3", {}, "Descoberto nesta zona"),
        this.legend,
        el("p", { class: "muted" }, "Você só vê o que já esteve por perto, menos o altar do guardião."),
        el("p", { class: "event-hint" }, "Clique num ícone para segui-lo (de novo para parar). M ou Esc fecha.")
      )
    );
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) this.close();
    });
    this.node = backdrop;
    this.root.append(backdrop);
    this.draw();
  }

  close() {
    if (!this.node) return;
    this.node.remove();
    this.node = null;
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }

  /** World (x, z) to map pixels: the arena fills the canvas, north (−z) up. */
  toMap(x, z) {
    const half = this.run.biome.size / 2;
    return { x: ((x + half) / (half * 2)) * MAP_PX, y: ((z + half) / (half * 2)) * MAP_PX };
  }

  /** Follow the icon under (px, py), or stop following it when it is already followed. */
  click(px, py) {
    const events = this.run.events;
    let best = null;
    let bestD = PICK_PX;
    for (const ev of this.shown(this.run)) {
      const m = this.toMap(ev.x, ev.z);
      const d = Math.hypot(m.x - px, m.y - py);
      if (d < bestD) {
        bestD = d;
        best = ev;
      }
    }
    if (!best) return null;
    events.followId = events.followId === best.id ? null : best.id;
    this.draw();
    return best;
  }

  draw() {
    const run = this.run;
    const g = this.canvas.getContext("2d");
    g.fillStyle = "#23402c";
    g.fillRect(0, 0, MAP_PX, MAP_PX);
    g.strokeStyle = "rgba(255,255,255,0.06)";
    g.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const v = (i / 8) * MAP_PX;
      g.beginPath();
      g.moveTo(v, 0);
      g.lineTo(v, MAP_PX);
      g.moveTo(0, v);
      g.lineTo(MAP_PX, v);
      g.stroke();
    }
    g.setLineDash([6, 5]);
    g.strokeStyle = "rgba(255,255,255,0.45)";
    g.strokeRect(4, 4, MAP_PX - 8, MAP_PX - 8);
    g.setLineDash([]);

    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "700 11px system-ui, sans-serif";
    const counts = {};
    for (const ev of this.shown(run)) {
      const kind = MAP_KINDS[ev.kind];
      counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
      const m = this.toMap(ev.x, ev.z);
      if (run.events.followId === ev.id) {
        g.strokeStyle = "#ffd23a";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(m.x, m.y, 12, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = kind.color;
      g.beginPath();
      g.arc(m.x, m.y, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.fillText(kind.glyph, m.x, m.y + 0.5);
    }

    const be = run.boss.alive ? run.boss.enemy : null;
    if (be) {
      const m = this.toMap(be.x, be.z);
      g.fillStyle = "#ffd166";
      g.beginPath();
      g.arc(m.x, m.y, 6, 0, Math.PI * 2);
      g.fill();
    }

    // The player: an arrow along the facing.
    const p = run.player;
    const m = this.toMap(p.x, p.z);
    const a = Math.atan2(p.facingZ, p.facingX);
    g.fillStyle = "#7dd3fc";
    g.beginPath();
    g.moveTo(m.x + Math.cos(a) * 9, m.y + Math.sin(a) * 9);
    g.lineTo(m.x + Math.cos(a + 2.5) * 7, m.y + Math.sin(a + 2.5) * 7);
    g.lineTo(m.x + Math.cos(a - 2.5) * 7, m.y + Math.sin(a - 2.5) * 7);
    g.closePath();
    g.fill();

    clear(this.legend);
    for (const [key, kind] of Object.entries(MAP_KINDS)) {
      if (!counts[key]) continue;
      this.legend.append(
        el("div", { class: "zonemap-row" }, el("i", { class: "zonemap-dot", style: { background: kind.color } }, kind.glyph), el("span", {}, kind.label), el("b", {}, `×${counts[key]}`))
      );
    }
  }
}
