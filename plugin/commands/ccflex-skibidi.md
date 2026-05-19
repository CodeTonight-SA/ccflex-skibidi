---
description: Read your real local Claude Code /stats and /usage, build a schema-valid entry from the actual numbers, generate a verifiable WebGL flex card, and open the entry PR. No fabricated numbers.
disable-model-invocation: false
---

# /ccflex-skibidi

Put your real Claude Code usage on the board. This command reads the numbers
Claude Code reports for **you**, writes a schema-valid `entries/<handle>.json`,
generates a self-contained HTML card whose every pixel is a pure function of
those numbers, and opens the contribution pull request.

The output is plain static HTML — no language or runtime assumptions, polyglot
by construction.

## The honesty contract (non-negotiable)

- Use **only** the numbers Claude Code actually shows you. Never invent,
  estimate-as-exact, or hand-tune a value to rank higher.
- Claude Code often shows **rounded** displays (e.g. `265.1m`, `1.0k`). When a
  value is de-rounded from a rounded display, set `exact: false` and keep the
  verbatim `display` string. When it is precise, set `exact: true`.
- The per-day `heatmap` is OPTIONAL. If you do not have real per-day data,
  **omit `heatmap` entirely** — never fabricate daily counts to fill it.
- Every board metric is derived only from verified `entry.json` fields. There
  is no field you can add to climb.

## Steps

1. **Read the real numbers.** Ask the operator to run `/stats` and `/usage` in
   their Claude Code session and paste the output, or surface it directly.
   Capture, verbatim where rounded: favourite model, total tokens, sessions,
   active days (`active`/`of`), current and longest streak, and (optionally)
   longest session minutes, peak hour, and any fun-fact multipliers (note the
   `~` → `approx: true`).

2. **Pick the handle and repo root.** The handle is GitHub-handle-shaped
   (`^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,38})$`) and becomes the entry filename
   stem. Determine the `ccflex-skibidi` repo root (the directory containing
   `src/generate.mjs` and `schema/entry.schema.json`); call it `$REPO`.

3. **Write a schema-valid entry** to `$REPO/entries/<handle>.json`. Required
   shape (see `$REPO/schema/entry.schema.json` — the single source of truth):

   ```json
   {
     "schemaVersion": "1.0.0",
     "contributor": { "handle": "<handle>", "displayName": "<name>", "url": "<profile-url>" },
     "source": { "tool": "claude-code", "command": "/stats+/usage", "capturedAt": "<ISO-8601>", "window": { "days": <int 1..3660> } },
     "stats": {
       "favoriteModel": "<string>",
       "totalTokens": { "value": <int>, "display": "<verbatim>", "exact": <bool> },
       "sessions":    { "value": <int>, "display": "<verbatim>", "exact": <bool> },
       "activeDays":  { "active": <int>, "of": <int> },
       "streak":      { "currentDays": <int>, "longestDays": <int> }
     },
     "integrity": { "algo": "sha256", "canonicalization": "rfc8785", "hash": "<filled in step 4>" }
   }
   ```

   `command` must be one of `/stats`, `/usage`, `/stats+/usage`. Add the
   optional `longestSessionMinutes`, `peakHour`, `heatmap`, `funFacts` only
   when you have the real data for them. Use `"hash": "0".repeat(64)` as a
   placeholder before step 4.

4. **Set integrity from the real content.** Compute the canonical hash and
   write it into `integrity.hash`:

   ```bash
   cd "$REPO"
   node src/validate.mjs --hash entries/<handle>.json
   ```

   Put that 64-hex digest into `integrity.hash`, then prove it validates:

   ```bash
   node src/validate.mjs entries/<handle>.json   # must print "OK ... (integrity verified)"
   ```

   If validation fails, the message names exactly which field disagrees — fix
   the data (never the verifier) and recompute the hash.

5. **Generate the card.**

   ```bash
   node src/generate.mjs entries/<handle>.json site/cards/<handle>.html
   ```

   The card is one self-contained static HTML file (three.js via pinned CDN
   importmap, no build step, offline-capable). Its embedded `window.verify()`
   recomputes the hash and asserts geometry ↔ JSON ↔ DOM parity.

6. **Offer a Vanish preview (optional).** If `scripts/vanish-preview.sh`
   exists in `$REPO`, offer to run it on the generated card to get an instant
   public preview link. If the script is absent, skip this step silently — it
   is optional and another part of the project may own it.

7. **Open the entry PR** per `$REPO/CONTRIBUTING.md`. The PR adds **only**
   `entries/<handle>.json` (and optionally the generated, unmodified
   `site/cards/<handle>.html`). Never touch CI, the verifier, the ranking
   maths, or other contributors' entries in the same PR.

   ```bash
   cd "$REPO"
   git checkout -b entry/<handle>
   git add entries/<handle>.json site/cards/<handle>.html
   git commit -m "entry: add <handle>"
   git push -u origin entry/<handle>
   gh pr create --title "entry: <handle>" --body "$(cat <<'EOF'
## Summary
- Adds my verified Claude Code usage entry.

## Honesty
- [x] Numbers are exactly what Claude Code reported for me.
- [x] Rounded displays use exact:false; heatmap omitted unless real.
- [x] `node src/validate.mjs entries/<handle>.json` prints "integrity verified".
EOF
)"
   ```

CI then re-validates the schema, runs `verify()` parity, and merges only if
every number agrees with every pixel.
