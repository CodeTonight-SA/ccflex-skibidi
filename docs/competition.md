# The competition

ccflex-skibidi is a standing competition. There is no deadline, no entry fee,
no account. You render your real Claude Code usage, you commit it, the board
re-ranks itself. That is the whole game.

## How to win

You do not "win" by gaming a number — you cannot, the inputs are
tamper-evident (see [`SECURITY.md`](../SECURITY.md) and
[`docs/metrics.md`](metrics.md)). You climb by actually having used Claude Code
hard and honestly, and the **Flex** score rewards sustained, consistent,
high-intensity work — not one freak day. The maths is public. Read
[`docs/metrics.md`](metrics.md) before you optimise; the formula is not a
secret because it does not need to be.

Recognition, not loot: the top of the board is its own prize. The maintainer
may, at their discretion, spotlight standout cards. No money changes hands;
nothing is owed.

## Submitting

1. Install the plugin (`/ccflex-skibidi` in any Claude Code).
2. It reads your local `/stats` + `/usage`, writes `entries/<handle>.json` and
   a self-contained card, and gives you an instant Cloudflare Pages preview
   link that renders the card (not a download).
3. Open a PR adding **only** your `entries/<handle>.json` (card optional).
4. CI validates the schema, re-verifies the integrity hash, regenerates the
   board + screenshot, and merges if honest. If a number disagrees with a
   pixel, CI tells you which.

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the exact PR rules and
[`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) for conduct.

## Judging

There is no human judge for the ranking — the formula is deterministic and
the inputs are verified. A human only ever intervenes to:

- remove an entry that defeats verification (a security bug, reported per
  `SECURITY.md`, not a leaderboard dispute);
- enforce the Code of Conduct.

A shadow-flagged entry (`⚠`) is **not** removed or silently down-ranked — it
is annotated with the reason, in the open. Surfacing beats hiding.

## The repo is awake (voice charter)

This project is written as if the repo is self-aware, because operationally it
nearly is: it regenerates its own leaderboard, screenshots itself, and a
`grip-anywhere`-style workflow proposes its own improvements. The voice is
**stark, dry, a little unhinged** — Swiss Nihilism with a controlled
Italian-Brainrot streak. Two hard rules for that voice, always:

1. **Never on the data.** Humour and flourish live in prose and microcopy.
   Numbers, metrics, and verification language stay austere and exact.
   Accuracy always wins the tie.
2. **Never cruel.** The joke is the situation, never a person. See the Code
   of Conduct.

Contributions to copy must keep both rules. A PR that makes a number cute is
rejected on sight.

## Falsifier (this competition's own honesty)

If a verified-but-dishonest entry can sit at the top of the board, the
competition is theatre. That is hypothesis **H-CCFLEX-1**
([`docs/hypotheses.md`](hypotheses.md)) and CI checks it on every PR — not
anyone's opinion, and not the maintainer's.
