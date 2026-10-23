// Move fusion: Bill's Machine merges two of your moves into a stronger,
// dual-type one. The upstream ships ~100 hand-authored fusion moves tied to
// league members; this port recreates the mechanic generically: any two owned
// moves at a high enough level can fuse, keeping the first move's shape and
// picking the better type effectiveness of the two.

const NAME_PAIRS = [
  [0, -1], // first word of A + last word of B
];

/** True when two moves can be fused. */
export function canFuse(run) {
  const p = run.player;
  const eligible = p.moves.filter((m) => m.level >= 3 && !m.def.fusion);
  return eligible.length >= 2 && p.moves.length >= 2;
}

/** Build the fusion candidates offered on level-up. */
export function fusionChoices(run) {
  if (!canFuse(run)) return [];
  const p = run.player;
  const eligible = p.moves.filter((m) => m.level >= 3 && !m.def.fusion);
  const out = [];
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i];
      const b = eligible[j];
      if (a.def.type === b.def.type && a.def.cls === b.def.cls) continue;
      out.push({
        kind: "fusion",
        slots: [p.moves.indexOf(a), p.moves.indexOf(b)],
        title: fusionName(a.def, b.def),
        sub: "Fusion — merges two moves",
        lines: [
          `${a.def.name} + ${b.def.name}`,
          `dual-type ${a.def.type} / ${b.def.type}`,
        ],
        icon: "move",
        type: a.def.type,
        rarity: 3,
        weight: 0.55,
      });
      if (out.length >= 4) return out;
    }
  }
  return out;
}

/** Combine the two names into a fusion name. */
export function fusionName(defA, defB) {
  const wordsA = defA.name.split(" ");
  const wordsB = defB.name.split(" ");
  const first = wordsA[0];
  const last = wordsB[wordsB.length - 1];
  const name = `${first}${last ? " " + last : ""}`;
  return name.length > 2 ? name : `${defA.name} × ${defB.name}`;
}

/**
 * Merge two equipped moves into a fusion move definition.
 * The fusion keeps move A's archetype, uses A's type plus B's as a secondary,
 * and combines the numeric stats.
 */
export function buildFusionDef(a, b) {
  const da = a.def;
  const db = b.def;
  const def = {
    id: -1,
    key: `fu-${da.key}-${db.key}`,
    name: fusionName(da, db),
    type: da.type,
    type2: db.type !== da.type ? db.type : undefined,
    cls: da.cls,
    arch: da.arch,
    fusion: true,
    parents: [da.id, db.id],
    dmg: (da.dmg + db.dmg) * 0.8,
    cd: Math.min(da.cd, db.cd) * 1.15,
    count: Math.max(da.count, db.count),
    area: (da.area + db.area) / 2,
    speed: Math.max(da.speed, db.speed),
    dur: Math.max(da.dur, db.dur),
    pierce: Math.max(da.pierce, db.pierce),
    status: da.status ?? db.status ?? null,
    statusChance: Math.max(da.statusChance ?? 0, db.statusChance ?? 0),
    drain: da.drain || db.drain || 0,
    critBonus: da.critBonus || db.critBonus || 0,
    flinch: da.flinch || db.flinch || 0,
    power: Math.round((da.power + db.power) / 2),
    weather: undefined,
    buff: undefined,
    desc: `Fused from ${da.name} and ${db.name}. Hits use the better of ${da.type}/${db.type} and ${db.type}.`,
  };
  return def;
}

/** Apply a fusion choice: removes both parents, adds the fusion. */
export function applyFusion(run, choice) {
  const p = run.player;
  const a = p.moves[choice.slots[0]];
  const b = p.moves[choice.slots[1]];
  if (!a || !b) return;
  const def = buildFusionDef(a, b);
  const level = Math.max(1, Math.round((a.level + b.level) / 2) - 1);
  // Remove both parents (highest index first).
  const hi = Math.max(...choice.slots);
  const lo = Math.min(...choice.slots);
  p.moves.splice(hi, 1);
  p.moves.splice(lo, 1);
  p.moves.push({
    def,
    level,
    timer: 0.3,
    mods: { dmg: 1.15, cd: 1, count: 0, area: 1, speed: 1, dur: 1, pierce: 0, crit: 0, status: 1, bounce: 0 },
  });
  run.banner(`${def.name}! Two moves became one`);
}
