# Metrics & ranking

The board has to mean something, so the maths is in the open and the inputs
are tamper-evident. You cannot climb by inventing a number — every input is
bound by the integrity hash and re-verified on every PR. The formula is not a
secret; it does not need to be, because the **inputs** are the thing that
cannot be faked.

## Inputs (only verified `entry.json` fields)

| Symbol | Source field | Note |
|--------|--------------|------|
| `tokens` | `stats.totalTokens.value` | `~` shown if `exact:false` (de-rounded display) |
| `activeN` | `stats.activeDays.active` | days actually used |
| `windowD` | `source.window.days` | the canonical period for all rates |
| `streakL` | `stats.streak.longestDays` | |
| `enduranceM` | `stats.longestSessionMinutes` | optional → 0 |
| `f1984` | fun-fact `tokens-vs-1984`.value | playful, always shown `≈` (approx) |

## Derived, window-normalised metrics

Different people capture different windows. Raw totals reward a longer window,
not more skill. So the comparable metrics are rates:

- **Intensity** `= tokens / activeN` (tokens per active day; `0` if `activeN=0`)
- **Consistency** `= clamp(activeN / windowD, 0, 1)` (fraction of the window active)
- **Streak quality** `= clamp(streakL / windowD, 0, 1)` (sustained run vs opportunity)
- **Endurance** `= enduranceM` (the raw "8d 21h" flex — kept raw, it *is* the brag)

## Flex Score (the sort key) — published weights

Heavy-tailed values (`tokens`, `intensity`, `endurance`) are `log1p`-scaled
then min–max normalised **across the current verified cohort** (recomputed each
build → deterministic given the entry set). `consistency` and `streakQuality`
are already in `[0,1]`.

```
norm(x over cohort) = (cohort.size <= 1 || max==min) ? 1.0
                     : (log1p(x) - log1p(min)) / (log1p(max) - log1p(min))

Flex = round(1000 * (
    0.40 * norm(tokens)
  + 0.25 * norm(intensity)
  + 0.20 * consistency
  + 0.10 * streakQuality
  + 0.05 * norm(endurance)
))                                   // weights sum to 1.00
```

Single-entry (or all-equal) cohort: only the three `norm()`-scaled channels
(`tokens`, `intensity`, `endurance`) degenerate to `1.0` — there is nothing to
normalise against. `consistency` and `streakQuality` stay **absolute** (they
are meaningful alone — fraction of the window you actually showed up), so:

```
Flex(single) = round(1000 * (0.70 + 0.20*consistency + 0.10*streakQuality))
```

Worked example — the seed (`consistency = 82/105`, `streakQuality = 20/105`):
`round(1000 * (0.70 + 0.20*0.780952 + 0.10*0.190476)) = 875`. The seed scores
**875**, not a vacuous 1000: even alone, not showing up every day costs you.
That is the design intent — the absolute channels keep a lone entry honest.

## Why this is Goodhart-considered, not Goodhart-bait

1. **Structural, not obscured.** The defence against gaming is that
   `tokens`, `activeN`, etc. are bound by the integrity hash and re-verified
   (see `SECURITY.md`, `docs/hypotheses.md` H-CCFLEX-1). You would have to
   defeat verification, not the formula.
2. **Shadow flag (transparent, never silent).** An entry with `activeN < 3`
   **and** `intensity` above the cohort 95th percentile is annotated
   `suspect: true` on the board with the reason shown — it is not deleted and
   not silently down-ranked (Rule 19: surface, don't hide).
3. **Honesty markers.** `tokens` with `exact:false` is shown with a `~`;
   `f1984` is always shown with `≈`. The board never implies more precision
   than the source gave.
4. **No free variable.** `additionalProperties:false` in the schema means
   there is no extra field a contributor can add to influence the score.

## Falsifier

If a verified-but-dishonest entry can reach the top of the board, the ranking
is theatre. That is H-CCFLEX-1's falsifier and is checked by CI on every PR,
not by anyone's opinion.
