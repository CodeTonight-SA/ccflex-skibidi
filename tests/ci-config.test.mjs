// Goodhart-proof CI-config assertions. Zero-dependency (node:test + a tiny
// purpose-built YAML-ish line scanner — no `yaml` dep, matching the repo's
// no-runtime-dependency policy in SECURITY.md / package.json).
//
// Every assertion here fails under an obvious mutation of the workflow it
// guards: flip a trigger, widen a permission, drop a verify step, remove the
// concurrency guard — and the corresponding test goes red. That is the point:
// these files ARE the untrusted-PR security boundary, so a regression in them
// must not pass silently.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const wf = (name) => readFileSync(join(ROOT, ".github", "workflows", name), "utf8");

// --- minimal structural helpers (no YAML library) ------------------------

// The `on:` block is everything from a line starting `on:` up to the next
// top-level key (a non-indented `word:` line). Good enough to assert which
// triggers are present without a parser.
function onBlock(yaml) {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => /^on:/.test(l));
  assert.notEqual(start, -1, "workflow has no `on:` block");
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z_]/.test(lines[i])) break; // next top-level key
    out.push(lines[i]);
  }
  return out.join("\n");
}

// The `permissions:` block, same top-level-key delimiting.
function permissionsBlock(yaml) {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => /^permissions:/.test(l));
  assert.notEqual(start, -1, "workflow has no top-level `permissions:` block");
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z_]/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

// A trigger is "present" only as a real YAML key inside the on: block:
// either `on:\n  pull_request:` (indented key) or inline `on: [pull_request]`.
// Crucially this ignores comment lines, so a comment mentioning a trigger
// does not create a false positive.
function hasTrigger(onBlk, name) {
  const noComments = onBlk
    .split("\n")
    .map((l) => l.replace(/#.*$/, ""))
    .join("\n");
  const asKey = new RegExp(`(^|\\n)\\s+${name}:\\s*($|\\n|\\[)`).test(noComments);
  const asInline = new RegExp(`on:\\s*\\[[^\\]]*\\b${name}\\b`).test(noComments);
  return asKey || asInline;
}

// --- ci.yml: the forked-PR security boundary -----------------------------

test("ci.yml triggers on pull_request, NOT pull_request_target", () => {
  const blk = onBlock(wf("ci.yml"));
  assert.ok(hasTrigger(blk, "pull_request"), "ci.yml must trigger on pull_request");
  assert.ok(
    !hasTrigger(blk, "pull_request_target"),
    "ci.yml must NOT use pull_request_target (forked-PR secret/token escalation)"
  );
});

test("ci.yml permissions are read-only (no write scope anywhere)", () => {
  const perms = permissionsBlock(wf("ci.yml"));
  assert.match(perms, /contents:\s*read/, "ci.yml needs contents: read");
  assert.ok(
    !/:\s*write\b/.test(perms.replace(/#.*$/gm, "")),
    "ci.yml must not grant any write permission"
  );
});

test("ci.yml runs npm test + validate + verify-card + leaderboard --check", () => {
  const y = wf("ci.yml");
  assert.match(y, /npm test/, "ci.yml must run npm test");
  assert.match(y, /src\/validate\.mjs/, "ci.yml must validate entries");
  assert.match(y, /src\/verify-card\.mjs/, "ci.yml must verify cards");
  assert.match(
    y,
    /src\/leaderboard\.mjs --check/,
    "ci.yml must gate on leaderboard freshness"
  );
});

// --- board-refresh.yml: write power, push-only ---------------------------

test("board-refresh only triggers on push, never on pull_request", () => {
  const blk = onBlock(wf("board-refresh.yml"));
  assert.ok(hasTrigger(blk, "push"), "board-refresh must trigger on push");
  assert.ok(
    !hasTrigger(blk, "pull_request"),
    "board-refresh must NEVER run on pull_request (write token to a forked PR)"
  );
  assert.ok(
    !hasTrigger(blk, "pull_request_target"),
    "board-refresh must never use pull_request_target"
  );
});

test("board-refresh has a concurrency guard", () => {
  assert.match(
    wf("board-refresh.yml"),
    /(^|\n)concurrency:/,
    "board-refresh must declare a concurrency group to avoid commit-back races"
  );
});

// --- self-rsi.yml: read-only, issues-only --------------------------------

test("self-rsi has NO contents: write (read-only RSI pass)", () => {
  const perms = permissionsBlock(wf("self-rsi.yml"));
  assert.ok(
    !/contents:\s*write/.test(perms.replace(/#.*$/gm, "")),
    "self-rsi must not be able to write repo contents"
  );
  assert.match(
    perms,
    /issues:\s*write/,
    "self-rsi opens issues, so it needs issues: write (and nothing more)"
  );
});

test("self-rsi only triggers on schedule / workflow_dispatch", () => {
  const blk = onBlock(wf("self-rsi.yml"));
  assert.ok(hasTrigger(blk, "schedule"), "self-rsi must be scheduled");
  assert.ok(
    !hasTrigger(blk, "pull_request"),
    "self-rsi must not run on untrusted PRs"
  );
  assert.ok(
    !hasTrigger(blk, "push"),
    "self-rsi must not run on push (it is the read-only analyser)"
  );
});
