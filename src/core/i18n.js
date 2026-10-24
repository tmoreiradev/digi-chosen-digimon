import { getLang } from "./lang.js";

const en = () => getLang() === "en";
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// pt-BR labels for the data-driven strings (the extracted tables carry Spanish archetype labels
// and English biome, vitamin and tower names) and for shared UI words. Species, moves, items,
// roles and ultimate names stay as the data has them (they are proper names).

export const TYPE_PT = {
  normal: "Normal",
  fighting: "Lutador",
  flying: "Voador",
  poison: "Veneno",
  ground: "Terra",
  rock: "Pedra",
  bug: "Inseto",
  ghost: "Fantasma",
  steel: "Aço",
  fire: "Fogo",
  water: "Água",
  grass: "Planta",
  electric: "Elétrico",
  psychic: "Psíquico",
  ice: "Gelo",
  dragon: "Dragão",
  dark: "Sombrio",
  fairy: "Fada",
};
export const typeName = (t) => (en() ? cap(t) : TYPE_PT[t] ?? t);

export const ARCH_PT = {
  bolt: "Projétil",
  orb: "Esfera explosiva",
  lob: "Bomba",
  barrage: "Rajada",
  homing: "Teleguiado",
  beam: "Raio",
  cone: "Cone",
  nova: "Onda expansiva",
  aura: "Aura",
  orbit: "Órbita",
  strike: "Golpe",
  dash: "Investida",
  chain: "Cadeia",
  smite: "Impacto celeste",
  meteor: "Meteoro",
  boomerang: "Bumerangue",
  trap: "Armadilha",
  vortex: "Vórtice",
  wave: "Onda",
  trail: "Rastro",
  drain: "Dreno",
  spin: "Giro",
  weather: "Clima",
  buff: "Fortalecimento",
  random: "Aleatório",
  fusion: "Fusão",
};
const ARCH_EN = {
  bolt: "Bolt", orb: "Explosive orb", lob: "Bomb", barrage: "Barrage", homing: "Homing", beam: "Beam", cone: "Cone",
  nova: "Nova", aura: "Aura", orbit: "Orbit", strike: "Strike", dash: "Dash", chain: "Chain", smite: "Smite",
  meteor: "Meteor", boomerang: "Boomerang", trap: "Trap", vortex: "Vortex", wave: "Wave", trail: "Trail",
  drain: "Drain", spin: "Spin", weather: "Weather", buff: "Buff", random: "Random", fusion: "Fusion",
};
export const archLabel = (arch, rules) =>
  (en() ? ARCH_EN[arch] : ARCH_PT[arch]) ?? rules?.archetypes?.[arch]?.label ?? arch;

export const BIOME_PT = {
  forest: { name: "Floresta Verde", desc: "Uma floresta frondosa cheia de vida — e de Pokémon que preferem ficar com ela só para si." },
  desert: { name: "Deserto Rochoso", desc: "Areia escaldante, cânions de pedra e tempestades que cegam." },
  coast: { name: "Costa das Tempestades", desc: "Praias, recifes e tempestades elétricas sobre o mar. Cuidado com a maré." },
  glacier: { name: "Geleira Celestial", desc: "Gelo eterno sob auroras. Os lagos congelados escorregam e o frio morde até os seus ataques." },
  graveyard: { name: "Torre Lavanda", desc: "Névoa, lápides e sussurros. Os fantasmas daqui nunca descansam." },
  volcano: { name: "Ilha do Vulcão", desc: "Rios de lava e cinzas. Só os mais fortes sobrevivem ao calor." },
};
// English: the data's own name and description.
export const biomeName = (b) => (en() ? b?.name : BIOME_PT[b?.id]?.name ?? b?.name) ?? "";
export const biomeDesc = (b) => (en() ? b?.desc : BIOME_PT[b?.id]?.desc ?? b?.desc) ?? "";

export const MODE_PT = { classic: "Clássico", endless: "Infinito", tower: "Torre" };

