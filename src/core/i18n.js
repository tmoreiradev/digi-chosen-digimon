import { getLang } from "./lang.js";
import { PACK } from "../content/pack.js";

const en = () => getLang() === "en";
const es = () => getLang() === "es";
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** The table for the active language: pt-BR, English or Spanish. */
const pick = (pt, enT, esT) => (es() ? esT : en() ? enT : pt);

// pt-BR labels for the data-driven strings (the extracted tables carry Spanish archetype labels
// and English biome, vitamin and tower names) and for shared UI words. Species, moves, items,
// roles and ultimate names stay as the data has them (they are proper names).

// Type names come from the content pack (English defaults to the capitalised key).
export const TYPE_PT = Object.fromEntries(Object.entries(PACK.types).map(([k, t]) => [k, t.pt]));
export const typeName = (t) => {
  const def = PACK.types[t];
  if (!def) return t;
  return es() ? def.es ?? def.pt : en() ? def.en ?? cap(t) : def.pt;
};

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
const ARCH_ES = {
  bolt: "Proyectil", orb: "Esfera explosiva", lob: "Bomba", barrage: "Ráfaga", homing: "Teledirigido", beam: "Rayo",
  cone: "Cono", nova: "Onda expansiva", aura: "Aura", orbit: "Órbita", strike: "Golpe", dash: "Embestida", chain: "Cadena",
  smite: "Impacto celeste", meteor: "Meteoro", boomerang: "Bumerán", trap: "Trampa", vortex: "Vórtice", wave: "Ola",
  trail: "Estela", drain: "Drenaje", spin: "Giro", weather: "Clima", buff: "Potenciador", random: "Aleatorio", fusion: "Fusión",
};
export const archLabel = (arch, rules) => pick(ARCH_PT, ARCH_EN, ARCH_ES)[arch] ?? rules?.archetypes?.[arch]?.label ?? arch;

export const BIOME_PT = {
  forest: { name: "Ilha File", desc: "A ilha onde as Crianças Escolhidas chegaram — e onde as Engrenagens Negras deixaram os Digimon selvagens." },
  desert: { name: "Deserto Rochoso", desc: "Areia escaldante, cânions de pedra e tempestades que cegam." },
  coast: { name: "Costa das Tempestades", desc: "Praias, recifes e tempestades elétricas sobre o mar. Cuidado com a maré." },
  glacier: { name: "Geleira Celestial", desc: "Gelo eterno sob auroras. Os lagos congelados escorregam e o frio morde até os seus ataques." },
  graveyard: { name: "Torre Lavanda", desc: "Névoa, lápides e sussurros. Os fantasmas daqui nunca descansam." },
  volcano: { name: "Ilha do Vulcão", desc: "Rios de lava e cinzas. Só os mais fortes sobrevivem ao calor." },
};
// English: the data's own name and description.
const BIOME_ES = {
  forest: { name: "Isla File", desc: "La isla donde llegaron los Niños Elegidos — y donde los Engranajes Negros volvieron salvajes a sus Digimon." },
  desert: { name: "Desierto Rocoso", desc: "Arena abrasadora, cañones de roca y tormentas cegadoras." },
  coast: { name: "Costa Tormentosa", desc: "Playas, arrecifes y tormentas eléctricas sobre el mar. Cuidado con la marea." },
  glacier: { name: "Glaciar Celeste", desc: "Hielo eterno bajo auroras. Los lagos helados resbalan y el frío muerde hasta tus ataques." },
  graveyard: { name: "Torre Lavanda", desc: "Niebla, lápidas y susurros. Aquí los fantasmas nunca descansan." },
  volcano: { name: "Isla Volcán", desc: "Ríos de lava y ceniza. Solo los más fuertes sobreviven al calor." },
};
// A content pack's region may carry its own pt/es text (`biome.pt`, `biome.es`); the tables above are the fallback.
export const biomeName = (b) => (en() ? b?.name : pick(b?.pt, null, b?.es)?.name ?? pick(BIOME_PT, null, BIOME_ES)[b?.id]?.name ?? b?.name) ?? "";
export const biomeDesc = (b) => (en() ? b?.desc : pick(b?.pt, null, b?.es)?.desc ?? pick(BIOME_PT, null, BIOME_ES)[b?.id]?.desc ?? b?.desc) ?? "";

