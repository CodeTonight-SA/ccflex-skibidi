# Pre-registered hypotheses

This project makes falsifiable claims and registers them *before* the work
that would confirm them. A claim with no stated way to be wrong is not a
feature — it is decoration. Each hypothesis below has a metric, a prediction,
a deadline, and an explicit falsifier. They are checked against something the
code cannot talk its way past (a test that can fail, CI, a real render, real
contributors).

## H-CCFLEX-1 — Invertibility makes accuracy machine-checked

- **Claim:** every visual channel in a generated card is a pure function of a
  value in the embedded JSON island, and `verify()` returns `true` only when
  geometry ↔ JSON ↔ DOM parity holds and the integrity hash recomputes.
- **Metric:** single-field mutation-kill rate of the `verify()` test suite.
- **Prediction:** 100% of single stat-field mutations (change one number in
  the embedded JSON) cause `verify()` to return `false` and CI to fail.
- **Deadline:** WI-3 (verification) complete + first 30 days of submissions.
- **Falsified if:** any mutated/dishonest entry passes `verify()`, or any
  honest entry fails it (false positive). Either breaks the core promise.

## H-CCFLEX-2 — It is a repo people want to contribute to

- **Claim:** the format (render-your-stats, verifiable, ranked) is intrinsically
  motivating enough to draw unsolicited external contributions.
- **Metric:** count of merged `entries/*.json` from contributors other than
  the maintainer.
- **Prediction:** ≥ 10 external verified entries within 30 days of the public
  flip (exact target reconfirmed by the maintainer at flip time).
- **Deadline:** public-flip date + 30 days.
- **Falsified if:** 0 external entries in 30 days — then the draw hypothesis is
  wrong and the format, not the marketing, needs rework.

## H-CCFLEX-3 — No number on screen is unprovable

- **Claim:** every number a card displays is derivable from that card's own
  embedded JSON within the precision the schema records (`exact` flag honoured;
  approximate fun-facts shown as approximate).
- **Metric:** count of displayed values with no inverse mapping to embedded JSON.
- **Prediction:** exactly 0, across every published card, enforced by CI.
- **Deadline:** continuous (every merged entry).
- **Falsified if:** any card ever shows a figure that cannot be reproduced from
  its embedded JSON — the design axiom would be violated, not just a bug.

## Why these and not a self-score

None of these is graded by the system that produces the work. H-CCFLEX-1 and
H-CCFLEX-3 are decided by tests that fail loudly and by CI on every PR.
H-CCFLEX-2 is decided by real people choosing to contribute or not. That is
the point: the exit criterion is exogenous.
