// Goodhart-proof tests for the static site surface. No browser is run —
// these assert the *contract* (the wiring, the CLI shape, the degrade
// path, shell syntax). Every test fails under an obvious mutation:
//   - delete the fetch("./leaderboard.json") -> board-fetch test fails
//   - drop the empty-state copy           -> empty-state test fails
//   - make Playwright load eagerly/throw  -> lazy-degrade test fails
//   - change exit 3 -> exit 1             -> degrade-code test fails
//   - introduce a bashism / syntax error  -> sh -n test fails

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const indexHtml = readFileSync(join(root, "site", "index.html"), "utf8");
const screenshotSrc = readFileSync(join(root, "scripts", "screenshot.mjs"), "utf8");
const vanishPath = join(root, "scripts", "vanish-preview.sh");

test("index.html fetches its own leaderboard.json from the same directory", () => {
  assert.match(
    indexHtml,
    /fetch\(\s*["']\.\/leaderboard\.json["']/,
    "index.html must fetch ./leaderboard.json (relative, same dir)"
  );
});

test("index.html mounts a board container and handles the empty state", () => {
  assert.ok(
    indexHtml.includes('id="boardMount"'),
    "board container #boardMount must exist"
  );
  assert.ok(
    /renderEmpty\s*\(/.test(indexHtml) && /class="empty"/.test(indexHtml),
    "an explicit empty-state render path must exist"
  );
  // Goodhart anchor: the empty state must carry real copy, not a stub.
  assert.match(
    indexHtml,
    /the void stares back/i,
    "empty-state copy must be present (mutation: deleting it fails here)"
  );
});

test("index.html links each row to ./cards/<handle>.html and shows shadow flags + honesty markers", () => {
  assert.match(
    indexHtml,
    /["']\.\/cards\/["']\s*\+\s*encodeURIComponent/,
    "rows must link to ./cards/<handle>.html"
  );
  // shadow flag (⚠ U+26A0) with a reason, and honesty markers ~ / ≈
  assert.ok(indexHtml.includes("&#9888;"), "must render the ⚠ shadow glyph");
  assert.ok(
    indexHtml.includes("suspectReason") && /class="flag-reason"/.test(indexHtml),
    "shadow flag must surface a reason"
  );
  assert.ok(
    indexHtml.includes('"~"') && indexHtml.includes('"≈"'),
    "honesty markers ~ and ≈ must be rendered"
  );
});

test("index.html honours reduced-motion and is zero-build (no bundler/runtime dep)", () => {
  assert.match(
    indexHtml,
    /prefers-reduced-motion:\s*reduce/,
    "a prefers-reduced-motion contract must exist"
  );
  // zero external runtime deps: no <script src=...>, no import map, no bundler
  assert.ok(
    !/<script[^>]+\bsrc=/.test(indexHtml),
    "no external script may be loaded (zero runtime deps)"
  );
});

test("screenshot.mjs exposes the documented CLI contract", () => {
  assert.match(
    screenshotSrc,
    /node scripts\/screenshot\.mjs <card\.html> <out\.png>/,
    "the usage string must document the CLI contract"
  );
  assert.ok(
    /export\s+function\s+parseArgs/.test(screenshotSrc) &&
      /export\s+async\s+function\s+loadPlaywright/.test(screenshotSrc),
    "parseArgs + loadPlaywright must be exported (testable seams)"
  );
});

test("screenshot.mjs imports Playwright LAZILY and degrades (exit 3, no throw) when absent", async () => {
  // Static guarantees: no top-level playwright import; degrade uses exit 3.
  assert.ok(
    !/^\s*import\s+[^;]*["']playwright["']/m.test(screenshotSrc),
    "Playwright must NOT be a top-level/static import"
  );
  assert.ok(
    /await import\(\s*["']playwright["']\s*\)/.test(screenshotSrc),
    "Playwright must be imported lazily via dynamic import()"
  );
  assert.match(
    screenshotSrc,
    /process\.exit\(\s*3\s*\)/,
    "missing Playwright must degrade with exit code 3"
  );

  // Behavioural guarantee: importing the module must NOT pull Playwright
  // and loadPlaywright() must return a soft {ok:false} (never throw),
  // proving the suite is safe with node_modules absent.
  const mod = await import("../scripts/screenshot.mjs");
  assert.equal(typeof mod.loadPlaywright, "function");
  const r = await mod.loadPlaywright();
  assert.equal(typeof r.ok, "boolean", "loadPlaywright must resolve, never throw");
  if (!r.ok) {
    assert.match(
      r.message,
      /Playwright is not installed/,
      "absent Playwright must yield a clear plain-language message"
    );
  }
  // parseArgs contract: missing args -> not ok, with a usage error.
  const bad = mod.parseArgs([]);
  assert.equal(bad.ok, false);
  assert.match(bad.error, /usage:/);
  const good = mod.parseArgs(["a.html", "b.png"]);
  assert.equal(good.ok, true);
  assert.equal(good.cardPath, "a.html");
  assert.equal(good.outPath, "b.png");
});

test("vanish-preview.sh is POSIX sh syntax-clean (sh -n)", () => {
  // Throws (failing the test) on any syntax error or accidental bashism
  // that `sh -n` rejects.
  execFileSync("sh", ["-n", vanishPath], { stdio: "pipe" });
});

test("vanish-preview.sh treats a missing vanish CLI as non-blocking (exit 0)", () => {
  const src = readFileSync(vanishPath, "utf8");
  assert.match(
    src,
    /command -v vanish/,
    "must probe for the vanish CLI on PATH"
  );
  // The absent-CLI branch must exit 0 (optional, never blocks submission).
  assert.match(
    src,
    /install vanish-cli[\s\S]*?exit 0/i,
    "absent vanish CLI must print an install note and exit 0"
  );
});
