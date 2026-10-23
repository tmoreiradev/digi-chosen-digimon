// Local accounts.
//
// The upstream game has server-backed accounts, seasons and clans. This clone
// runs entirely offline, so accounts are local profiles: a guest profile by
// default, plus named accounts with a passphrase, each with its own progress.
// Nothing leaves the browser.

const STORE_KEY = "pokebonk-clone.accounts.v1";
const CURRENT_KEY = "pokebonk-clone.current.v1";

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readStore() {
  return safeParse(localStorage.getItem(STORE_KEY)) ?? { guests: {}, accounts: {} };
}

function writeStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* Storage unavailable: stay in memory. */
  }
}

/**
 * Bring a saved `progress` object up to the current shape. Older saves kept a
 * second capture list in `caught` (captures + the partner played); captures
 * were always in pokedex.caught too, so the leftovers are "seen" partners.
 */
export function normalizeProgress(p) {
  if (!p) return p;
  if (!p.pokedex) p.pokedex = { seen: [], caught: [] };
  if (!Array.isArray(p.pokedex.seen)) p.pokedex.seen = [];
  if (!Array.isArray(p.pokedex.caught)) p.pokedex.caught = [];
  if (Array.isArray(p.caught)) {
    for (const id of p.caught) if (!p.pokedex.seen.includes(id)) p.pokedex.seen.push(id);
    delete p.caught;
  }
  return p;
}

function guestKey() {
  let key = localStorage.getItem("pokebonk-clone.guest.v1");
  if (!key) {
    key = "g" + Math.random().toString(36).slice(2, 10);
    try {
      localStorage.setItem("pokebonk-clone.guest.v1", key);
    } catch {
      /* ignore */
    }
  }
  return key;
}

export const accounts = {
  current: null,

  load() {
    const store = readStore();
    const currentId = localStorage.getItem(CURRENT_KEY);
    if (currentId) {
      const [kind, id] = currentId.split(":");
      const bucket = kind === "a" ? store.accounts : store.guests;
      this.current = bucket[id] ?? null;
    }
    if (!this.current) {
      const id = guestKey();
      store.guests[id] = store.guests[id] ?? newProfile("Guest");
      this.current = store.guests[id];
      this.persist(store);
    }
    normalizeProgress(this.current.progress);
    return this.current;
  },

  persist(store = readStore()) {
    if (!this.current) return;
    const id = this.current.id;
    if (this.current.kind === "account") store.accounts[id] = this.current;
    else store.guests[id] = this.current;
    writeStore(store);
    try {
      localStorage.setItem(CURRENT_KEY, (this.current.kind === "account" ? "a" : "g") + ":" + id);
    } catch {
      /* ignore */
    }
  },

  saveProfile() {
    if (this.current) this.persist();
  },

  /** List every known profile for the account picker. */
  list() {
    const store = readStore();
    return [
      ...Object.values(store.guests).map((p) => ({ ...p, kindLabel: "Guest" })),
      ...Object.values(store.accounts).map((p) => ({ ...p, kindLabel: "Account" })),
    ];
  },

  /** Create an account; the current progress can be carried over. */
  create(name, passphrase, carryOver = true) {
    const store = readStore();
    const clean = String(name || "").trim().slice(0, 24);
    if (!clean) return { ok: false, error: "Pick a name." };
    if (store.accounts[clean]) return { ok: false, error: "That name is taken (on this device)." };
    const previous = this.current;
    const profile = newProfile(clean, "account");
    profile.pass = String(passphrase || "");
    if (carryOver && previous) {
      profile.progress = JSON.parse(JSON.stringify(previous.progress));
    }
    store.accounts[clean] = profile;
    this.current = profile;
    this.persist(store);
    return { ok: true, profile };
  },

  login(name, passphrase) {
    const store = readStore();
    const profile = store.accounts[String(name || "").trim()];
    if (!profile) return { ok: false, error: "No such account on this device." };
    if (profile.pass && profile.pass !== String(passphrase || "")) {
      return { ok: false, error: "Wrong passphrase." };
    }
    normalizeProgress(profile.progress);
    this.current = profile;
    this.persist(store);
    return { ok: true, profile };
  },

  playAsGuest() {
    const store = readStore();
    const id = guestKey();
    store.guests[id] = store.guests[id] ?? newProfile("Guest");
    this.current = store.guests[id];
    normalizeProgress(this.current.progress);
    this.persist(store);
    return this.current;
  },

  logout() {
    return this.playAsGuest();
  },
};

function newProfile(name, kind = "guest") {
  return {
    id: kind === "account" ? name : guestKey(),
    name,
    kind,
    pass: "",
    createdAt: Date.now(),
    progress: {
      unlocked: [1, 4, 7],
      pokedex: { seen: [], caught: [] },
      nickname: null,
      heldItem: null,
      best: 0,
      bestFloor: 0,
      runs: 0,
      wins: 0,
      settings: { volume: 0.5 },
    },
  };
}

// Compatibility shim: the rest of the app reads/writes `profile.data`.
export const profile = {
  get data() {
    return accounts.current?.progress ?? newProfile().progress;
  },
  save() {
    accounts.saveProfile();
  },
};
