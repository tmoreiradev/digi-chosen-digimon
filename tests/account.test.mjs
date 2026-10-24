// BACKLOG 15: account passphrases are no longer stored in plain text; old saves migrate on login.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./_dom.mjs";

const dom = installFakeDom();
const { accounts, passHash } = await import("../src/ui/account.js");
const STORE_KEY = "pokebonk-clone.accounts.v1"; // unchanged: old saves keep loading

function fresh() {
  dom.store.clear();
  accounts.current = null;
  accounts.load();
}
const raw = () => localStorage.getItem(STORE_KEY);

test("a new account stores a hash, never the passphrase", () => {
  fresh();
  assert.equal(accounts.create("Ash", "pikachu123").ok, true);
  assert.ok(!raw().includes("pikachu123"), "no plain text in localStorage");
  assert.equal(JSON.parse(raw()).accounts.Ash.passHash, passHash("Ash", "pikachu123"));
  assert.equal(accounts.login("Ash", "wrong").ok, false);
  assert.equal(accounts.login("Ash", "pikachu123").ok, true);
});

test("an account without a passphrase logs in with an empty one", () => {
  fresh();
  accounts.create("Misty", "");
  assert.equal(accounts.login("Misty", "").ok, true);
  assert.equal(accounts.login("Misty", "anything").ok, true, "no passphrase, nothing to check (as before)");
});

test("an old save with a plain-text passphrase is checked once and migrated", () => {
  fresh();
  accounts.create("Brock", "");
  const store = JSON.parse(raw());
  store.accounts.Brock.pass = "onix";
  delete store.accounts.Brock.passHash;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  assert.equal(accounts.login("Brock", "nope").ok, false);
  assert.equal(accounts.login("Brock", "onix").ok, true);
  assert.ok(!raw().includes("onix"), "plain text gone after the migration");
  assert.equal(accounts.login("Brock", "onix").ok, true, "the hash now does the check");
  assert.equal(accounts.login("Brock", "nope").ok, false);
});

test("the hash is salted by name", () => {
  assert.notEqual(passHash("Ash", "same"), passHash("Gary", "same"));
});
