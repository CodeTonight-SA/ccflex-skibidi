#!/usr/bin/env node
// ccflex-skibidi · deterministic card screenshot.
//
//   node scripts/screenshot.mjs <card.html> <out.png>
//
// Drives Playwright Chromium headless to shoot a card reproducibly:
// fixed viewport, prefers-reduced-motion forced (no count-up / scanline /
// reveal tween → byte-stable shot), waits for a stable signal before capture.
//
// Playwright is a CI-only tool. It is intentionally NOT a package.json
// dependency and node_modules is intentionally NOT installed. This script
// imports it lazily and degrades with a clear plain-language message and
// exit code 3 when it is absent — it never crashes the test suite.

import { existsSync } from "node:fs";

const DEFAULT_VIEWPORT = { width: 1200, height: 1600 };
const STABLE_SELECTOR = "main, body";
const STABLE_TIMEOUT_MS = 15000;

export function parseArgs(argv) {
  // Accepts an optional --viewport WxH flag before positional args.
  // Default: 1200x1600 (backward-compatible; unchanged when flag absent).
  let viewport = DEFAULT_VIEWPORT;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--viewport" && argv[i + 1]) {
      const m = argv[++i].match(/^(\d+)x(\d+)$/);
      if (!m) return { ok: false, error: "--viewport must be WxH e.g. 375x667" };
      viewport = { width: Number(m[1]), height: Number(m[2]) };
    } else {
      rest.push(argv[i]);
    }
  }
  const [cardPath, outPath] = rest;
  if (!cardPath || !outPath) {
    return { ok: false, error: "usage: node scripts/screenshot.mjs [--viewport WxH] <card.html> <out.png>" };
  }
  return { ok: true, cardPath, outPath, viewport };
}

export async function loadPlaywright() {
  // Lazy + soft: a missing optional CI tool must not throw into the suite.
  try {
    const mod = await import("playwright");
    return { ok: true, chromium: mod.chromium };
  } catch {
    return {
      ok: false,
      message:
        "Playwright is not installed. It is a CI-only tool — run it via " +
        "`npx playwright install chromium` in CI, not from this repo's " +
        "package.json. Skipping screenshot (exit 3).",
    };
  }
}

export async function shoot(chromium, cardPath, outPath, viewport) {
  const vp = viewport || DEFAULT_VIEWPORT;
  const fileUrl = "file://" + (cardPath.startsWith("/") ? cardPath : process.cwd() + "/" + cardPath);
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: 1,
      reducedMotion: "reduce", // determinism: no tween, no scanline, no count-up
      colorScheme: "light",
    });
    const page = await ctx.newPage();
    await page.goto(fileUrl, { waitUntil: "networkidle" });
    await page.waitForSelector(STABLE_SELECTOR, { state: "visible", timeout: STABLE_TIMEOUT_MS });
    await page.screenshot({ path: outPath, fullPage: true, animations: "disabled" });
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(args.error);
    process.exit(2);
  }
  if (!existsSync(args.cardPath)) {
    console.error("Card not found: " + args.cardPath);
    process.exit(2);
  }
  const pw = await loadPlaywright();
  if (!pw.ok) {
    console.error(pw.message);
    process.exit(3); // graceful degrade — never a crash
  }
  try {
    await shoot(pw.chromium, args.cardPath, args.outPath, args.viewport);
    console.log("Screenshot written: " + args.outPath);
    process.exit(0);
  } catch (err) {
    console.error("Screenshot failed: " + (err && err.message ? err.message : String(err)));
    process.exit(1);
  }
}

// Only run the CLI when invoked directly, never on import (tests import this).
const invokedDirectly =
  process.argv[1] && import.meta.url === "file://" + process.argv[1];
if (invokedDirectly) {
  main();
}
