// Colour palettes for the renderer.

import { PACK, packRgb } from "../content/pack.js";

/** Type colours as [r, g, b], from the content pack. */
export const TYPE_RGB = Object.fromEntries(Object.entries(PACK.types).map(([k, t]) => [k, packRgb(t.color)]));

/** Fallback body colour keyed by the species' `color` field upstream. */
export const COLOR_RGB = {
  black: [60, 60, 68],
  blue: [70, 130, 230],
  brown: [150, 100, 60],
  gray: [140, 140, 150],
  green: [80, 190, 90],
  pink: [255, 150, 190],
  purple: [170, 100, 220],
  red: [230, 80, 70],
  white: [245, 245, 250],
  yellow: [245, 210, 70],
};

export const BIOME_PALETTES = {
  forest: { ground: [96, 168, 74], groundAlt: [84, 152, 66], path: [196, 168, 118], cliff: [122, 104, 86], fog: [104, 92, 130], sky: [126, 176, 214] },
  desert: { ground: [214, 184, 116], groundAlt: [198, 166, 100], path: [226, 200, 140], cliff: [160, 128, 88], fog: [206, 168, 118], sky: [226, 178, 120] },
  coast: { ground: [226, 214, 168], groundAlt: [210, 198, 152], path: [236, 226, 186], cliff: [150, 140, 118], fog: [150, 190, 214], sky: [140, 196, 226] },
  glacier: { ground: [214, 230, 244], groundAlt: [192, 212, 232], path: [232, 242, 250], cliff: [148, 168, 190], fog: [186, 212, 236], sky: [186, 214, 240] },
  graveyard: { ground: [74, 68, 92], groundAlt: [62, 58, 80], path: [104, 98, 122], cliff: [70, 64, 86], fog: [46, 40, 66], sky: [42, 34, 62] },
  volcano: { ground: [86, 60, 54], groundAlt: [74, 52, 48], path: [120, 80, 62], cliff: [66, 48, 44], fog: [120, 62, 48], sky: [70, 40, 40] },
};

export const UI = {
  hp: 0x4ade80,
  hpBack: 0x1f2937,
  xp: 0x60a5fa,
  gold: 0xffd166,
  dust: 0xc084fc,
  danger: 0xef4444,
  shield: 0x93c5fd,
  panel: 0x1a1630,
  panelEdge: 0x3b2f63,
  text: 0xf4f1ff,
  muted: 0xa79fc4,
};

export const hex = (rgb, a = 1) =>
  `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

export const mixRgb = (a, b, t) => [
  Math.round(lerpN(a[0], b[0], t)),
  Math.round(lerpN(a[1], b[1], t)),
  Math.round(lerpN(a[2], b[2], t)),
];

const lerpN = (a, b, t) => a + (b - a) * t;

export const shade = (rgb, amount) =>
  amount >= 0 ? mixRgb(rgb, [255, 255, 255], amount) : mixRgb(rgb, [0, 0, 0], -amount);
