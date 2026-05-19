#!/bin/sh
# cf-preview.sh — optional, never-blocking Cloudflare Pages preview.
#
# Replaces scripts/vanish-preview.sh: Vanish served uploaded .html with a
# download disposition (force-download, did not render). A Cloudflare Pages
# *preview* deployment serves the whole site/ with correct text/html, so the
# card actually renders, and gives a stable shareable URL.
#
# Decision: drafts/ccflex-cf-card-link-council.md (broly mesh, 2026-05-19).
#
# Contract (identical to the old vanish-preview.sh): preview is OPTIONAL and
# MUST NEVER block a submission. If `wrangler` is missing or not authed, this
# prints a clear note and exits 0 — the contributor can still open a PR; CI
# verifies and the canonical board renders post-merge.
#
# Usage:  sh scripts/cf-preview.sh [path/to/card.html]
#   The arg is informational (which card to look at); a Pages preview deploys
#   the whole site/, so the card is at <preview-url>/cards/<name>.

set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SITE_DIR="$REPO_ROOT/site"
CARD_ARG="${1:-}"

if ! command -v wrangler >/dev/null 2>&1; then
  echo "cf-preview: 'wrangler' not on PATH — preview skipped (this is OPTIONAL)."
  echo "  To enable: npm i -g wrangler && wrangler login  (your own Cloudflare account)."
  echo "  You can still open your entry PR now; CI verifies and the board renders on merge."
  exit 0
fi

if [ ! -d "$SITE_DIR" ]; then
  echo "cf-preview: $SITE_DIR not found — nothing to preview." >&2
  exit 0
fi

echo "cf-preview: deploying a Cloudflare Pages PREVIEW of site/ ..."
if ! wrangler pages deploy "$SITE_DIR" --branch=preview --commit-dirty=true 2>&1; then
  echo "cf-preview: wrangler not authed or deploy failed — preview skipped (OPTIONAL)."
  echo "  Run 'wrangler login' first. Submission is not blocked."
  exit 0
fi

if [ -n "$CARD_ARG" ]; then
  echo "cf-preview: your card is at  <preview-url>/cards/$(basename -- "$CARD_ARG")"
fi
echo "cf-preview: done (the printed *.pages.dev URL renders the board + cards)."
exit 0
