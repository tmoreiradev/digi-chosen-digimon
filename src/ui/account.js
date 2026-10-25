// Local accounts.
//
// The upstream game has server-backed accounts, seasons and clans. This clone
// runs entirely offline, so accounts are local profiles: a guest profile by
// default, plus named accounts with a passphrase, each with its own progress.
// Nothing leaves the browser.

import { hashString } from "../core/rng.js";
import { PACK } from "../content/pack.js";

const STORE_KEY = `${PACK.storagePrefix}.accounts.v1`;

// shortcut: a salted, iterated FNV-1a only keeps the passphrase out of plain sight in localStorage;
// it is not real protection (anyone with the device reads the profile anyway). Upgrade to
// crypto.subtle (PBKDF2) if accounts ever leave the device.
export function passHash(name, passphrase) {
  let h = hashString(name + "\u0000" + passphrase);
  for (let i = 0; i < 2000; i++) h = hashString(h.toString(36) + passphrase);
  return "f1:" + h.toString(36);
}
const CURRENT_KEY = `${PACK.storagePrefix}.current.v1`;
const GUEST_KEY = `${PACK.storagePrefix}.guest.v1`;

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
  if (!Array.isArray(p.unlocked)) p.unlocked = [...PACK.starters]; // roster partners; the starters always
  if (Array.isArray(p.caught)) {
    for (const id of p.caught) if (!p.pokedex.seen.includes(id)) p.pokedex.seen.push(id);
    delete p.caught;
  }
  return p;
}

function guestKey() {
  let key = localStorage.getItem(GUEST_KEY);
  if (!key) {
    key = "g" + Math.random().toString(36).slice(2, 10);
    try {
      localStorage.setItem(GUEST_KEY, key);
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
      store.guests[id] = store.guests[id] ?? newProfile("Convidado");
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
      ...Object.values(store.guests).map((p) => ({ ...p, kindLabel: "Convidado" })),
      ...Object.values(store.accounts).map((p) => ({ ...p, kindLabel: "Conta" })),
    ];
  },

  /** Create an account; the current progress can be carried over. */
  create(name, passphrase, carryOver = true) {
    const store = readStore();
    const clean = String(name || "").trim().slice(0, 24);
    if (!clean) return { ok: false, error: "Escolha um nome." };
    if (store.accounts[clean]) return { ok: false, error: "Esse nome já está em uso (neste aparelho)." };
    const previous = this.current;
    const profile = newProfile(clean, "account");
    const pass = String(passphrase || "");
    profile.passHash = pass ? passHash(clean, pass) : "";
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
    if (!profile) return { ok: false, error: "Não existe essa conta neste aparelho." };
    const given = String(passphrase || "");
    if (profile.pass) {
      // Saves from before the hash kept the passphrase in plain text: check it once, then migrate.
      if (profile.pass !== given) return { ok: false, error: "Senha incorreta." };
      profile.passHash = passHash(profile.name, given);
      delete profile.pass;
    } else if (profile.passHash && profile.passHash !== passHash(profile.name, given)) {
      return { ok: false, error: "Senha incorreta." };
    }
    normalizeProgress(profile.progress);
    this.current = profile;
    this.persist(store);
    return { ok: true, profile };
  },

  playAsGuest() {
    const store = readStore();
    const id = guestKey();
    store.guests[id] = store.guests[id] ?? newProfile("Convidado");
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
    passHash: "",
    createdAt: Date.now(),
    progress: {
      unlocked: [...PACK.starters],
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
