// Zero-dependency leaderboard builder. Ranks ONLY verified entries; the
// formula matches docs/metrics.md exactly (correct-by-construction). Inputs
// are tamper-evident (validate.mjs re-verifies the integrity hash), so the
// defence against gaming is structural, not formula-secrecy.
//
// CLI:
//   node src/leaderboard.mjs            -> write site/leaderboard.json + README block
//   node src/leaderboard.mjs --check    -> exit 1 if the README block is stale (CI gate)

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateEntry } from "./validate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const START = "<!-- LEADERBOARD:START -->";
const END = "<!-- LEADERBOARD:END -->";
const WEIGHTS = { tokens: 0.40, intensity: 0.25, consistency: 0.20, streak: 0.10, endurance: 0.05 };
// Canonical render host (drafts/ccflex-cf-card-link-council.md). Card links
// are emitted as the EXTENSIONLESS Cloudflare Pages URL: it renders the card
// (a repo-relative .html link would show GitHub *source*), and Pages clean
// URLs mean no .html -> /clean 308 redirect hop. On-disk file stays <handle>.html.
const PAGES_BASE = "https://ccflex-skibidi.pages.dev";

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function readEntries(entriesDir) {
  const valid = [], invalid = [];
  for (const f of readdirSync(entriesDir).filter((n) => n.endsWith(".json")).sort()) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(entriesDir, f), "utf8")); }
    catch (e) { invalid.push({ file: f, errors: [`parse: ${e.message}`] }); continue; }
    const r = validateEntry(parsed);
    if (r.ok) valid.push({ file: f, entry: parsed });
    else invalid.push({ file: f, errors: r.errors });
  }
  return { valid, invalid };
}

export function metricsOf(entry) {
  const s = entry.stats;
  const tokens = s.totalTokens.value;
  const activeN = s.activeDays.active;
  const windowD = entry.source.window.days;
  const enduranceM = s.longestSessionMinutes ?? 0;
  const ff = (s.funFacts ?? []).find((x) => x.id === "tokens-vs-1984");
  return {
    tokens, activeN, windowD, enduranceM,
    intensity: activeN > 0 ? tokens / activeN : 0,
    consistency: clamp01(activeN / windowD),
    streakQuality: clamp01(s.streak.longestDays / windowD),
    f1984: ff ? ff.value : null,
    exactTokens: s.totalTokens.exact === true,
    tokensDisplay: s.totalTokens.display,
  };
}

// log1p min-max across the cohort; degenerate (size<=1 or max==min) -> 1.0
function normalizer(values) {
  if (values.length <= 1) return () => 1.0;
  const ls = values.map((v) => Math.log1p(Math.max(0, v)));
  const lo = Math.min(...ls), hi = Math.max(...ls);
  if (hi === lo) return () => 1.0;
  return (v) => (Math.log1p(Math.max(0, v)) - lo) / (hi - lo);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return Infinity;
  const idx = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[idx];
}

export function rank(validEntries) {
  const rows = validEntries.map(({ file, entry }) => ({ file, entry, m: metricsOf(entry) }));
  const nTok = normalizer(rows.map((r) => r.m.tokens));
  const nInt = normalizer(rows.map((r) => r.m.intensity));
  const nEnd = normalizer(rows.map((r) => r.m.enduranceM));
  const p95int = percentile([...rows.map((r) => r.m.intensity)].sort((a, b) => a - b), 0.95);
  for (const r of rows) {
    const m = r.m;
    r.flex = Math.round(1000 * (
      WEIGHTS.tokens * nTok(m.tokens) +
      WEIGHTS.intensity * nInt(m.intensity) +
      WEIGHTS.consistency * m.consistency +
      WEIGHTS.streak * m.streakQuality +
      WEIGHTS.endurance * nEnd(m.enduranceM)
    ));
    r.suspect = m.activeN < 3 && rows.length > 1 && m.intensity >= p95int && p95int > 0;
  }
  rows.sort((a, b) =>
    b.flex - a.flex ||
    b.m.tokens - a.m.tokens ||
    a.entry.contributor.handle.localeCompare(b.entry.contributor.handle));
  rows.forEach((r, i) => { r.position = i + 1; });
  return rows;
}

function fmtDuration(min) {
  if (!min) return "—";
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  return [d ? `${d}d` : "", h ? `${h}h` : "", m || (!d && !h) ? `${m}m` : ""].filter(Boolean).join(" ");
}

function row(r) {
  const c = r.entry.contributor;
  const who = c.url ? `[${c.displayName ?? c.handle}](${c.url})` : (c.displayName ?? c.handle);
  const tok = (r.m.exactTokens ? "" : "~") + r.m.tokensDisplay;
  const f1984 = r.m.f1984 != null ? `≈${r.m.f1984}×` : "—";
  const card = existsSync(join(ROOT, "site", "cards", `${c.handle}.html`))
    ? `[card](${PAGES_BASE}/cards/${c.handle})` : "—";
  const flex = `${r.flex}${r.suspect ? " ⚠" : ""}`;
  return `| ${r.position} | ${who} | ${tok} | ${r.entry.stats.streak.longestDays} days | ` +
    `${fmtDuration(r.entry.stats.longestSessionMinutes)} | ${f1984} | ${flex} | ✓ verified | ${card} |`;
}

export function renderBlock(ranked) {
  const head = "| # | Contributor | Tokens | Longest streak | Longest session | 1984× | Flex | Verify | Card |\n" +
    "|---|-------------|--------|----------------|------------------|-------|------|--------|------|";
  const body = ranked.length ? ranked.map(row).join("\n")
    : "| — | _no verified entries yet — yours could be #1_ | — | — | — | — | — | — | — |";
  return `${START}\n\n${head}\n${body}\n\n_Generated from verified \`entries/\`. Not hand-edited — it cannot be. ` +
    `\`⚠\` = shadow-flagged (see \`docs/metrics.md\`)._\n\n${END}`;
}

export function spliceReadme(readme, block) {
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (!re.test(readme)) throw new Error("README leaderboard markers not found");
  return readme.replace(re, block);
}

function main(argv) {
  const check = argv.includes("--check");
  const { valid, invalid } = readEntries(join(ROOT, "entries"));
  const ranked = rank(valid);
  const block = renderBlock(ranked);
  const readmePath = join(ROOT, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  const next = spliceReadme(readme, block);
  if (check) {
    if (next !== readme) { console.error("README leaderboard is STALE — run: node src/leaderboard.mjs"); process.exit(1); }
    console.log(`README leaderboard up to date (${ranked.length} verified, ${invalid.length} rejected)`); return;
  }
  writeFileSync(join(ROOT, "site", "leaderboard.json"),
    JSON.stringify({ generatedFrom: "entries/", count: ranked.length,
      ranked: ranked.map((r) => ({ position: r.position, handle: r.entry.contributor.handle,
        flex: r.flex, suspect: r.suspect, metrics: r.m })),
      rejected: invalid }, null, 2) + "\n");
  writeFileSync(readmePath, next);
  console.log(`leaderboard: ${ranked.length} verified, ${invalid.length} rejected`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
