// verify-core — the single source of truth for ccflex's visual encoding.
//
// Design axiom (drafts/ccflex-threejs-research.md §1.1): a visualisation is
// "accurate" iff every datum -> visual-channel mapping is monotonic,
// documented, and INVERTIBLE — given the rendered parameter you can recover
// the original value exactly (or within a stated, disclosed residue).
//
// This module is PURE: zero dependencies beyond ./jcs.mjs and the hash logic
// imported (NOT duplicated — DRY) from ./validate.mjs. NO DOM, NO browser
// globals, NO three.js. It is the one place the forward/inverse functions
// live; the browser card (src/generate.mjs), the tests, and CI all import
// THIS — they never re-derive an encoding. A divergence is therefore
// structurally impossible: there is one definition.
//
// Each channel below documents: the source value it carries, the forward
// function value -> visualParam, and its exact inverse visualParam -> value.
// Constants are embedded in the generated page's JSON islands so the
// encoding is self-describing and a third party can re-derive it.

import { canonicalize } from "./jcs.mjs";
import { computeHash } from "./validate.mjs";

// Re-export so callers have ONE import surface for the integrity primitive.
export { canonicalize, computeHash };

// ---------------------------------------------------------------------------
// Encoding constants. Printed verbatim into the page's #ccflex-entry-derived
// island so the page is self-describing and every inverse is re-derivable.
// ---------------------------------------------------------------------------
export const ENCODING = Object.freeze({
  // Particle field: one rendered point per BUCKET tokens. The residue
  // (totalTokens % BUCKET, < BUCKET) is DISCLOSED, never hidden (§1.3).
  TOKEN_BUCKET: 100000,
  // Heatmap cell height: scale.y = HEIGHT_K * count, floored at HEIGHT_MIN
  // so a zero/low day is still visible. Height is invertible ONLY for
  // cells above the floor (documented in the inverse).
  HEIGHT_K: 0.0009,
  HEIGHT_MIN: 0.04,
  // Session / streak / peak-hour bars: length = BAR_K * value.
  BAR_K: 0.01,
  // "Nx vs baseline" fun-fact: two coaxial rings, radius ratio == N exactly.
  RING_BASE_RADIUS: 1.0,
  // Heatmap colour ramp — fixed sRGB stops (§1.4). rampLookup is a pure
  // step function of t in [0,1]; its inverse recovers the bucket index,
  // hence value to within one ramp band (disclosed granularity).
  RAMP: Object.freeze([
    "#0b1f12", "#13512b", "#1f7a3d", "#2fb457", "#56e07a",
  ]),
});

// ---------------------------------------------------------------------------
// mulberry32 — seeded RNG (drafts/ccflex-threejs-research.md §1.5). Layout is
// seeded, never value-derived: shape = aesthetic, population = truth. Pure,
// deterministic; same seed -> identical sequence -> pixel-stable scene.
// ---------------------------------------------------------------------------
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A stable integer seed derived purely from the entry's integrity hash, so
// the layout is reproducible from the published JSON alone (no Date.now()).
export function seedFromEntry(entry) {
  const h = entry?.integrity?.hash;
  if (typeof h !== "string" || h.length < 8) return 1984;
  return parseInt(h.slice(0, 8), 16) >>> 0;
}

// ---------------------------------------------------------------------------
// Channel: TOKEN PARTICLES.
//   forward: tokens -> integer point count = floor(tokens / BUCKET)
//   inverse: count   -> tokens lower bound  = count * BUCKET
// Lossy by exactly the disclosed residue (< BUCKET). Round-trip is exact
// when tokens is a multiple of BUCKET; otherwise inverse recovers the
// floor, and parity tolerates the residue band (documented, not hidden).
// ---------------------------------------------------------------------------
export function tokensToParticleCount(tokens) {
  return Math.floor(tokens / ENCODING.TOKEN_BUCKET);
}
export function particleCountToTokens(count) {
  return count * ENCODING.TOKEN_BUCKET;
}

