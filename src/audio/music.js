// Procedural background music: no asset files, everything is synthesized.
// A short, looping 8-bit style tune with separate melody / bass / drum channels.
// Themes shift slightly by biome and by combat state (calm vs battle).
//
// It reuses the Sfx AudioContext so there is a single audio context for the app.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// C major pentatonic-ish melody fragments per biome.
const THEMES = {
  forest: { root: 60, scale: [0, 2, 4, 7, 9, 12], bpm: 110 },
  desert: { root: 55, scale: [0, 3, 5, 7, 10, 12], bpm: 100 },
  coast: { root: 62, scale: [0, 2, 4, 7, 9, 12], bpm: 120 },
  glacier: { root: 57, scale: [0, 2, 5, 7, 9, 12], bpm: 85 },
  graveyard: { root: 52, scale: [0, 3, 5, 8, 10, 12], bpm: 70 },
  volcano: { root: 64, scale: [0, 2, 4, 7, 9, 12], bpm: 130 },
};

const DRUM_PATTERN = [1, 0, 0, 0, 1, 0, 1, 0]; // kick on 1, snare-ish on 5

export class Music {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.theme = "forest";
    this.battle = false;
    this.tick = 0;
    this.interval = null;
    this.volume = 0.18;
    this.muted = false;
    this.started = false;
    this._deferredStart = false;
  }

  ensure(ctx) {
    this.ctx = ctx;
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (this._deferredStart && !this.started) {
      this._deferredStart = false;
      this.start();
    }
  }

  setTheme(theme, battle) {
    if (this.theme === theme && this.battle === battle) return;
    this.theme = theme;
    this.battle = battle;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  mute(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  start() {
    if (this.started) return;
    if (!this.ctx) {
      this._deferredStart = true;
      return;
    }
    this.started = true;
    this.tick = 0;
    const stepMs = (60 / THEMES[this.theme].bpm) / 2; // 8th notes
    this.interval = setInterval(() => this.tickStep(), stepMs);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    // Release any sounding voices
    for (const v of this.voices) v.stop();
    this.voices = [];
  }

  // ---- voice management -------------------------------------------------

  voices = [];

  stopVoice(v) {
    try { v.stop(); } catch {}
  }

  playNote(freq, dur, type = "square", gain, when = this.ctx.currentTime) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    this.voices.push(osc);
    setTimeout(() => {
      const i = this.voices.indexOf(osc);
      if (i >= 0) this.voices.splice(i, 1);
    }, (dur + 0.05) * 1000);
  }

  playDrum(kind, when = this.ctx.currentTime) {
    if (!this.ctx || this.muted) return;
    if (kind === "kick") {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(40, when + 0.12);
      g.gain.setValueAtTime(0.35, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
      osc.connect(g);
      g.connect(this.master);
      osc.start(when);
      osc.stop(when + 0.14);
    } else if (kind === "snare") {
      const len = Math.floor(this.ctx.sampleRate * 0.08);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2000;
      const g = this.ctx.createGain();
      g.gain.value = 0.18;
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(when);
    }
  }

  // ---- sequencer --------------------------------------------------------

  tickStep() {
    if (!this.ctx || this.muted) return;
    const theme = THEMES[this.theme];
    const stepDur = 0.22; // each 8th note lasts ~0.22s
    const beat = this.tick % 8;
    const when = this.ctx.currentTime + 0.03; // small lookahead

    // Drums
    if (DRUM_PATTERN[beat]) this.playDrum("kick", when);
    if (beat === 4 || (this.battle && beat === 6)) this.playDrum("snare", when);
    if (beat % 2 === 0 && !this.battle) this.playDrum("snare", when + 0.05);

    // Bass: root and fifth on beats 1 and 5
    if (beat === 0 || beat === 4) {
      const root = NOTE(theme.root + (beat === 4 ? 7 : 0));
      this.playNote(root, stepDur * 0.9, "triangle", 0.10, when);
    }

    // Melody: simple walk up/down the scale
    if (beat % 2 === 0) {
      const idx = Math.floor((this.tick / 2) % theme.scale.length);
      const offset = this.battle ? 4 : 0; // battle theme sits higher
      const freq = NOTE(theme.root + offset + theme.scale[idx]);
      this.playNote(freq, stepDur * 0.85, "square", 0.07, when);
    }

    // Arpeggio fill on battle
    if (this.battle && beat === 2) {
      const arp = [0, 4, 7, 12];
      arp.forEach((o, i) => {
        setTimeout(() => this.playNote(NOTE(theme.root + o + 12), 0.12, "triangle", 0.05), i * 40);
      });
    }

    this.tick++;
  }
}
