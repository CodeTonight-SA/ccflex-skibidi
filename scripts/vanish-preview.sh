#!/bin/sh
# ccflex-skibidi · optional temporary preview link for a card.
#
#   scripts/vanish-preview.sh <card.html>
#
# Uploads the card via the `vanish` CLI (vanish-cli) and prints the
# temporary public URL so you can look before you leap. Preview is
# OPTIONAL — it never blocks submission. If `vanish` is not on PATH
# this prints an install note and exits 0 (success, just no preview).
#
# POSIX sh only. No bashisms.

set -eu

card="${1:-}"

if [ -z "$card" ]; then
  echo "usage: scripts/vanish-preview.sh <card.html>" >&2
  exit 2
fi

if [ ! -f "$card" ]; then
  echo "Card not found: $card" >&2
  exit 2
fi

if ! command -v vanish >/dev/null 2>&1; then
  echo "vanish CLI not found on PATH. Preview is optional and was skipped."
  echo "To enable temporary preview links, install vanish-cli:"
  echo "  https://github.com/ (vanish-cli) — then re-run this script."
  exit 0
fi

echo "Uploading $card via vanish ..."
url="$(vanish "$card")"

if [ -z "$url" ]; then
  echo "vanish returned no URL. Preview unavailable (submission not blocked)." >&2
  exit 0
fi

echo "Temporary preview URL:"
echo "$url"
exit 0
