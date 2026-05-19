// Goodhart-proof tests for the 3D scene contract: the fullscreen-fill fix,
// the legible-at-first-paint composition, and the invertibility-preserving
// honesty guards. No browser is run — these assert the *generated wiring*.
// Every test fails under the obvious mutation that would reintroduce the
// bug or fake the flex. The real visual proof is the rendered-screenshot
// audit (verify-canonical); these lock the structural guarantees in CI.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generate } from "../src/generate.mjs";
import { ENCODING } from "../src/verify-core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED = JSON.parse(readFileSync(join(ROOT, "entries/ccflex-seed.json"), "utf8"));
const HTML = generate(SEED);

test("FULLSCREEN FIX: :fullscreen CSS grows the canvas to the viewport", () => {
  // The root-cause bug: canvas height hard-capped, never enlarged in FS.
  // A :fullscreen rule targeting the canvas with dvh/vh is the structural
  // fix. Mutation that deletes it (regressing the bug) fails here.
  assert.match(
    HTML,
    /#ccflex-wrap:fullscreen[^{]*canvas#ccflex[^{]*\{[^}]*100dvh/,
    ":fullscreen canvas rule must size the canvas to 100dvh (viewport-fill)"
  );
  assert.match(
    HTML,
    /#ccflex-wrap:fullscreen\s*,\s*#ccflex-wrap:-webkit-full-screen\s*\{[^}]*100dvh/,
    "the wrap itself must fill the viewport in fullscreen (incl -webkit-)"
  );
});

