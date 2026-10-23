// Minimal WebAudio synth: no asset files, everything is generated.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.volume = 0.5;
    this.last = new Map();
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  /** Rate-limit a sound so rapid events don't stack into noise. */
  throttle(key, ms) {
    const now = performance.now();
    const prev = this.last.get(key) ?? 0;
    if (now - prev < ms) return false;
    this.last.set(key, now);
    return true;
  }

  tone(freq, dur, type = "square", gain = 0.18, slideTo = null) {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  noise(dur = 0.12, gain = 0.14, filter = 900) {
    const ctx = this.ensure();
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start();
  }

  hit() {
    if (!this.throttle("hit", 55)) return;
    this.noise(0.07, 0.09, 1400);
  }
  shoot() {
    if (!this.throttle("shoot", 70)) return;
    this.tone(520, 0.07, "square", 0.05, 300);
  }
  pickup() {
    if (!this.throttle("pickup", 60)) return;
    this.tone(880, 0.08, "triangle", 0.07, 1320);
  }
  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, "triangle", 0.12), i * 70));
  }
  hurt() {
    if (!this.throttle("hurt", 180)) return;
    this.tone(180, 0.2, "sawtooth", 0.12, 70);
  }
  ultimate() {
    [330, 494, 659, 988].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, "sawtooth", 0.1, f * 1.5), i * 60));
    this.noise(0.5, 0.1, 400);
  }
  death() {
    [440, 349, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, "triangle", 0.12), i * 130));
  }
  evolve() {
    [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, "square", 0.09), i * 80));
  }
}