export const MODE_PT = { classic: "Clássico", endless: "Infinito", tower: "Torre" };

export const RARITY_PT = ["Comum", "Incomum", "Raro", "Épico", "Lendário"];
export const RANK_PT = { common: "Comum", uncommon: "Incomum", rare: "Raro", epic: "Épico", legendary: "Lendário" };
const RANK_ES = { common: "Común", uncommon: "Poco común", rare: "Raro", epic: "Épico", legendary: "Legendario" };
export const rankName = (rank) => (en() ? cap(rank) : pick(RANK_PT, null, RANK_ES)[rank] ?? rank);

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
const VITAMIN_DESC_ES = {
  protein: "Daño físico", calcium: "Daño especial", iron: "Armadura", zinc: "Escudo regenerativo", carbos: "Velocidad de movimiento",
  "hp-up": "PS máximos", "pp-up": "Proyectiles", ether: "Velocidad de ataque", "dire-hit": "Probabilidad de crítico",
  "x-speed": "Velocidad de los proyectiles", "x-defense": "Evasión", "x-attack": "Probabilidad de estado", stardust: "Área de efecto",
  elixir: "Duración", "super-potion": "Regeneración de PS", nugget: "Monedas", "exp-candy": "Experiencia", "star-piece": "Suerte",
  "max-potion": "Robo de vida", "escape-rope": "Radio de recogida", "sticky-barb": "Espinas", "enigma-berry": "Sobrecuración",
  "super-lure": "Aparición de élites", "poke-radar": "Potenciadores", "loaded-dice": "Una estadística al azar",
};
export const vitaminDesc = (def) => (en() ? def.desc : pick(VITAMIN_DESC_PT, null, VITAMIN_DESC_ES)[def.key] ?? def.desc);

