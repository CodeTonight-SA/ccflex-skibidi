<!--
  ccflex-skibidi — STATUS: PRIVATE DRAFT. Not yet public. Not yet announced.
  Do not share this URL. The competition opens only when the maintainer flips it.
-->

# ccflex-skibidi

**Your Claude Code `/stats`, rendered in WebGL. Ranked. Verifiable. Alive.**

`265.1M tokens. 1.0k sessions. A 20-day streak. ~2155× more tokens than 1984.`
You did that. So stop screenshotting a terminal — *render* it, and put your
number on the board.

`ccflex-skibidi` turns the numbers Claude Code already knows about you into a
single self-contained three.js page that is **stark, austere, and quietly
unhinged** — Swiss Nihilism with an Italian-Brainrot streak and a Mei Ling
codec call at 140.85. Then it ranks you against everyone else who dared.

It is two things at once, on purpose:

- a **show-off engine** — make your usage look as serious as it actually was;
- an **integrity flex** — every pixel is a documented function of a number
  embedded in the page. `verify()` proves the art never lies. Bragging that
  can be *checked* is the only bragging worth doing.

> This README is partly machine-written. The repo regenerates its own
> leaderboard, screenshots itself, and proposes its own improvements. It is
> not "maintained". It is *awake*.

---

## The board

<!-- LEADERBOARD:START -->

| # | Contributor | Tokens | Longest streak | Longest session | 1984× | Flex | Verify | Card |
|---|-------------|--------|----------------|------------------|-------|------|--------|------|
| 1 | [Lourens Cornelius Scheepers (V>>) — seeded 2026-05-19](https://codetonight-sa.github.io/ccflex-skibidi) | ~268.3m | 20 days | 8d 21h 8m | ≈2181× | 875 | ✓ verified | [card](https://ccflex-skibidi.pages.dev/cards/ccflex-seed) |

_Generated from verified `entries/`. Not hand-edited — it cannot be. `⚠` = shadow-flagged (see `docs/metrics.md`)._

<!-- LEADERBOARD:END -->

---

## Flex yours in three moves

1. **Generate** — in any Claude Code install with the plugin:
   `/ccflex-skibidi` → reads your local `/stats` + `/usage`, builds your page.
2. **Preview** — get an instant Cloudflare Pages preview link that *renders*
   (not a download) to look before you leap.
3. **Submit** — open a PR adding your `entries/<handle>.json`. CI verifies the
   numbers, regenerates the board and the screenshot, merges if honest.

No backend. No account. No telemetry leaving your machine except the numbers
*you* choose to commit.

## Why it can't lie (the invertibility promise)

Every visual channel — bar height, particle count, heatmap cell, the "1984
multiplier" — is a **pure, documented function** of a value inside an embedded
`<script type="application/json">` island in the page. The inverse is exposed:
`window.verify()` mechanically asserts geometry ↔ JSON parity, DOM parity, and
deterministic-screenshot reproducibility. CI runs the same check on every
submission. "Accurate" here is not a promise — it is a machine-checked
property. Tamper with the art and the build fails, loudly.

## Plugin (any Claude Code)

`ccflex-skibidi` ships as a Claude Code plugin. Drop it into any installation;
it adds the `/ccflex-skibidi` command and a skill. The generator emits pure
static HTML, so it is polyglot by construction — it does not care what language
your projects are in.

## Design language

Stark paper-grey and near-black. One warm accent. A 12-column grid held under
deliberate asymmetric tension. System + monospace type, no decoration that
isn't load-bearing. Then: a controlled Italian-Brainrot layer in the microcopy
(never on the data — austerity and accuracy always win there), and a hidden
`/140-85` Mei Ling codec call. Full spec: [`docs/design-language.md`](docs/design-language.md).

## This repo is alive

A `grip-anywhere`-style workflow continuously reads its own state and proposes
improvements as PRs. The leaderboard, the screenshots, and parts of this README
are regenerated, not maintained. Self-improvement runs read-only by default;
nothing untrusted ever executes.

## Credits

- Built with [GRIP](https://about.grip-web.com) — General Reasoning & Intelligence Platform.
- © 2026 **Lourens Cornelius Scheepers** — [LinkedIn](https://www.linkedin.com/in/laurie-scheepers/).
- [ENTER Konsult](https://www.enterkonsult.com) · alternative: [CodeTonight-SA](https://codetonight-sa.github.io/)
- Licensed **MIT** — see [`LICENSE`](LICENSE). Use it, fork it, flex with it.

## Status

**PRIVATE DRAFT.** The competition is not open. When the maintainer is happy,
this goes public and the board goes live. Until then: it builds, it verifies,
it waits.
