// Zero-dependency validator for a ccflex-skibidi entry.
//
// Purpose-built for schema/entry.schema.json (NOT a general JSON-Schema engine
// — KISS + minimal supply-chain surface, per SECURITY.md). It enforces the
// same constraints AND recomputes the integrity hash so a tampered entry
// fails loudly. Entries are untrusted: parsed, never executed.
//
// CLI:
//   node src/validate.mjs <entry.json>          -> validate (exit 0 / 1)
//   node src/validate.mjs --hash <entry.json>   -> print canonical integrity hash
//
// API: validateEntry(obj) -> { ok, errors[], computedHash }

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { canonicalize } from "./jcs.mjs";

const HANDLE_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,38})$/;
const HASH_RE = /^[a-f0-9]{64}$/;
const FUNFACT_ID_RE = /^[a-z0-9-]{1,40}$/;
const MODELS_CMD = ["/stats", "/usage", "/stats+/usage"];

const isInt = (n) => Number.isInteger(n);
const isStr = (s) => typeof s === "string";
const isObj = (o) => o !== null && typeof o === "object" && !Array.isArray(o);

function checkExactKeys(errs, path, obj, allowed) {
  if (!isObj(obj)) { errs.push(`${path}: expected object`); return false; }
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) errs.push(`${path}.${k}: unexpected property (additionalProperties:false)`);
  }
  return true;
}
function req(errs, path, obj, keys) {
  for (const k of keys) if (!(k in obj)) errs.push(`${path}.${k}: required`);
}

function checkMetric(errs, path, m) {
  if (!checkExactKeys(errs, path, m, ["value", "display", "exact"])) return;
  req(errs, path, m, ["value", "display", "exact"]);
  if ("value" in m && (!isInt(m.value) || m.value < 0)) errs.push(`${path}.value: integer >= 0`);
  if ("display" in m && (!isStr(m.display) || m.display.length > 24)) errs.push(`${path}.display: string <=24`);
  if ("exact" in m && typeof m.exact !== "boolean") errs.push(`${path}.exact: boolean`);
}

function checkContributor(errs, c) {
  if (!checkExactKeys(errs, "contributor", c, ["handle", "displayName", "url"])) return;
  req(errs, "contributor", c, ["handle"]);
  if ("handle" in c && (!isStr(c.handle) || !HANDLE_RE.test(c.handle))) errs.push("contributor.handle: bad shape");
  if ("displayName" in c && (!isStr(c.displayName) || c.displayName.length > 80)) errs.push("contributor.displayName: string <=80");
  if ("url" in c && (!isStr(c.url) || c.url.length > 256)) errs.push("contributor.url: uri string <=256");
}

function checkSource(errs, s) {
  if (!checkExactKeys(errs, "source", s, ["tool", "command", "capturedAt", "window"])) return;
  req(errs, "source", s, ["tool", "command", "window"]);
  if (s.tool !== "claude-code") errs.push("source.tool: must be 'claude-code'");
  if (!MODELS_CMD.includes(s.command)) errs.push("source.command: enum");
  if ("capturedAt" in s && (!isStr(s.capturedAt) || Number.isNaN(Date.parse(s.capturedAt)))) errs.push("source.capturedAt: date-time");
  if (isObj(s.window)) {
    checkExactKeys(errs, "source.window", s.window, ["days"]);
    if (!isInt(s.window.days) || s.window.days < 1 || s.window.days > 3660) errs.push("source.window.days: 1..3660");
  } else errs.push("source.window: object");
}

function checkStatsScalars(errs, st) {
  if (!isStr(st.favoriteModel) || st.favoriteModel.length > 48) errs.push("stats.favoriteModel: string <=48");
  checkMetric(errs, "stats.totalTokens", st.totalTokens);
  checkMetric(errs, "stats.sessions", st.sessions);
  if (isObj(st.activeDays)) {
    checkExactKeys(errs, "stats.activeDays", st.activeDays, ["active", "of"]);
    if (!isInt(st.activeDays.active) || st.activeDays.active < 0) errs.push("stats.activeDays.active: int >=0");
    if (!isInt(st.activeDays.of) || st.activeDays.of < 1) errs.push("stats.activeDays.of: int >=1");
    if (isInt(st.activeDays.active) && isInt(st.activeDays.of) && st.activeDays.active > st.activeDays.of) {
      errs.push("stats.activeDays: active cannot exceed of");
    }
  } else errs.push("stats.activeDays: object");
  if (isObj(st.streak)) {
    checkExactKeys(errs, "stats.streak", st.streak, ["currentDays", "longestDays"]);
    if (!isInt(st.streak.currentDays) || st.streak.currentDays < 0) errs.push("stats.streak.currentDays: int >=0");
    if (!isInt(st.streak.longestDays) || st.streak.longestDays < 0) errs.push("stats.streak.longestDays: int >=0");
    if (isInt(st.streak.currentDays) && isInt(st.streak.longestDays) && st.streak.currentDays > st.streak.longestDays) {
      errs.push("stats.streak: current cannot exceed longest");
    }
  } else errs.push("stats.streak: object");
}

