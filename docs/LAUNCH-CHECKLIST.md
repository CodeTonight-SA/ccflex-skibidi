# Launch checklist — MAINTAINER ONLY (V>>)

This repo is built **private/draft first**. It does not go public, and the
competition is not announced, until every box below is ticked by a human. The
autonomous loop **never** flips this itself — making a private repo public
under a real legal name is outward-facing and irreversible (bootstrap
exception: the loop does not grant itself the authority to do the one thing it
must not do).

## Pre-flight (must all pass)

- [ ] `npm test` green on a clean checkout (every test can fail under mutation).
- [ ] `node src/leaderboard.mjs --check` clean (README board not stale).
- [ ] No private R&D codename, contents, or internal paths anywhere — run the
      public-release sanitiser; the private CodeTonight-SA R&D repo was
      *inspiration only* and must not be traceable here.
- [ ] No secrets, no absolute user paths, no `instance`/state files committed
      (`.gitignore` covers them; verify the tree, do not assume).
- [ ] `LICENSE` = MIT, © **Lourens Cornelius Scheepers**, year correct.
- [ ] README credits verify present (V>> supplied 2026-05-19, no longer TODO):
      LinkedIn `https://www.linkedin.com/in/laurie-scheepers/`, GRIP
      `https://about.grip-web.com`, ENTER Konsult `https://www.enterkonsult.com`,
      alternative `https://codetonight-sa.github.io/`.
- [ ] Untrusted-content path reviewed: CI verifies submissions by **parsing,
      never executing**; the verify job is capability-locked; forked-PR
      workflows expose no repo secrets.
- [ ] Remove the `PRIVATE DRAFT` HTML banner at the top of README and the
      `## Status` section (or update it to "live").

## Flip sequence (human-run)

1. Create the GitHub repo **private** first; push; sanity-check the rendered
   README + a generated card on GitHub Pages from a private Pages build if
   possible.
2. Human review of the full tree against this checklist.
3. Make the repo public.
4. Announce the competition (channels per the maintainer's own scope rules —
   not from this loop).

## What the loop may do unattended

Build, test, verify, regenerate the board/screenshots, open improvement PRs
into the **private** repo. Everything up to — never including — the public
flip and the announcement.