export const RARITY_PT = ["Comum", "Incomum", "Raro", "Épico", "Lendário"];
export const RANK_PT = { common: "Comum", uncommon: "Incomum", rare: "Raro", epic: "Épico", legendary: "Lendário" };
export const rankName = (rank) => (en() ? cap(rank) : RANK_PT[rank] ?? rank);

export const VITAMIN_DESC_PT = {
  protein: "Dano físico",
  calcium: "Dano especial",
  iron: "Armadura",
  zinc: "Escudo regenerativo",
  carbos: "Velocidade de movimento",
  "hp-up": "HP máximo",
  "pp-up": "Projéteis",
  ether: "Velocidade de ataque",
  "dire-hit": "Chance de crítico",
  "x-speed": "Velocidade dos projéteis",
  "x-defense": "Evasão",
  "x-attack": "Chance de status",
  stardust: "Área de efeito",
  elixir: "Duração",
  "super-potion": "Regeneração de HP",
  nugget: "Moedas",
  "exp-candy": "Experiência",
  "star-piece": "Sorte",
  "max-potion": "Roubo de vida",
  "escape-rope": "Alcance de coleta",
  "sticky-barb": "Espinhos",
  "enigma-berry": "Sobrecura",
  "super-lure": "Aparição de elites",
  "poke-radar": "Power-ups",
  "loaded-dice": "Um atributo aleatório",
};
export const vitaminDesc = (def) => (en() ? def.desc : VITAMIN_DESC_PT[def.key] ?? def.desc);

export const TOWER_FLOOR_PT = {
  Vestibule: "Vestíbulo",
  "Hall of Headstones": "Salão das Lápides",
  "Mist Room": "Sala da Névoa",
  "Candles Out": "Velas Apagadas",
  "Purified Zone": "Zona Purificada",
  "Marowak's Shadow": "Sombra de Marowak",
  "The Summit": "O Cume",
};
export const towerFloorName = (name) => (en() ? name : TOWER_FLOOR_PT[name] ?? name);

export const THREAT_PT = ["CALMO", "INQUIETO", "ALERTA", "PERIGO", "CERCADO"];

// Held items: items.json carries the games' flavour text; these describe what THIS engine does
// (run.js: Leftovers regen, Choice Band damage multiplier).
export const HELD_ITEM_DESC_PT = {
  leftovers: "Recupera cerca de 1/16 do HP máximo por segundo.",
  "choice-band": "+50% de dano em todos os golpes.",
  "life-orb": "+30% de dano; cada golpe lançado custa 2% do HP máximo.",
  "scope-lens": "+10% de chance de crítico.",
  "muscle-band": "+15% de dano físico.",
  "wise-glasses": "+15% de dano especial.",
  "expert-belt": "+25% de dano super-efetivo.",
  "quick-claw": "+10% de velocidade de ataque.",
  "bright-powder": "+8% de evasão.",
  "rocky-helmet": "Quem te acerta leva 20 de dano.",
  "big-root": "+30% de cura recebida.",
  "lucky-egg": "+30% de experiência.",
  "amulet-coin": "+50% de moedas.",
};
const HELD_ITEM_DESC_EN = {
  leftovers: "Restores about 1/16 of max HP per second.",
  "choice-band": "+50% damage on every move.",
  "life-orb": "+30% damage; each move cast costs 2% of max HP.",
  "scope-lens": "+10% crit chance.",
  "muscle-band": "+15% physical damage.",
  "wise-glasses": "+15% special damage.",
  "expert-belt": "+25% super-effective damage.",
  "quick-claw": "+10% attack speed.",
  "bright-powder": "+8% evasion.",
  "rocky-helmet": "Whoever hits you takes 20 damage.",
  "big-root": "+30% healing received.",
  "lucky-egg": "+30% experience.",
  "amulet-coin": "+50% coins.",
};
export const heldItemDesc = (key, def) => (en() ? HELD_ITEM_DESC_EN : HELD_ITEM_DESC_PT)[key] ?? def?.desc ?? "";