export const TOWER_FLOOR_PT = {
  Vestibule: "Vestíbulo",
  "Hall of Headstones": "Salão das Lápides",
  "Mist Room": "Sala da Névoa",
  "Candles Out": "Velas Apagadas",
  "Purified Zone": "Zona Purificada",
  "Marowak's Shadow": "Sombra de Marowak",
  "Wizardmon's Memory": "Memória de Wizardmon",
  "The Summit": "O Cume",
};
const TOWER_FLOOR_ES = {
  Vestibule: "Vestíbulo", "Hall of Headstones": "Sala de las Lápidas", "Mist Room": "Sala de la Niebla",
  "Candles Out": "Velas Apagadas", "Purified Zone": "Zona Purificada", "Marowak's Shadow": "La Sombra de Marowak",
  "Wizardmon's Memory": "El Recuerdo de Wizardmon", "The Summit": "La Cima",
};
export const towerFloorName = (name) => (en() ? name : pick(TOWER_FLOOR_PT, null, TOWER_FLOOR_ES)[name] ?? name);

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
const HELD_ITEM_DESC_ES = {
  leftovers: "Recupera cerca de 1/16 de los PS máximos por segundo.",
  "choice-band": "+50% de daño en todos los movimientos.",
  "life-orb": "+30% de daño; cada movimiento lanzado cuesta el 2% de los PS máximos.",
  "scope-lens": "+10% de probabilidad de crítico.",
  "muscle-band": "+15% de daño físico.",
  "wise-glasses": "+15% de daño especial.",
  "expert-belt": "+25% de daño supereficaz.",
  "quick-claw": "+10% de velocidad de ataque.",
  "bright-powder": "+8% de evasión.",
  "rocky-helmet": "Quien te golpee recibe 20 de daño.",
  "big-root": "+30% de curación recibida.",
  "lucky-egg": "+30% de experiencia.",
  "amulet-coin": "+50% de monedas.",
};
export const heldItemDesc = (key, def) => pick(HELD_ITEM_DESC_PT, HELD_ITEM_DESC_EN, HELD_ITEM_DESC_ES)[key] ?? def?.desc ?? "";

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
const ITEM_DESC_ES = {
  "grip-claw": "Cada golpe tiene un 4% de probabilidad de enraizar al enemigo durante 2 s.",
  "berry-juice": "Cada derrota tiene un 5% de probabilidad de curar el 2% de los PS máximos.",
  "shell-bell": "Recuperas el 0,8% del daño que infliges.",
  metronome: "+2% de daño por segundo sin recibir golpes (hasta +40%).",
  "binding-band": "+20% de daño a enemigos paralizados, enraizados, congelados, dormidos o retrocediendo.",
  awakening: "Cada golpe tiene un 2,5% de probabilidad de dormir al enemigo durante 3 s.",
  lemonade: "Tus aliados hacen un 25% más de daño y atacan un 15% más rápido.",
  "poke-doll": "Las pasivas de tus aliados valen un 50% más.",
  stick: "3% de probabilidad de que un golpe haga x8 de daño: ¡Bonk!",
  "razor-fang": "Remata al instante a enemigos comunes por debajo del 8% de PS (+4% por copia). Ni alfas ni jefes.",
  "focus-band": "15% de probabilidad de sobrevivir a un golpe letal con 1 PS (una vez cada 20 s).",
  "full-heal": "+6% de daño por cada estado distinto del enemigo (hasta +30%).",
  "guard-spec": "Cada 14 s bloquea por completo el siguiente golpe.",
  "gold-teeth": "La tienda cobra un 8% menos (hasta -24%).",
  "focus-sash": "Sobrevives a un golpe letal una vez por zona.",
  revive: "Revives una vez con el 35% de PS.",
  "reaper-cloth": "+1% de daño por cada 100 derrotas en la partida (hasta +30%).",
  "thick-club": "Daño físico +1% por cada 2 de armadura (hasta +50%).",
  "fire-stone": "Los enemigos quemados explotan al morir (40% de sus PS, en 3 u).",
  "leaf-stone": "Cada derrota tiene un 10% de probabilidad de soltar un remolino de hojas que corta a los cercanos y cura el 1% de PS.",
  "ss-ticket": "+1 hueco para aliados en esta partida.",
  "max-revive": "Revives una vez con el 60% de PS.",
  "soda-pop": "Tu deslizamiento suelta una ola de burbujas que daña a los enemigos cercanos.",
  "adrenaline-orb": "Al recibir un golpe: +20% de velocidad y +12% de velocidad de ataque durante 3 s.",
  "metal-powder": "Quieto medio segundo: +30% de armadura y +8% de velocidad de ataque hasta que te muevas.",
  "ice-heal": "Golpear a un enemigo congelado rompe el hielo: +60% de daño y esquirlas que paralizan a sus vecinos.",
  "old-rod": "Cada 9 s un Magikarp salta sobre un enemigo. A veces pica un Gyarados...",
  eviolite: "Mientras aún puedas evolucionar: +50% de armadura y +25% de PS máximos.",
  "shed-shell": "Deslizamiento con invulnerabilidad más larga y recarga un 10% más rápida.",
  "cell-battery": "+1,5% de velocidad de ataque cada 10 derrotas sin recibir golpes (hasta +25%).",
  "griseous-orb": "Cada derrota tiene un 12% de probabilidad de dejar una sombra que estalla y maldice a los vecinos.",
  electirizer: "Cada 2,5 s cae un rayo sobre 3 enemigos cercanos y puede paralizarlos (+1 rayo por copia).",
  "silph-scope": "Cada 6 s marca al enemigo más fuerte cercano (+1 por copia): recibe un 40% más de daño de todo. Si cae, marca otro.",
  "max-ether": "Tus vitaminas pueden subir 2 niveles más (hasta el 12).",
  "tm-case": "Tus movimientos pueden subir 2 niveles más (hasta el 10).",
  "poke-flute": "Tu definitiva se carga un 25% más rápido; al usarla, todos tus movimientos se recargan y ganas +30% de velocidad de ataque durante 6 s.",
  "secret-key": "Los Altares Antiguos se recargan en vez de desaparecer tras curar (45 s; un 30% más rápido por copia extra).",
  "dowsing-machine": "A partir de la siguiente zona o piso, cada uno trae 1 altar y 2 cofres más cerca (por copia).",
};
export const itemDesc = (key, def) => pick(ITEM_DESC_PT, ITEM_DESC_EN, ITEM_DESC_ES)[key] ?? def?.desc ?? "";
