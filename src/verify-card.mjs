// CI-side card verifier. Decides whether a submitted card HTML honestly
// renders its committed entry. Untrusted-content capability lock
// (rules/untrusted-content-capability-lock.md): a submission is parsed,
// NEVER executed. The ONLY thing this module does with the HTML is run two
// fixed regexes for the two allowlisted island ids and `JSON.parse` the
// captured text. No eval, no dynamic import, no jsdom, no browser, no shell.
// A <script>…</script> anywhere else in the file is inert here by
// construction — it is never a code path, only ever a string we don't read.
//
// CLI:  node src/verify-card.mjs <card.html> <entry.json>   (exit 0 = honest)
// API:  verifyCard(htmlText, canonicalEntry) -> { ok, reasons[] }

import { readFileSync } from "node:fs";
import { validateEntry } from "./validate.mjs";
import { computeHash, verifyParity } from "./verify-core.mjs";

const ISLAND = (id) =>
  new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`, "i");

// Extract one allowlisted JSON island as DATA. JSON's `\/` decodes to `/`,
// so generate.mjs's `</script` -> `<\/script` escaping round-trips through
// JSON.parse with no manual unescaping. Returns null on absence/parse error
// (a missing or malformed island is a failed verification, never a throw).
function island(htmlText, id) {
  const m = ISLAND(id).exec(htmlText);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export function verifyCard(htmlText, canonicalEntry) {
  const reasons = [];
  const embeddedEntry = island(htmlText, "ccflex-entry");
  const embeddedInteg = island(htmlText, "ccflex-integrity");

  if (embeddedEntry === null) reasons.push("missing/invalid #ccflex-entry island");
  if (embeddedInteg === null || typeof embeddedInteg.hash !== "string") {
    reasons.push("missing/invalid #ccflex-integrity island");
  }

  const v = validateEntry(canonicalEntry);
  if (!v.ok) reasons.push(`committed entry invalid: ${v.errors[0] ?? "?"}`);

  if (embeddedEntry !== null && v.ok) {
    const hCanon = computeHash(canonicalEntry);
    const hEmbed = computeHash(embeddedEntry);
    if (hCanon !== hEmbed) reasons.push("card embeds a different entry than the committed one");
    if (canonicalEntry.integrity?.hash !== hCanon) reasons.push("committed entry hash does not recompute");
    if (embeddedInteg && embeddedInteg.hash !== hCanon) reasons.push("embedded integrity island hash mismatch");
    const p = verifyParity(canonicalEntry, embeddedEntry);
    if (!p.ok) reasons.push(`parity: ${p.mismatches.map((m) => `${m.channel}:${m.detail}`).join("; ")}`);
  }

  return { ok: reasons.length === 0, reasons };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cardPath, entryPath] = process.argv.slice(2);
  if (!cardPath || !entryPath) {
    console.error("usage: verify-card.mjs <card.html> <entry.json>");
    process.exit(2);
  }
  let html, entry;
  try { html = readFileSync(cardPath, "utf8"); }
  catch (e) { console.error(`cannot read card: ${e.message}`); process.exit(2); }
  try { entry = JSON.parse(readFileSync(entryPath, "utf8")); }
  catch (e) { console.error(`cannot parse entry: ${e.message}`); process.exit(2); }
  const r = verifyCard(html, entry);
  if (r.ok) { console.log(`OK  ${cardPath} honestly renders ${entryPath}`); process.exit(0); }
  console.error(`FAIL  ${cardPath}`);
  for (const why of r.reasons) console.error(`  - ${why}`);
  process.exit(1);
}
