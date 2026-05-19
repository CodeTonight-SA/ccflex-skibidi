# Contributing to ccflex-skibidi

You are here to put your Claude Code usage on the board. Welcome. The rules
are few, and they exist so that the board means something.

## Submit an entry

1. Install the plugin in your Claude Code, run `/ccflex-skibidi`.
2. It generates `entries/<your-handle>.json` (the canonical, schema-valid
   record of your real numbers) and a self-contained HTML card.
3. It offers an instant **Vanish** preview link — look at it.
4. Open a pull request that adds **only** your `entries/<your-handle>.json`
   (and, optionally, your card under `site/cards/<your-handle>.html` if the
   generator produced it).
5. CI validates the schema, runs `verify()` (geometry ↔ JSON ↔ DOM parity),
   regenerates the leaderboard + screenshot, and merges if everything is
   honest. If it is not honest, CI tells you exactly which number disagrees
   with which pixel.

## The honesty contract

- The numbers in your `entry.json` must be the numbers Claude Code reports for
  **you**. The generator reads them directly; do not hand-edit them.
- Every metric on the board is **derived only from verified `entry.json`
  fields**. There is no field you can add to climb. The ranking maths is in
  the open and reproducible.
- Anti-gaming and the exact ranking formula live in
  [`docs/competition.md`](docs/competition.md). Read it before you optimise.

## What a PR may contain

| Allowed | Not allowed |
|---|---|
| `entries/<handle>.json` | Any executable code in your entry |
| `site/cards/<handle>.html` (generator output, unmodified) | Edits to CI, the verifier, or the ranking maths in the same PR |
| A one-line addition to a contributors list, if asked | Edits to other contributors' entries |

Entries are **untrusted content** and are treated as such by CI: they are
parsed, never executed. A PR that mixes an entry with changes to the
verification or scoring machinery will be asked to split.

## Code contributions

Improvements to the generator, design, plugin, or docs are very welcome via
normal PRs. Tests are required and must be able to fail (a test that cannot
fail is worse than no test). Keep changes correct-by-construction; the CI
gate is strict on purpose.

## Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