// Scripted upgrades (src/game/scripted.js): rules.json carries the upstream Spanish text; these
// describe what THIS engine does. An item without an entry falls back to the data description.
export const ITEM_DESC_PT = {
  "grip-claw": "Cada acerto tem 4% de chance de enraizar o inimigo por 2 s.",
  "berry-juice": "Cada abate tem 5% de chance de curar 2% do HP máximo.",
  "shell-bell": "Recupera 0,8% do dano que você causa.",
  metronome: "+2% de dano por segundo sem levar golpe (até +40%).",
  "binding-band": "+20% de dano em inimigos paralisados, enraizados, congelados, dormindo ou recuando.",
  awakening: "Cada acerto tem 2,5% de chance de adormecer o inimigo por 3 s.",
  lemonade: "Seus aliados causam 25% mais dano e atacam 15% mais rápido.",
  "poke-doll": "As passivas dos seus aliados valem 50% mais.",
  stick: "3% de chance de um acerto causar ×8 de dano: Bonk!",
  "razor-fang": "Elimina na hora inimigos comuns abaixo de 8% de HP (+4% por cópia). Alfas e bosses não.",
  "focus-band": "15% de chance de sobreviver a um golpe letal com 1 HP (uma vez a cada 20 s).",
  "full-heal": "+6% de dano por status diferente no inimigo (até +30%).",
  "guard-spec": "A cada 14 s, bloqueia o próximo golpe por completo.",
  "gold-teeth": "A loja cobra 8% menos (até −24%).",
  "focus-sash": "Sobrevive a um golpe letal uma vez por zona.",
  revive: "Revive uma vez com 35% do HP.",
  "reaper-cloth": "+1% de dano a cada 100 abates na partida (até +30%).",
  "thick-club": "Dano físico +1% a cada 2 de armadura (até +50%).",
  "fire-stone": "Inimigos queimados explodem ao morrer (40% do HP deles, em 3 u).",
  "leaf-stone": "Cada abate tem 10% de chance de soltar um redemoinho de folhas que corta os inimigos próximos e cura 1% do HP.",
  "ss-ticket": "+1 vaga para aliados nesta partida.",
  "max-revive": "Revive uma vez com 60% do HP.",
  "soda-pop": "O dash solta uma onda de bolhas que fere os inimigos em volta.",
  "adrenaline-orb": "Ao levar um golpe: +20% de velocidade e +12% de velocidade de ataque por 3 s.",
  "metal-powder": "Parado por meio segundo: +30% de armadura e +8% de velocidade de ataque até se mover.",
  "ice-heal": "Acertar um inimigo congelado quebra o gelo: +60% de dano e estilhaços que paralisam os vizinhos.",
  "old-rod": "A cada 9 s um Magikarp salta sobre um inimigo. Às vezes vem um Gyarados…",
  eviolite: "Enquanto ainda puder evoluir: +50% de armadura e +25% de HP máximo.",
  "shed-shell": "Dash com invulnerabilidade mais longa e recarga 10% mais rápida.",
  "cell-battery": "+1,5% de velocidade de ataque a cada 10 abates sem levar golpe (até +25%).",
  "griseous-orb": "Cada abate tem 12% de chance de soltar uma sombra que explode e amaldiçoa os vizinhos.",
  electirizer: "A cada 2,5 s um raio cai em 3 inimigos próximos e pode paralisá-los (+1 raio por cópia).",
  "silph-scope": "A cada 6 s marca o inimigo mais forte por perto (+1 por cópia): ele leva 40% mais dano de tudo. Se cair, marca outro.",
  "max-ether": "Suas vitaminas podem subir mais 2 níveis (até o 12).",
  "tm-case": "Seus golpes podem subir mais 2 níveis (até o 10).",
  "poke-flute": "O ultimate carrega 25% mais rápido; ao usá-lo, todos os golpes recarregam e a velocidade de ataque sobe 30% por 6 s.",
  "secret-key": "Altares Antigos recarregam em vez de sumir depois de curar (45 s; 30% mais rápido por cópia extra).",
  "dowsing-machine": "A partir da próxima zona ou andar, cada um traz 1 altar e 2 baús a mais por perto (por cópia).",
};
export const ITEM_DESC_EN = {
  "grip-claw": "Each hit has a 4% chance to root the enemy for 2 s.",
  "berry-juice": "Each kill has a 5% chance to heal 2% of max HP.",
  "shell-bell": "Recover 0.8% of the damage you deal.",
  metronome: "+2% damage per second without being hit (up to +40%).",
  "binding-band": "+20% damage to paralysed, rooted, frozen, sleeping or flinching enemies.",
  awakening: "Each hit has a 2.5% chance to put the enemy to sleep for 3 s.",
  lemonade: "Your allies deal 25% more damage and attack 15% faster.",
  "poke-doll": "Your allies' passives are worth 50% more.",
  stick: "3% chance for a hit to deal x8 damage: Bonk!",
  "razor-fang": "Instantly finishes common enemies below 8% HP (+4% per copy). Not alphas or bosses.",
  "focus-band": "15% chance to survive a lethal hit with 1 HP (once every 20 s).",
  "full-heal": "+6% damage per different status on the enemy (up to +30%).",
  "guard-spec": "Every 14 s, fully blocks the next hit.",
  "gold-teeth": "The shop charges 8% less (down to -24%).",
  "focus-sash": "Survive a lethal hit once per zone.",
  revive: "Revive once with 35% HP.",
  "reaper-cloth": "+1% damage per 100 kills this run (up to +30%).",
  "thick-club": "Physical damage +1% per 2 armour (up to +50%).",
  "fire-stone": "Burned enemies explode on death (40% of their HP, 3 u).",
  "leaf-stone": "Each kill has a 10% chance to release a leaf whirl that cuts nearby enemies and heals 1% HP.",
  "ss-ticket": "+1 ally slot this run.",
  "max-revive": "Revive once with 60% HP.",
  "soda-pop": "Your dash bursts a bubble wave that hurts nearby enemies.",
  "adrenaline-orb": "When hit: +20% speed and +12% attack speed for 3 s.",
  "metal-powder": "Standing still for half a second: +30% armour and +8% attack speed until you move.",
  "ice-heal": "Hitting a frozen enemy shatters the ice: +60% damage and shards that paralyse its neighbours.",
  "old-rod": "Every 9 s a Magikarp leaps at an enemy. Sometimes a Gyarados bites...",
  eviolite: "While you can still evolve: +50% armour and +25% max HP.",
  "shed-shell": "Dash with longer invulnerability and 10% faster recharge.",
  "cell-battery": "+1.5% attack speed per 10 kills without being hit (up to +25%).",
  "griseous-orb": "Each kill has a 12% chance to leave a shadow that bursts and curses its neighbours.",
  electirizer: "Every 2.5 s lightning strikes 3 nearby enemies and may paralyse them (+1 bolt per copy).",
  "silph-scope": "Every 6 s marks the strongest nearby enemy (+1 per copy): it takes 40% more damage from everything. If it falls, another is marked.",
  "max-ether": "Your vitamins can go 2 levels higher (up to 12).",
  "tm-case": "Your moves can go 2 levels higher (up to 10).",
  "poke-flute": "Your ultimate charges 25% faster; using it recharges every move and gives +30% attack speed for 6 s.",
  "secret-key": "Ancient Altars recharge instead of crumbling after a heal (45 s; 30% faster per extra copy).",
  "dowsing-machine": "From the next zone or floor on, each one brings 1 altar and 2 chests nearby (per copy).",
};
export const itemDesc = (key, def) => (en() ? ITEM_DESC_EN : ITEM_DESC_PT)[key] ?? def?.desc ?? "";
