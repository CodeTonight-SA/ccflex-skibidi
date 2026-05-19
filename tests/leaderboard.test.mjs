// Goodhart-proof, hermetic leaderboard tests (Rule 14). Fixtures live in a
// temp dir; every assertion fails under an obvious mutation. The single-entry
// Flex is re-derived from the closed form in docs/metrics.md (independent of
// the implementation's normaliser) so code↔doc drift is caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readEntries, rank, renderBlock, spliceReadme } from "../src/leaderboard.mjs";
import { computeHash } from "../src/validate.mjs";

function makeEntry(handle, { tokens = 1_000_000, active = 80, windowD = 105, longest = 20, sessMin = 1000 } = {}) {
  const e = {
    schemaVersion: "1.0.0",
    contributor: { handle },
    source: { tool: "claude-code", command: "/stats+/usage", window: { days: windowD } },
    stats: {
      favoriteModel: "Opus 4.7",
      totalTokens: { value: tokens, display: `${tokens}`, exact: true },
      sessions: { value: 100, display: "100", exact: true },
      activeDays: { active, of: windowD },
      streak: { currentDays: Math.min(longest, 3), longestDays: longest },
      longestSessionMinutes: sessMin,
      funFacts: [{ id: "tokens-vs-1984", label: "more tokens than 1984", value: 42, approx: true, baseline: "1984" }],
    },
    integrity: { algo: "sha256", canonicalization: "rfc8785", hash: "" },
  };
  e.integrity.hash = computeHash(e);
  return e;
}

function tmpEntriesDir(entries) {
  const dir = mkdtempSync(join(tmpdir(), "ccflex-lb-"));
  for (const [name, obj] of entries) writeFileSync(join(dir, name), JSON.stringify(obj));
  return dir;
}

test("invalid and tamper-evident entries are excluded from ranking", () => {
  const honest = makeEntry("honest");
  const tampered = makeEntry("tampered");
  tampered.integrity.hash = "f".repeat(64); // wrong hash -> validate fails
  const broken = { schemaVersion: "1.0.0", contributor: { handle: "broken" } }; // missing required
  const dir = tmpEntriesDir([
    ["honest.json", honest], ["tampered.json", tampered], ["broken.json", broken],
  ]);
  try {
    const { valid, invalid } = readEntries(dir);
    assert.deepEqual(valid.map((v) => v.entry.contributor.handle), ["honest"]);
    assert.equal(invalid.length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ranking is deterministic", () => {
  const dir = tmpEntriesDir([
    ["a.json", makeEntry("a", { tokens: 5_000_000 })],
    ["b.json", makeEntry("b", { tokens: 9_000_000 })],
  ]);
  try {
    const r1 = readEntries(dir), r2 = readEntries(dir);
    const p1 = rank(r1.valid).map((x) => `${x.position}:${x.entry.contributor.handle}`);
    const p2 = rank(r2.valid).map((x) => `${x.position}:${x.entry.contributor.handle}`);
    assert.deepEqual(p1, p2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("higher-volume honest entry outranks lower", () => {
  const big = makeEntry("big", { tokens: 200_000_000 });
  const small = makeEntry("small", { tokens: 1_000_000 });
  const ranked = rank([{ file: "big.json", entry: big }, { file: "small.json", entry: small }]);
  const top = ranked.find((r) => r.position === 1);
  assert.equal(top.entry.contributor.handle, "big");
  assert.ok(ranked[0].flex > ranked[1].flex, `expected big.flex > small.flex, got ${ranked[0].flex} vs ${ranked[1].flex}`);
});

test("single-entry Flex matches the docs/metrics.md closed form", () => {
  const active = 82, windowD = 105, longest = 20;
  const e = makeEntry("solo", { active, windowD, longest });
  const [r] = rank([{ file: "solo.json", entry: e }]);
  const expected = Math.round(1000 * (0.70 + 0.20 * (active / windowD) + 0.10 * (longest / windowD)));
  assert.equal(r.flex, expected);
});

test("shadow flag fires on low-active + extreme-intensity, not on the normal one", () => {
  const normal = makeEntry("normal", { tokens: 8_000_000, active: 80 });
  const spike = makeEntry("spike", { tokens: 500_000_000, active: 1 });
  const ranked = rank([{ file: "n.json", entry: normal }, { file: "s.json", entry: spike }]);
  const byHandle = Object.fromEntries(ranked.map((r) => [r.entry.contributor.handle, r]));
  assert.equal(byHandle.spike.suspect, true);
  assert.equal(byHandle.normal.suspect, false);
});

test("spliceReadme is idempotent and requires the markers", () => {
  const block = renderBlock(rank([{ file: "x.json", entry: makeEntry("x") }]));
  const readme = "intro\n<!-- LEADERBOARD:START -->\nold\n<!-- LEADERBOARD:END -->\noutro\n";
  const once = spliceReadme(readme, block);
  const twice = spliceReadme(once, block);
  assert.equal(once, twice);
  assert.ok(once.includes("intro") && once.includes("outro"));
  assert.throws(() => spliceReadme("no markers here", block));
});
