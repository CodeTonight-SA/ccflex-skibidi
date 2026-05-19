# ccflex-skibidi plugin

A Claude Code plugin that reads **your real** `/stats` and `/usage`, renders
them as a verifiable WebGL flex card, and opens the entry pull request for the
[ccflex-skibidi](https://github.com/CodeTonight-SA/ccflex-skibidi) board.

Numbers come from your own machine. Nothing is fabricated — rounded displays
are marked `exact: false`, and missing data is omitted, never invented.

## What you get

- `/ccflex-skibidi` slash command + a backing skill.
- A schema-valid `entries/<handle>.json` written from your actual numbers.
- A self-contained static HTML card (three.js via pinned CDN, no build step,
  offline-capable) whose every pixel is a pure function of the entry, with an
  embedded `window.verify()` that recomputes the integrity hash and asserts
  geometry ↔ JSON ↔ DOM parity.
- An entry PR opened per the project's `CONTRIBUTING.md`.

## Install (any Claude Code install)

This plugin directory is the installable unit. Its manifest is
`.claude-plugin/plugin.json`.

1. Have a local clone of the `ccflex-skibidi` repo (it contains
   `src/generate.mjs`, `src/validate.mjs`, and `schema/entry.schema.json` —
   the contract this plugin drives). Node.js >= 18 is required; there are no
   runtime dependencies.

2. Make the plugin available to Claude Code via any supported path:

   - **Plugin marketplace / `claude plugin` workflow**: add this repository as
     a plugin source and install `ccflex-skibidi`. Claude Code reads
     `plugin/.claude-plugin/plugin.json` and wires the command + skill from
     the `commands/` and `skills/` directories named in the manifest.

   - **Manual / project-local**: copy `plugin/commands/ccflex-skibidi.md` into
     your Claude Code commands directory and
     `plugin/skills/ccflex-skibidi/` into your skills directory (e.g.
     `~/.claude/commands/` and `~/.claude/skills/`). The command and skill are
     plain markdown and need no build.

3. Verify the manifest is well-formed:

   ```bash
   node -e "JSON.parse(require('fs').readFileSync('plugin/.claude-plugin/plugin.json'))"
   ```

## Run

In a Claude Code session, with the `ccflex-skibidi` repo checked out:

```text
/ccflex-skibidi
```

Then follow the prompts: paste your real `/stats` + `/usage`, confirm the
handle, let it write and validate the entry, generate the card, optionally
preview via Vanish, and open the PR.

## The honesty contract

- Only the numbers Claude Code reports for **you**.
- Rounded source displays → `exact: false`, verbatim `display` kept.
- No per-day data → `heatmap` omitted entirely.
- Every board metric derives only from verified `entry.json` fields. The
  ranking maths is open; no field buys rank.
