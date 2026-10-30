// Touch controls: a floating joystick on the left half of the screen and action buttons on the
// right (jump, dash, ultimate, interact), plus pause and map. They write the same `input` object
// the keyboard does; analog movement goes in input.moveX / input.moveZ (Run.updatePlayer).
// Shown only in a run, and only once the device has a touch screen (or a first touch arrives).

import { el } from "./dom.js";

const STICK_RADIUS = 56; // joystick travel in CSS pixels
const STICK_DEAD = 0.18; // fraction of STICK_RADIUS ignored around the centre

export class TouchControls {
  /** `input`: main.js input object; `onPause`, `onMap`: the same actions as P and M. */
  constructor(input, { onPause, onMap }) {
    this.input = input;
    this.stickId = null;
    this.enabled = matchMedia?.("(pointer: coarse)").matches ?? false;
    this.root = el("div", { class: "touch" });
    this.knob = el("div", { class: "touch-knob" });
    this.base = el("div", { class: "touch-base" }, this.knob);
    this.zone = el("div", { class: "touch-zone" }, this.base);
    const btn = (cls, label, title, action) => {
      const b = el("button", { class: "touch-btn " + cls, title }, label);
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (!this.input[action]) this.input[action + "Pressed"] = true;
        this.input[action] = true;
      });
      for (const ev of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(ev, () => (this.input[action] = false));
      return b;
    };
    const tap = (cls, label, title, fn) => {
      const b = el("button", { class: "touch-btn " + cls, title }, label);
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        fn();
      });
      return b;
    };
    this.root.append(
      this.zone,
      el("div", { class: "touch-actions" },
        btn("t-ult", "★", "Ultimate", "ult"),
        btn("t-use", "E", "Interagir", "capture"),
        btn("t-dash", "»", "Dash", "dash"),
        btn("t-jump", "⤒", "Pulo", "jump")
      ),
      el("div", { class: "touch-top" }, tap("t-map", "🗺", "Mapa da zona", onMap), tap("t-pause", "❚❚", "Pausar", onPause))
    );
    this.zone.addEventListener("pointerdown", (e) => this.start(e));
    this.zone.addEventListener("pointermove", (e) => this.move(e));
    for (const ev of ["pointerup", "pointercancel"]) this.zone.addEventListener(ev, (e) => this.end(e));
    // A first touch anywhere turns the controls on (a laptop with a touch screen reports a fine pointer).
    window.addEventListener("touchstart", () => (this.enabled = true), { once: true, passive: true });
    document.body.append(this.root);
    this.show(false);
  }

  /** main.js calls this every frame: visible only while a run is on screen. */
  show(inRun) {
    const on = inRun && this.enabled;
    this.root.classList.toggle("on", on);
    if (!on && this.stickId !== null) this.release();
  }

  start(e) {
    if (this.stickId !== null) return;
    e.preventDefault();
    this.stickId = e.pointerId;
    try {
      this.zone.setPointerCapture(e.pointerId); // keep the stick when the finger slides off the left half
    } catch {
      // the pointer is already gone (lifted in the same frame): the stick still works without capture
    }
    this.ox = e.clientX;
    this.oy = e.clientY;
    this.base.style.left = `${e.clientX}px`;
    this.base.style.top = `${e.clientY}px`;
    this.base.classList.add("on");
    this.move(e);
  }

  move(e) {
    if (e.pointerId !== this.stickId) return;
    e.preventDefault();
    const [x, z] = stickVector(e.clientX - this.ox, e.clientY - this.oy);
    this.input.moveX = x;
    this.input.moveZ = z;
    this.knob.style.transform = `translate(${x * STICK_RADIUS}px, ${z * STICK_RADIUS}px)`;
  }

  end(e) {
    if (e.pointerId === this.stickId) this.release();
  }

  release() {
    this.stickId = null;
    this.input.moveX = 0;
    this.input.moveZ = 0;
    this.knob.style.transform = "";
    this.base.classList.remove("on");
  }
}

/** Finger offset (px) → joystick vector, length 0..1, with a dead zone around the centre. */
export function stickVector(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < STICK_RADIUS * STICK_DEAD) return [0, 0];
  const k = Math.min(1, len / STICK_RADIUS) / len;
  return [dx * k, dy * k];
}