function checkStatsOptional(errs, st) {
  if ("longestSessionMinutes" in st && (!isInt(st.longestSessionMinutes) || st.longestSessionMinutes < 0)) {
    errs.push("stats.longestSessionMinutes: int >=0");
  }
  if ("peakHour" in st) {
    const p = st.peakHour;
    if (!isObj(p)) errs.push("stats.peakHour: object");
    else {
      checkExactKeys(errs, "stats.peakHour", p, ["startHour", "endHour"]);
      if (!isInt(p.startHour) || p.startHour < 0 || p.startHour > 23) errs.push("stats.peakHour.startHour: 0..23");
      if (!isInt(p.endHour) || p.endHour < 1 || p.endHour > 24) errs.push("stats.peakHour.endHour: 1..24");
    }
  }
  if ("heatmap" in st) {
    if (!Array.isArray(st.heatmap) || st.heatmap.length > 3660) errs.push("stats.heatmap: array <=3660");
    else st.heatmap.forEach((d, i) => {
      checkExactKeys(errs, `stats.heatmap[${i}]`, d, ["date", "count"]);
      if (!isStr(d.date) || Number.isNaN(Date.parse(d.date))) errs.push(`stats.heatmap[${i}].date: date`);
      if (!isInt(d.count) || d.count < 0) errs.push(`stats.heatmap[${i}].count: int >=0`);
    });
  }
  if ("funFacts" in st) {
    if (!Array.isArray(st.funFacts) || st.funFacts.length > 16) errs.push("stats.funFacts: array <=16");
    else st.funFacts.forEach((f, i) => {
      checkExactKeys(errs, `stats.funFacts[${i}]`, f, ["id", "label", "value", "approx", "baseline"]);
      if (!isStr(f.id) || !FUNFACT_ID_RE.test(f.id)) errs.push(`stats.funFacts[${i}].id: bad shape`);
      if (!isStr(f.label) || f.label.length > 80) errs.push(`stats.funFacts[${i}].label: string <=80`);
      if (typeof f.value !== "number" || !Number.isFinite(f.value)) errs.push(`stats.funFacts[${i}].value: finite number`);
      if (typeof f.approx !== "boolean") errs.push(`stats.funFacts[${i}].approx: boolean`);
      if ("baseline" in f && (!isStr(f.baseline) || f.baseline.length > 24)) errs.push(`stats.funFacts[${i}].baseline: string <=24`);
    });
  }
}

function checkStats(errs, st) {
  const allowed = ["favoriteModel", "totalTokens", "sessions", "activeDays", "streak",
    "longestSessionMinutes", "peakHour", "heatmap", "funFacts"];
  if (!checkExactKeys(errs, "stats", st, allowed)) return;
  req(errs, "stats", st, ["favoriteModel", "totalTokens", "sessions", "activeDays", "streak"]);
  checkStatsScalars(errs, st);
  checkStatsOptional(errs, st);
}

/** Recompute the integrity hash over the canonical {contributor,source,stats}. */
export function computeHash(entry) {
  const subject = { contributor: entry.contributor, source: entry.source, stats: entry.stats };
  return createHash("sha256").update(canonicalize(subject), "utf8").digest("hex");
}

export function validateEntry(entry) {
  const errs = [];
  let computedHash = null;
  if (!isObj(entry)) return { ok: false, errors: ["root: expected object"], computedHash };
  const topAllowed = ["schemaVersion", "contributor", "source", "stats", "integrity"];
  checkExactKeys(errs, "(root)", entry, topAllowed);
  req(errs, "(root)", entry, topAllowed);
  if (entry.schemaVersion !== "1.0.0") errs.push("schemaVersion: must be '1.0.0'");
  if ("contributor" in entry) checkContributor(errs, entry.contributor);
  if ("source" in entry) checkSource(errs, entry.source);
  if ("stats" in entry) checkStats(errs, entry.stats);
  if (isObj(entry.integrity)) {
    checkExactKeys(errs, "integrity", entry.integrity, ["algo", "canonicalization", "hash"]);
    if (entry.integrity.algo !== "sha256") errs.push("integrity.algo: must be 'sha256'");
    if (entry.integrity.canonicalization !== "rfc8785") errs.push("integrity.canonicalization: must be 'rfc8785'");
    if (!isStr(entry.integrity.hash) || !HASH_RE.test(entry.integrity.hash)) errs.push("integrity.hash: 64 hex chars");
    if (errs.length === 0 || !errs.some((e) => e.startsWith("stats") || e.startsWith("source") || e.startsWith("contributor"))) {
      try {
        computedHash = computeHash(entry);
        if (HASH_RE.test(String(entry.integrity.hash)) && entry.integrity.hash !== computedHash) {
          errs.push(`integrity.hash: does not match recomputed canonical hash (tamper-evident). expected ${computedHash}`);
        }
      } catch (e) { errs.push(`integrity: cannot canonicalize — ${e.message}`); }
    }
  } else errs.push("integrity: object");
  return { ok: errs.length === 0, errors: errs, computedHash };
}

// --- CLI ---
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const hashOnly = args[0] === "--hash";
  const file = hashOnly ? args[1] : args[0];
  if (!file) { console.error("usage: validate.mjs [--hash] <entry.json>"); process.exit(2); }
  let entry;
  try { entry = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { console.error(`parse error: ${e.message}`); process.exit(2); }
  if (hashOnly) { console.log(computeHash(entry)); process.exit(0); }
  const { ok, errors } = validateEntry(entry);
  if (ok) { console.log(`OK  ${file}  (integrity verified)`); process.exit(0); }
  console.error(`FAIL  ${file}`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