test("FULLSCREEN FIX: fullscreenchange is wired to the single resize() authority", () => {
  assert.match(HTML, /addEventListener\(\s*['"]fullscreenchange['"]\s*,\s*onFsChange/);
  assert.match(HTML, /addEventListener\(\s*['"]webkitfullscreenchange['"]\s*,\s*onFsChange/);
  // onFsChange must actually re-size (deferred a frame for layout), not just
  // swap the button glyph (that was the original incomplete handler).
  assert.match(
    HTML,
    /requestAnimationFrame\(\s*\(\)\s*=>\s*requestAnimationFrame\(\s*resize\s*\)\s*\)/,
    "fullscreenchange must trigger resize() after layout settles"
  );
});

test("resize() is the SINGLE sizing authority (ResizeObserver + window + FS)", () => {
  assert.match(HTML, /new ResizeObserver\(\s*resize\s*\)\.observe\(\s*cv\s*\)/);
  assert.match(HTML, /addEventListener\(\s*['"]resize['"]\s*,\s*resize\s*\)/);
  assert.match(
    HTML,
    /resize\s*=\s*\(\)\s*=>\s*\{[^}]*renderer\.setSize\([^)]*\)[^}]*cam\.aspect\s*=\s*w\s*\/\s*h[^}]*cam\.updateProjectionMatrix\(\)/,
    "resize() must set renderer size AND recompute camera aspect"
  );
  // Anti-regression: there must be no second, divergent inline ResizeObserver
  // that recomputes its own size (the old code had one — DRY/SSOT).
  const roCount = (HTML.match(/new ResizeObserver\(/g) || []).length;
  assert.equal(roCount, 1, "exactly one ResizeObserver — resize() is the SSOT");
});

test("DELIGHT: a persistent in-scene HUD echoes the embedded headline stats", () => {
  assert.match(HTML, /function makeHud\(\)/, "an in-scene HUD builder must exist");
  // Camera-parented so it is legible at first paint and every orbit angle.
  assert.match(HTML, /cam\.add\(\s*hud\s*\)/, "HUD must be parented to the camera");
  assert.match(HTML, /scene\.add\(\s*cam\s*\)/, "camera must be in the scene graph");
  // It must echo the embedded stats, not hardcode them. Scope the literal
  // check to the makeHud() body (the visible <p class="num"> legitimately
  // prints 268.3m — that is the data, not a hardcode).
  const hudFn = HTML.slice(HTML.indexOf("function makeHud("), HTML.indexOf("function buildGalaxy("));
  assert.match(hudFn, /E\.stats\.totalTokens\.display\b/);
  assert.match(hudFn, /E\.stats\.streak\.longestDays\b/);
  assert.ok(
    !/\d{2,}\.?\d*[mk]\b/i.test(hudFn) && !/\b268300000\b/.test(hudFn),
    "makeHud() must derive the headline from E.stats.*, never hardcode a figure"
  );
});

test("DELIGHT: token galaxy uses the EXACT invertible channel, no fabricated count", () => {
  assert.match(HTML, /function buildGalaxy\(/);
  // population = tokensToParticleCount(tok); shape is seeded (MT19937).
  assert.match(HTML, /const pc\s*=\s*tokensToParticleCount\(\s*tok\s*\)/);
  assert.match(HTML, /userData=\{exactCount:pc/, "geometry must carry exactCount=pc for verify()");
  assert.match(HTML, /makeRng\(\s*seed\s*\)/, "layout must be seeded (deterministic), not Math.random");
  assert.ok(!/Math\.random\(/.test(HTML), "no Math.random — layout must be reproducible from the seed");
});

test("HONESTY: window.verify()'s particle-count invertibility hook survives the rewrite", () => {
  // The rewrite must not sever the geometry<->data parity check.
  assert.match(HTML, /points\.geometry\.userData\.exactCount\s*!==\s*pc/);
});

test("HONESTY: fun-facts use the EXACT ringRatio radius; oversize → honest label, never a shrunk ring", () => {
  assert.match(HTML, /function buildFunFacts\(/);
  const ffFn = HTML.slice(HTML.indexOf("function buildFunFacts("), HTML.indexOf("function frameHero("));
  // outer radius MUST be the exact RING_BASE_RADIUS*ratio channel (no clamp).
  assert.match(
    ffFn,
    /const ratio\s*=\s*f\.value\s*,\s*outer\s*=\s*ENC\.RING_BASE_RADIUS\s*\*\s*ratio/,
    "fun-fact radius must be the exact ENC.RING_BASE_RADIUS*ratio channel"
  );
  // A perceptible ratio is drawn as the EXACT torus radius `outer`.
  assert.match(
    ffFn,
    /new THREE\.TorusGeometry\(\s*outer\s*,/,
    "viewable fun-fact must use the exact `outer` radius, not a compressed value"
  );
  // Anti-Goodhart: the radius must NEVER be cbrt/log/clamp-compressed to
  // 'fit' — an oversize ratio becomes an honest LABEL stating the exact
  // ratio, gated by a disclosed bound; it is never a faked-small ring.
  assert.ok(
    !/(Math\.cbrt|Math\.log)\([^)]*ratio|Math\.min\([^)]*outer/.test(ffFn),
    "ring radius must not be cbrt/log/clamp-compressed away from the true ratio"
  );
  assert.match(ffFn, /outer\s*<=\s*FF_VIEW_BOUND/, "a disclosed view-bound must gate ring vs label");
  assert.match(ffFn, /makeFactTile\(\s*ratioStr\s*,\s*caption\s*,/, "oversize fun-fact must render an honest fact tile");
  // The tile renderer must print the EXACT ratio string (no rounding/faking)
  // and wrap (never truncate) the caption — the depth-1 256px clip defect.
  const tileFn = HTML.slice(HTML.indexOf("function makeFactTile("), HTML.indexOf("function buildFunFacts("));
  assert.match(tileFn, /fillText\(\s*ratioStr\s*,/, "fact tile must render the exact ratio string");
  assert.match(tileFn, /measureText/, "fact tile caption must wrap (no fixed-width truncation)");
  assert.match(HTML, /const FF_VIEW_BOUND\s*=\s*\d+/, "the ring/label boundary must be a disclosed constant");
});

test("ACCESSIBILITY: auto-orbit is gated by prefers-reduced-motion", () => {
  assert.match(
    HTML,
    /controls\.autoRotate\s*=\s*!reduce/,
    "auto-rotation must be disabled under prefers-reduced-motion"
  );
});

test("CBC: buildWebGL is a thin coordinator (decomposed into named helpers)", () => {
  for (const h of ["makeHud", "buildGalaxy", "addStatPillar", "buildFunFacts", "frameHero"]) {
    assert.ok(HTML.includes(`function ${h}(`), `helper ${h}() must exist (decomposition)`);
  }
  // The coordinator must delegate, not inline the old monolith: it calls the
  // helpers rather than re-deriving geometry.
  assert.match(HTML, /points\s*=\s*buildGalaxy\(\s*scene\s*\)/);
  assert.match(HTML, /addStatPillar\(scene/);
  assert.match(HTML, /frameHero\(\)/);
});

test("RAILS UNCHANGED: encoding constants + JSON islands are byte-stable", () => {
  // The whole point — a scene change must NOT touch the verifiable data.
  assert.equal(ENCODING.TOKEN_BUCKET, 100000);
  assert.equal(ENCODING.RING_BASE_RADIUS, 1.0);
  assert.match(HTML, /<script type="application\/json" id="ccflex-entry">/);
  assert.match(HTML, /<script type="application\/json" id="ccflex-integrity">/);
  assert.ok(
    HTML.includes(SEED.integrity.hash),
    "the committed integrity hash must be embedded unchanged (scene != data)"
  );
});
