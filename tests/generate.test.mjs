// Goodhart-proof tests for the generator + verify-core invertibility.
//
// Node built-in test runner, zero deps:  node --test tests/generate.test.mjs
//
// Each test fails under an obvious mutation of the code it guards:
//   (a) JSON islands present + entry deep-equals seed {contributor,source,stats}
//   (b) embedded integrity hash == validate.mjs computeHash(seed)
//   (c) every visual channel forward∘inverse round-trips via verify-core
//   (d) mutating ONE embedded stat -> verifyParity ok:false
//   (e) honest (untampered) case -> verifyParity ok:true

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generate } from "../src/generate.mjs";
import { computeHash } from "../src/validate.mjs";
import {
  CHANNELS,
  ENCODING,
  verifyParity,
  tokensToParticleCount,
  particleCountToTokens,
} from "../src/verify-core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED = JSON.parse(
  readFileSync(join(ROOT, "entries/_seed.example.json"), "utf8")
);

const islandJSON = (html, id) => {
  const m = html.match(
    new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`)
  );
  assert.ok(m, `island #${id} present`);
  return JSON.parse(m[1].replace(/<\\\/(script)/gi, "</$1"));
};

test("(a) HTML embeds both JSON islands; entry round-trips deep-equal", () => {
  const html = generate(SEED);
  const entry = islandJSON(html, "ccflex-entry");
  const integ = islandJSON(html, "ccflex-integrity");
  assert.ok(typeof integ.hash === "string" && integ.hash.length === 64);
  assert.deepEqual(entry.contributor, SEED.contributor);
  assert.deepEqual(entry.source, SEED.source);
  assert.deepEqual(entry.stats, SEED.stats);
});

test("(b) embedded integrity hash == validate.mjs computeHash(seed)", () => {
  const html = generate(SEED);
  const integ = islandJSON(html, "ccflex-integrity");
  assert.equal(integ.hash, computeHash(SEED));
  // Goodhart guard: the seed's own committed hash must agree too.
  assert.equal(integ.hash, SEED.integrity.hash);
});

test("(c) every visual channel forward∘inverse round-trips", () => {
  // tokenParticles: exact when multiple of BUCKET; floored otherwise (disclosed).
  for (const tok of [0, ENCODING.TOKEN_BUCKET * 7, 265100000]) {
    const c = tokensToParticleCount(tok);
    const lo = particleCountToTokens(c);
    assert.ok(lo <= tok && tok - lo < ENCODING.TOKEN_BUCKET, `particles ${tok}`);
  }
  // cellHeight: invertible above the floor.
  for (const cnt of [50000, 120000, 1850000]) {
    const y = CHANNELS.cellHeight.forward(cnt);
    assert.ok(Math.abs(CHANNELS.cellHeight.inverse(y) - cnt) < 1e-3, `height ${cnt}`);
  }
  // scalarBar + ringRatio: exact inverse.
  for (const v of [1, 1000, 41]) {
    assert.equal(CHANNELS.scalarBar.inverse(CHANNELS.scalarBar.forward(v)), v);
  }
  for (const r of [2155, 134.3, 1]) {
    assert.ok(Math.abs(CHANNELS.ringRatio.inverse(CHANNELS.ringRatio.forward(r)) - r) < 1e-9);
  }
  // cellColour: hex -> band index recovers the same band.
  for (let i = 0; i < ENCODING.RAMP.length; i++) {
    const t = (i + 0.5) / ENCODING.RAMP.length;
    assert.equal(CHANNELS.cellColour.inverse(CHANNELS.cellColour.forward(t)), i);
  }
});

test("(d) mutating ONE embedded stat -> verifyParity ok:false", () => {
  const tampered = structuredClone(SEED);
  tampered.stats.sessions.value = SEED.stats.sessions.value + 1;
  const r = verifyParity(SEED, tampered);
  assert.equal(r.ok, false);
  assert.ok(r.mismatches.some((m) => m.channel === "sessions"));
});

test("(d2) mutating a heatmap cell -> verifyParity ok:false", () => {
  const withHeat = structuredClone(SEED);
  withHeat.stats.heatmap = [
    { date: "2026-05-01", count: 120000 },
    { date: "2026-05-02", count: 0 },
  ];
  const tampered = structuredClone(withHeat);
  tampered.stats.heatmap[0].count = 999999;
  const r = verifyParity(withHeat, tampered);
  assert.equal(r.ok, false);
  assert.ok(r.mismatches.some((m) => m.channel === "heatmap"));
});

test("(e) honest untampered case -> verifyParity ok:true", () => {
  const r = verifyParity(SEED, structuredClone(SEED));
  assert.equal(r.ok, true);
  assert.equal(r.mismatches.length, 0);
  // With a real heatmap, the honest case still passes (clamp + invert both).
  const withHeat = structuredClone(SEED);
  withHeat.stats.heatmap = [
    { date: "2026-05-01", count: 10 }, // below height floor -> clamp branch
    { date: "2026-05-02", count: 200000 }, // above floor -> invert branch
  ];
  const r2 = verifyParity(withHeat, structuredClone(withHeat));
  assert.equal(r2.ok, true, JSON.stringify(r2.mismatches));
});

test("Goodhart: tampered hash island shape is detectable", () => {
  const html = generate(SEED);
  // The generator recomputes the hash; it must equal computeHash, so an
  // attacker editing the entry without the matching hash is caught by
  // validate.mjs's tamper check (exercised in its own suite) — here we
  // assert the page does NOT just echo SEED.integrity.hash blindly.
  const integ = islandJSON(html, "ccflex-integrity");
  const forged = structuredClone(SEED);
  forged.stats.sessions.value = 424242;
  const forgedHtml = generate(forged);
  const forgedInteg = islandJSON(forgedHtml, "ccflex-integrity");
  assert.notEqual(forgedInteg.hash, integ.hash);
});
