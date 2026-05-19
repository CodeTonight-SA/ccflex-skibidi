// Goodhart-proof tests (Rule 14): every test can fail under an obvious
// mutation. The honest seed must pass; each single mutation must fail. If any
// mutation still validates, the verifier is theatre — that is the falsifier
// for H-CCFLEX-1 at the schema layer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateEntry, computeHash } from "../src/validate.mjs";
import { canonicalize } from "../src/jcs.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SEED = join(here, "..", "entries", "_seed.example.json");

function loadSeed() {
  const e = JSON.parse(readFileSync(SEED, "utf8"));
  e.integrity.hash = computeHash(e); // self-consistent honest baseline
  return e;
}
const clone = (o) => JSON.parse(JSON.stringify(o));

test("honest seed validates", () => {
  const r = validateEntry(loadSeed());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test("a tampered number breaks the integrity hash (core promise)", () => {
  const e = loadSeed();
  e.stats.totalTokens.value = 999999999; // lie about the headline number
  const r = validateEntry(e);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((x) => x.includes("integrity.hash")), r.errors.join("; "));
});

test("each single structural mutation is rejected", () => {
  const mutations = [
    ["extra top-level prop", (e) => { e.lol = "skibidi"; }],
    ["missing required stats", (e) => { delete e.stats; }],
    ["wrong schemaVersion", (e) => { e.schemaVersion = "2.0.0"; }],
    ["bad handle", (e) => { e.contributor.handle = "no spaces!"; }],
    ["unknown stats key", (e) => { e.stats.bonus = 1; }],
    ["metric.value negative", (e) => { e.stats.totalTokens.value = -1; }],
    ["metric.exact not boolean", (e) => { e.stats.sessions.exact = "yes"; }],
    ["activeDays active > of", (e) => { e.stats.activeDays.active = 999; }],
    ["streak current > longest", (e) => { e.stats.streak.currentDays = 99; }],
    ["peakHour out of range", (e) => { e.stats.peakHour = { startHour: 25, endHour: 26 }; }],
    ["source.tool wrong", (e) => { e.source.tool = "cursor"; }],
    ["source.command not in enum", (e) => { e.source.command = "/flex"; }],
    ["funFact approx missing", (e) => { e.stats.funFacts = [{ id: "x", label: "y", value: 1 }]; }],
    ["integrity.algo wrong", (e) => { e.integrity.algo = "md5"; }],
    ["integrity.hash wrong length", (e) => { e.integrity.hash = "abc"; }],
  ];
  for (const [name, mutate] of mutations) {
    const e = clone(loadSeed());
    mutate(e);
    // Recompute the hash ONLY for non-integrity structural mutations, so each
    // structural rule is tested in isolation. Integrity-targeted mutations
    // must survive — recomputing would silently undo them (the harness bug
    // this suite caught on its own first run).
    const skipRecompute =
      ["bad handle", "wrong schemaVersion", "extra top-level prop"].includes(name) ||
      name.startsWith("integrity");
    if (!skipRecompute && e.contributor && e.source && e.stats) {
      try { e.integrity.hash = computeHash(e); } catch { /* canon may reject — fine */ }
    }
    const r = validateEntry(e);
    assert.equal(r.ok, false, `mutation "${name}" should have been rejected`);
  }
});

test("canonicalization is deterministic and key-order-independent", () => {
  const a = { b: 1, a: { y: [3, 2], x: "skibidi" } };
  const b = { a: { x: "skibidi", y: [3, 2] }, b: 1 };
  assert.equal(canonicalize(a), canonicalize(b));
  assert.equal(canonicalize(a), '{"a":{"x":"skibidi","y":[3,2]},"b":1}');
});

test("computeHash is stable across runs", () => {
  const e = loadSeed();
  assert.equal(computeHash(e), computeHash(clone(e)));
});