// ---------------------------------------------------------------------------
// Channel: HEATMAP CELL HEIGHT.
//   forward: count -> y-scale = max(HEIGHT_MIN, HEIGHT_K * count)
//   inverse: y-scale -> count = yScale / HEIGHT_K   (valid above the floor)
// Invertible exactly while HEIGHT_K * count >= HEIGHT_MIN. Below the floor
// the height is clamped (a deliberate visibility choice), so the inverse is
// only asserted for cells the forward fn did not clamp — verifyParity
// checks the clamp branch explicitly rather than pretending invertibility.
// ---------------------------------------------------------------------------
export function countToHeight(count) {
  return Math.max(ENCODING.HEIGHT_MIN, ENCODING.HEIGHT_K * count);
}
export function heightToCount(yScale) {
  return yScale / ENCODING.HEIGHT_K;
}
export function heightIsClamped(count) {
  return ENCODING.HEIGHT_K * count < ENCODING.HEIGHT_MIN;
}

// ---------------------------------------------------------------------------
// Channel: SCALAR BARS (sessions, streak days, peak-hour span).
//   forward: value -> length = BAR_K * value
//   inverse: length -> value = length / BAR_K        (exact)
// ---------------------------------------------------------------------------
export function valueToBarLength(value) {
  return ENCODING.BAR_K * value;
}
export function barLengthToValue(length) {
  return length / ENCODING.BAR_K;
}

// ---------------------------------------------------------------------------
// Channel: "Nx vs baseline" RING RATIO.
//   forward: ratio -> outer radius = RING_BASE_RADIUS * ratio (inner = base)
//   inverse: outerRadius -> ratio  = outerRadius / RING_BASE_RADIUS (exact)
// ---------------------------------------------------------------------------
export function ratioToOuterRadius(ratio) {
  return ENCODING.RING_BASE_RADIUS * ratio;
}
export function outerRadiusToRatio(outerRadius) {
  return outerRadius / ENCODING.RING_BASE_RADIUS;
}

// ---------------------------------------------------------------------------
// Channel: HEATMAP CELL COLOUR — pure step ramp.
//   forward: t in [0,1] -> ramp band index -> sRGB hex
//   inverse: hex        -> band index (exact; value to within one band,
//            the disclosed colour granularity — height carries the exact
//            value, colour is the redundant second channel per design §4).
// ---------------------------------------------------------------------------
export function rampIndex(t) {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const idx = Math.floor(clamped * ENCODING.RAMP.length);
  return idx >= ENCODING.RAMP.length ? ENCODING.RAMP.length - 1 : idx;
}
export function rampLookup(t) {
  return ENCODING.RAMP[rampIndex(t)];
}
export function rampHexToIndex(hex) {
  return ENCODING.RAMP.indexOf(String(hex).toLowerCase());
}

// The inverse-mapping table: every visual channel, its forward + inverse,
// for documentation, the page, the tests, and CI to consume identically.
export const CHANNELS = Object.freeze({
  tokenParticles: { forward: tokensToParticleCount, inverse: particleCountToTokens },
  cellHeight: { forward: countToHeight, inverse: heightToCount },
  scalarBar: { forward: valueToBarLength, inverse: barLengthToValue },
  ringRatio: { forward: ratioToOuterRadius, inverse: outerRadiusToRatio },
  cellColour: { forward: rampLookup, inverse: rampHexToIndex },
});

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Pull the canonical numeric facts out of a validated entry. Optional
// fields degrade to an explicit null (never a fabricated figure, per
// design §7.2 — unknown -> null token, not invention).
export function extractFacts(entry) {
  const s = entry?.stats ?? {};
  return {
    totalTokens: num(s.totalTokens?.value),
    sessions: num(s.sessions?.value),
    currentStreak: num(s.streak?.currentDays),
    longestStreak: num(s.streak?.longestDays),
    peakSpan:
      s.peakHour && num(s.peakHour.endHour) !== null && num(s.peakHour.startHour) !== null
        ? s.peakHour.endHour - s.peakHour.startHour
        : null,
    heatmap: Array.isArray(s.heatmap) ? s.heatmap : [],
    maxCount: Array.isArray(s.heatmap) && s.heatmap.length
      ? Math.max(...s.heatmap.map((d) => d.count))
      : 0,
    funFacts: Array.isArray(s.funFacts) ? s.funFacts : [],
  };
}

