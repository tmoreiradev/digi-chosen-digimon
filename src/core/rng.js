// Deterministic PRNG (mulberry32) so runs can be reproduced from a seed.

export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = {
    seed,
    next,
    /** Uniform float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Uniform integer in [min, max]. */
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** Weighted pick. `weightOf` must return a non-negative number. */
    weighted: (arr, weightOf) => {
      let total = 0;
      for (const item of arr) total += Math.max(0, weightOf(item));
      if (total <= 0) return arr.length ? arr[Math.floor(next() * arr.length)] : undefined;
      let roll = next() * total;
      for (const item of arr) {
        roll -= Math.max(0, weightOf(item));
        if (roll <= 0) return item;
      }
      return arr[arr.length - 1];
    },
  };
  return rng;
}

/** Stable 32-bit hash of a string, used to seed per-species art. */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
