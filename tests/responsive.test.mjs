// Goodhart-proof responsive tests. Each assertion fails under the obvious mutation:
//   - remove viewport-fit=cover        -> viewport test fails
//   - remove vh fallback line          -> dvh-fallback test fails
//   - revert touch targets to 44px     -> touch-target tests fail
//   - add max-width-only query         -> mobile-first test fails
//   - change --viewport parse logic    -> screenshot-arg test fails
//
// All assertions are on concrete CSS values / HTML strings, not call counts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generate } from "../src/generate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Load the seed entry once.
const SEED = JSON.parse(
  readFileSync(join(root, "entries", "ccflex-seed.json"), "utf8")
);

// Generate HTML once — all card tests share this.
const cardHtml = generate(SEED);

// Also load index.html + screenshot source for static assertions.
const indexHtml = readFileSync(join(root, "site", "index.html"), "utf8");
const screenshotSrc = readFileSync(join(root, "scripts", "screenshot.mjs"), "utf8");

// ---------------------------------------------------------------------------
// Card (generate.mjs output) assertions
// ---------------------------------------------------------------------------

test("card: viewport meta has viewport-fit=cover", () => {
  assert.match(
    cardHtml,
    /viewport-fit=cover/,
    "viewport meta must include viewport-fit=cover (mutation: remove it -> fails)"
  );
});

test("card: canvas height has vh fallback BEFORE dvh line", () => {
  // The vh fallback must appear as a separate property before the dvh override,
  // so older Safari (which ignores dvh) picks up the vh value.
  // Mutation: remove the vh line -> this regex no longer matches -> test fails.
  assert.match(
    cardHtml,
    /height:min\(72vh,560px\);height:min\(72dvh,560px\)/,
    "canvas must declare height:min(72vh,560px) then height:min(72dvh,560px) (dvh overrides where supported)"
  );
});

test("card: fullscreen button (#ccflex-fs) has min-width AND min-height >= 48px", () => {
  // Extract the #ccflex-fs rule from the generated style block.
  const m = cardHtml.match(/#ccflex-fs\{([^}]+)\}/);
  assert.ok(m, "#ccflex-fs rule must be present in generated CSS");
  const rule = m[1];
  // Both dimensions must be 48px (not 44px).
  assert.match(rule, /min-width:48px/, "min-width must be 48px (mutation: 44px -> fails)");
  assert.match(rule, /min-height:48px/, "min-height must be 48px (mutation: 44px -> fails)");
});

test("card: codec trigger ([data-codec-trigger]) has min-width AND min-height >= 48px", () => {
  const m = cardHtml.match(/\[data-codec-trigger\]\{([^}]+)\}/);
  assert.ok(m, "[data-codec-trigger] rule must be present");
  const rule = m[1];
  assert.match(rule, /min-width:48px/, "min-width must be 48px");
  assert.match(rule, /min-height:48px/, "min-height must be 48px");
});

test("card: codec close button (.codec-close) has min-width AND min-height >= 48px", () => {
  const m = cardHtml.match(/\.codec-close\{([^}]+)\}/);
  assert.ok(m, ".codec-close rule must be present");
  const rule = m[1];
  assert.match(rule, /min-width:48px/, "min-width must be 48px");
  assert.match(rule, /min-height:48px/, "min-height must be 48px");
});

test("card: no max-width-only media query in generated CSS", () => {
  // Extract the <style> block only (not script body where max-width could appear in comments).
  const styleMatch = cardHtml.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(styleMatch, "<style> block must exist");
  const style = styleMatch[1];
  assert.ok(
    !/@media[^{]*\(max-width:[^)]+\)[^{]*\{/.test(style),
    "generated CSS must not contain a max-width-only media query (mutation: add one -> fails)"
  );
});

// ---------------------------------------------------------------------------
// index.html assertions
// ---------------------------------------------------------------------------

test("index.html: viewport meta has viewport-fit=cover", () => {
  assert.match(indexHtml, /viewport-fit=cover/);
});

test("index.html: .card-link a has min-height >= 48px", () => {
  const m = indexHtml.match(/\.card-link a \{([^}]+)\}/);
  assert.ok(m, ".card-link a rule must exist");
  const rule = m[1];
  assert.match(rule, /min-height:\s*48px/, "min-height must be 48px (mutation: 44px -> fails)");
});

test("index.html: no max-width-only media query in <style>", () => {
  const styleMatch = indexHtml.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(styleMatch, "<style> block must exist");
  const style = styleMatch[1];
  assert.ok(
    !/@media[^{]*\(max-width:[^)]+\)[^{]*\{/.test(style),
    "index.html CSS must not contain a max-width-only media query"
  );
});

test("index.html: mobile stacked layout is the base (outside any media query)", () => {
  // thead { position:absolute } must appear outside a @media block in the style sheet —
  // that's what mobile-first means: the narrow layout is the default.
  const styleMatch = indexHtml.match(/<style>([\s\S]*?)<\/style>/);
  const style = styleMatch[1];
  // Strip all @media blocks and check the remainder still has the stacked rule.
  const withoutMedia = style.replace(/@media[^{]*\{[\s\S]*?\n  \}/g, "");
  assert.match(
    withoutMedia,
    /thead\s*\{[^}]*position:\s*absolute/,
    "stacked thead rule must be outside any @media block (mobile-first base)"
  );
});

// ---------------------------------------------------------------------------
// screenshot.mjs --viewport arg assertions
// ---------------------------------------------------------------------------

test("screenshot.mjs: --viewport WxH parses correctly, absent defaults to 1200x1600", async () => {
  const mod = await import("../scripts/screenshot.mjs");

  // Absent flag -> old default (backward compat).
  const noFlag = mod.parseArgs(["card.html", "out.png"]);
  assert.equal(noFlag.ok, true);
  assert.deepEqual(noFlag.viewport, { width: 1200, height: 1600 },
    "absent --viewport must default to 1200x1600 (mutation: change default -> fails)");

  // With flag.
  const withFlag = mod.parseArgs(["--viewport", "375x667", "card.html", "out.png"]);
  assert.equal(withFlag.ok, true);
  assert.deepEqual(withFlag.viewport, { width: 375, height: 667 },
    "parsed viewport must match the flag value");
  assert.equal(withFlag.cardPath, "card.html");
  assert.equal(withFlag.outPath, "out.png");

  // Bad flag value.
  const bad = mod.parseArgs(["--viewport", "notasize", "card.html", "out.png"]);
  assert.equal(bad.ok, false, "invalid --viewport must return ok:false");
  assert.match(bad.error, /WxH/, "error must mention WxH format");
});