function pushMismatch(out, channel, detail) {
  out.push({ channel, detail });
}

function checkHeatmapParity(facts, embedded, mismatches) {
  const eHeat = Array.isArray(embedded?.stats?.heatmap) ? embedded.stats.heatmap : [];
  if (facts.heatmap.length !== eHeat.length) {
    pushMismatch(mismatches, "heatmap", `length ${facts.heatmap.length} != ${eHeat.length}`);
    return;
  }
  const maxC = facts.maxCount || 1;
  for (let i = 0; i < facts.heatmap.length; i++) {
    const count = facts.heatmap[i].count;
    if (count !== eHeat[i].count) {
      pushMismatch(mismatches, "heatmap", `cell ${i} count ${count} != ${eHeat[i].count}`);
      continue;
    }
    const yScale = countToHeight(count);
    if (heightIsClamped(count)) {
      if (yScale !== ENCODING.HEIGHT_MIN) {
        pushMismatch(mismatches, "cellHeight", `cell ${i} clamp expected ${ENCODING.HEIGHT_MIN}`);
      }
    } else if (Math.abs(heightToCount(yScale) - count) > maxC * 1e-6) {
      pushMismatch(mismatches, "cellHeight", `cell ${i} height not invertible`);
    }
    const t = count / maxC;
    if (rampHexToIndex(rampLookup(t)) !== rampIndex(t)) {
      pushMismatch(mismatches, "cellColour", `cell ${i} ramp not invertible`);
    }
  }
}

// verifyParity(entry, embeddedJson) -> { ok, mismatches[] }
//
// The core integrity check. Asserts the geometry the page WOULD render
// (re-derived here via the same forward fns the page uses) round-trips
// through each documented inverse AND that the entry's facts equal the
// independently-embedded JSON island. Either side edited without the other
// -> mismatch. This is the bidirectional "verify canonical, not claimed"
// discipline applied to a visualisation.
export function verifyParity(entry, embeddedJson) {
  const mismatches = [];
  const facts = extractFacts(entry);
  const eFacts = extractFacts(embeddedJson);

  for (const key of ["totalTokens", "sessions", "currentStreak", "longestStreak"]) {
    if (facts[key] !== eFacts[key]) {
      pushMismatch(mismatches, key, `entry ${facts[key]} != embedded ${eFacts[key]}`);
    }
  }

  if (facts.totalTokens !== null) {
    const pc = tokensToParticleCount(facts.totalTokens);
    if (particleCountToTokens(pc) > facts.totalTokens ||
        facts.totalTokens - particleCountToTokens(pc) >= ENCODING.TOKEN_BUCKET) {
      pushMismatch(mismatches, "tokenParticles", "particle count residue out of disclosed band");
    }
  }
  for (const [key, ch] of [["sessions", "scalarBar"], ["currentStreak", "scalarBar"]]) {
    const v = facts[key];
    if (v === null) continue;
    if (Math.abs(barLengthToValue(valueToBarLength(v)) - v) > 1e-9) {
      pushMismatch(mismatches, ch, `${key} bar not invertible`);
    }
  }
  for (const ff of facts.funFacts) {
    const r = num(ff.value);
    if (r === null) continue;
    if (Math.abs(outerRadiusToRatio(ratioToOuterRadius(r)) - r) > 1e-9) {
      pushMismatch(mismatches, "ringRatio", `funFact ${ff.id} ring not invertible`);
    }
  }

  checkHeatmapParity(facts, embeddedJson, mismatches);

  return { ok: mismatches.length === 0, mismatches };
}
