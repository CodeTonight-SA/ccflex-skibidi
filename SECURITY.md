# Security Policy

## Threat model

`ccflex-skibidi` accepts pull requests containing `entries/*.json` from
**untrusted contributors**. The core security property is therefore:

> A contributor's submission is untrusted content. It is parsed and verified,
> never executed, and the verification surface is capability-locked.

### What this means concretely

- Entry JSON is loaded with a strict JSON parser and validated against a JSON
  Schema before anything else touches it. No `eval`, no dynamic `import`, no
  code path that executes a string from an entry.
- The verifier runs the submitted HTML card in a sandboxed headless browser
  with the minimum capability set required to read the canvas and call
  `verify()` — no filesystem, no network egress, no shell.
- CI jobs that handle untrusted PR content run with least privilege and do not
  expose repository secrets to forked-PR workflows.
- The self-improvement ("alive") workflow runs **read-only by default**; any
  change it proposes goes through the same untrusted-content path as a human
  PR.

This mirrors the principle that authenticating the *sender* of an input is not
authenticating the *content* of that input — the defence lives in the
capability surface, not in a sender allowlist.

## Reporting a vulnerability

If you find a way to make a dishonest entry verify, to execute code via a
submission, or to exfiltrate anything from CI, **do not open a public issue**.
Report it privately to the maintainer (contact via the repository owner's
profile / the LinkedIn in the README). You will be credited unless you ask not
to be.

## Scope

In scope: the verifier, the schema, the CI pipeline, the generator's
JSON-island handling, the plugin.
Out of scope: the contributor's own machine and their own `/stats` data — the
generator runs locally and sends nothing anywhere; the contributor chooses
what to commit.
