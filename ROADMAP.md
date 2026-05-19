# Roadmap

`ccflex-skibidi` is built as a sequence of small, independently-verifiable
work items. Each ships only when its criterion is met by something outside the
code that wrote it (tests that can fail, CI, a real headless render) — not by
self-assessment.

| Stage | What it is | Done when |
|------|------------|-----------|
| Scaffold | License, governance, this roadmap | repo clean, MIT + attribution correct, no leaked paths/secrets |
| Stats ingest | `/stats`+`/usage` → canonical `entry.json` + schema | reference numbers round-trip exactly; schema-valid; deterministic |
| Generator | three.js self-contained delight page | every number pixel-faithful; WCAG AA; mobile 60fps or graceful 2D fallback; reduced-motion |
| Verification | re-compute + tamper-evidence | rejects tampered entries; accepts honest ones; never executes a submission |
| Leaderboard | novel, accurate, fair cross-entry metrics | reproducible; derived only from verified entries; anti-gaming documented |
| Hosting | GitHub Pages canonical + Vanish instant preview | Pages builds; entry-PR flow works; screenshot auto-updates |
| Self-aware CI | verify + regenerate + propose-own-improvements | untrusted PRs cannot execute; board auto-updates; self-RSI sandboxed |
| Plugin | `/ccflex-skibidi` for any Claude Code install | builds a valid entry + card on a clean install |
| Competition | submission template, judging, public-flip checklist | a stranger can submit in under five minutes |

Nothing here is "maintained". The later stages rewrite the earlier ones'
outputs continuously. The roadmap is a description of a living thing, not a
backlog that gets ticked off and abandoned.
