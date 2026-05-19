---
name: ccflex-skibidi
description: Read the operator's real local Claude Code /stats and /usage, build a schema-valid entries/<handle>.json from the actual numbers, set integrity via src/validate.mjs --hash, generate the verifiable WebGL card via src/generate.mjs, optionally preview via Vanish, then open the entry PR per CONTRIBUTING.md. Accuracy and the honesty contract are paramount; never fabricate numbers.
triggers:
  - /ccflex-skibidi
  - "ccflex"
  - "flex my claude code stats"
  - "put my stats on the board"
---

# ccflex-skibidi Skill

Backs the `/ccflex-skibidi` command. Turns the operator's **real** Claude Code
usage into a verifiable, self-contained flex card and an entry PR. The card is
pure static HTML — polyglot by construction, no language or runtime
assumptions.

## Honesty contract (the reason this project means anything)

This skill exists to make a leaderboard that is true. Accuracy is the whole
product:

- Use **only** numbers Claude Code reports for the operator. Never fabricate,
  estimate-as-exact, or tune a value to rank higher.
- Rounded displays (`265.1m`, `1.0k`) → keep the verbatim `display` string and
  set `exact: false` on the de-rounded integer `value`. Precise figures →
  `exact: true`.
- The `heatmap` is OPTIONAL — **omit it entirely** rather than invent per-day
  counts.
- Every board metric is derived only from verified `entry.json` fields. The
  ranking maths is open and reproducible; there is no field that buys rank.
- Entries are untrusted content: schema-valid data only, never executable code.

## Flow

1. **Capture real numbers** — operator runs `/stats` and `/usage`; record
   favourite model, total tokens, sessions, active days (`active`/`of`),
   current + longest streak, and (only if real) longest-session minutes, peak
   hour, fun-fact multipliers (`~` ⇒ `approx: true`).
2. **Locate `$REPO`** — the `ccflex-skibidi` root holding `src/generate.mjs`,
   `src/validate.mjs`, and `schema/entry.schema.json`.
3. **Write `$REPO/entries/<handle>.json`** — schema-valid per
   `schema/entry.schema.json`: `schemaVersion: "1.0.0"`, `contributor`,
   `source` (`tool: "claude-code"`, `command` ∈ `/stats` `/usage`
   `/stats+/usage`, `window.days` 1..3660), `stats`, `integrity` (hash
   placeholder `"0".repeat(64)`).
4. **Set integrity from real content**:
   `node src/validate.mjs --hash entries/<handle>.json` → write the 64-hex
   digest into `integrity.hash` → `node src/validate.mjs entries/<handle>.json`
   must print `integrity verified`. On failure, fix the **data**, never the
   verifier.
5. **Generate the card**:
   `node src/generate.mjs entries/<handle>.json site/cards/<handle>.html` — one
   self-contained HTML file; its `window.verify()` recomputes the hash and
   asserts geometry ↔ JSON ↔ DOM parity.
6. **Optional Vanish preview** — if `scripts/vanish-preview.sh` exists in
   `$REPO`, offer it for an instant public preview link; skip silently if
   absent (it is optional and may be owned elsewhere).
7. **Open the entry PR** per `$REPO/CONTRIBUTING.md` — PR adds **only**
   `entries/<handle>.json` (and optionally the unmodified
   `site/cards/<handle>.html`). Never edit CI, the verifier, the ranking maths,
   or other entries in the same PR; a mixed PR will be asked to split.

## Verification points

- The entry validates: `node src/validate.mjs entries/<handle>.json` exits 0.
- Generation succeeds: `node src/generate.mjs entries/<handle>.json` produces
  HTML containing the entry and integrity JSON islands.
- The PR diff contains only the entry (and optional generated card).
