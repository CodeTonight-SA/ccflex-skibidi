// Goodhart-proof tests for the CI verifier, incl. the capability-lock proof:
// a card containing hostile <script> must NOT execute. Every test fails under
// an obvious mutation (incl. "verifier secretly executes the page").

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generate } from "../src/generate.mjs";
import { verifyCard } from "../src/verify-card.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, "..", "entries", "_seed.example.json"), "utf8"));
const honestCard = generate(seed);

test("honest card verifies against its committed entry", () => {
  const r = verifyCard(honestCard, seed);
  assert.equal(r.ok, true, JSON.stringify(r.reasons));
});

test("a different committed entry than the card is rejected", () => {
  const lying = JSON.parse(JSON.stringify(seed));
  lying.stats.totalTokens.value = 999_000_000; // entry no longer matches the card
  const r = verifyCard(honestCard, lying);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.length > 0);
});

test("a tampered embedded island is rejected", () => {
  // Tamper a value derived from the seed itself — never a hardcoded literal
  // (that coupled the test to one token count and broke when the seed updated).
  const realTok = String(seed.stats.totalTokens.value);
  const tampered = honestCard.replace(realTok, "999999999");
  assert.notEqual(tampered, honestCard, "tamper must change the embedded island");
  const r = verifyCard(tampered, seed);
  assert.equal(r.ok, false);
});

test("CAPABILITY LOCK: hostile <script> in the card is never executed", () => {
  delete globalThis.__ccflex_pwned;
  const hostile = honestCard.replace(
    "<head>",
    '<head><script>globalThis.__ccflex_pwned=true;throw new Error("exec")</script>'
  );
  const r = verifyCard(hostile, seed); // islands still intact -> still a verdict
  assert.equal(globalThis.__ccflex_pwned, undefined, "verifier executed page script — capability lock breached");
  assert.equal(r.ok, true, JSON.stringify(r.reasons));
});

test("missing island fails closed (no throw, explicit reason)", () => {
  const r = verifyCard("<html><body>no islands here</body></html>", seed);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes("ccflex-entry")));
});
