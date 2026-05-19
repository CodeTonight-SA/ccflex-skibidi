# CI — how the three workflows keep an untrusted-PR repo safe

`ccflex-skibidi` takes pull requests from people we do not know. The whole CI
design follows one rule from `SECURITY.md`:

> A contributor's submission is **untrusted content**. It is parsed and
> verified, **never executed**, and the verification surface is
> capability-locked.

There are three workflows. Each has exactly the power it needs and no more.

## 1. `ci.yml` — verify every pull request

**Triggers:** `pull_request` and `push` to `main`.

**Why `pull_request` and not `pull_request_target`:** this is the single most
important choice. `pull_request` runs the workflow using the *forked PR's* code
in an environment with **no repository secrets** and a token scoped to the
permissions below. `pull_request_target` would run with the *base repo's*
secrets and a write token while still pulling in attacker-controlled code — the
classic forked-PR privilege-escalation footgun. We never use it.

**Permissions:** `contents: read` only. The job can read the checked-out code
and nothing else. It cannot write to the repo, cannot open issues, cannot touch
secrets (there are none exposed to forked PRs anyway).

**What it does, in order:**

1. `npm test` — the unit suite. Every test is written so an obvious mutation
   makes it fail (Goodhart-resistant), so "tests pass" is a real signal.
2. `node src/validate.mjs <entry>` for every `entries/*.json` — strict JSON
   parse + schema validation. A submission that is not well-formed, honest
   data is rejected here.
3. `node src/verify-card.mjs <card> <entry>` for every `site/cards/*.html`
   against its committed entry. The verifier extracts two allowlisted JSON
   islands with fixed regexes and `JSON.parse`s them. It does **not** run the
   HTML, does not use a browser, does not `eval`, does not dynamic-`import`.
   A `<script>` in a submitted card is inert text here by construction.
4. `node src/leaderboard.mjs --check` — fails if the committed README board is
   stale, so the ranking can never be hand-edited in.

**Why this is safe:** untrusted content only ever reaches a JSON parser and a
schema check. There is no code path that turns a string from a submission into
execution. Least privilege + no secrets + parse-never-execute = a forked PR
can, at worst, fail its own checks.

## 2. `board-refresh.yml` — the "repo is alive" self-update

**Triggers:** `push` to `main` **only**. Never `pull_request`. A forked PR
must never reach a job with a write token; gating on push-to-main means only
code that already merged (already trusted) can trigger the regeneration.

**Permissions:** `contents: write` — needed because it commits the regenerated
board back.

**Safety guards:**

- A `concurrency` group (`board-refresh`) serialises runs so two quick pushes
  to `main` cannot race the commit-back and clobber each other.
- It skips the commit entirely if `git status --porcelain` shows no change —
  no empty commits, no churn.
- The commit message carries `[skip ci]` so the bot's own commit does not
  retrigger CI in a loop.

## 3. `self-rsi.yml` — read-only weekly improvement pass

**Triggers:** `schedule` (weekly) + manual `workflow_dispatch`.

**Permissions:** `contents: read` + `issues: write`. Note what is **absent**:
no `contents: write`. This workflow physically cannot change a single file in
the repo. It analyses the repo and **opens an issue** with proposed
improvements — that is the entire blast radius.

**Bootstrap exception:** the loop never self-merges, never modifies code, and
**never flips the repo public**. Making a private repo public under a real
legal name is outward-facing and irreversible; per
`docs/LAUNCH-CHECKLIST.md`, only a human does that. The autonomous loop is not
allowed to grant itself the one authority it must not have. Any improvement it
proposes goes back through the same untrusted-content PR path as a human
contributor — it gets no shortcut.

## Summary — least privilege at a glance

| Workflow | Trigger | `contents` | Other | Can mutate repo? | Sees secrets? |
|---|---|---|---|---|---|
| `ci.yml` | `pull_request`, push | `read` | — | No | No (forked-PR-safe) |
| `board-refresh.yml` | push to `main` only | `write` | — | Board only | Trusted (post-merge) |
| `self-rsi.yml` | schedule, dispatch | `read` | `issues: write` | No | No |

The defence is in the capability surface, not in trusting who sent the PR.
