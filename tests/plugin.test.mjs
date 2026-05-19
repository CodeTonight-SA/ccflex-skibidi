// Zero-dependency, Goodhart-proof tests for the ccflex-skibidi Claude Code
// plugin. Every assertion fails under an obvious mutation of the file it
// guards: a missing manifest field, a renamed CLI path, a dropped schema
// reference, or a leaked secret/absolute path.
//
//   node --test tests/plugin.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = (p) => join(ROOT, p);
const read = (p) => readFileSync(P(p), "utf8");

const MANIFEST = "plugin/.claude-plugin/plugin.json";
const COMMAND = "plugin/commands/ccflex-skibidi.md";
const SKILL = "plugin/skills/ccflex-skibidi/SKILL.md";
const PLUGIN_README = "plugin/README.md";

test("plugin.json exists and is strict, comment-free JSON", () => {
  assert.ok(existsSync(P(MANIFEST)), `${MANIFEST} must exist`);
  const raw = read(MANIFEST);
  assert.doesNotThrow(() => JSON.parse(raw), "plugin.json must be valid JSON");
  assert.ok(!/^\s*\/\//m.test(raw), "no // comments allowed in manifest");
  assert.ok(!/\/\*/.test(raw), "no /* */ comments allowed in manifest");
});

test("plugin.json has required, correct manifest fields", () => {
  const m = JSON.parse(read(MANIFEST));
  assert.equal(m.name, "ccflex-skibidi", "manifest name must be ccflex-skibidi");
  assert.match(
    m.version,
    /^\d+\.\d+\.\d+$/,
    "version must be semver MAJOR.MINOR.PATCH"
  );
  assert.equal(
    typeof m.description,
    "string",
    "description must be a string"
  );
  assert.ok(
    m.description.length >= 20,
    "description must be meaningful (>=20 chars)"
  );
  assert.equal(
    m.author,
    "Lourens Cornelius Scheepers",
    "author must be Lourens Cornelius Scheepers"
  );
  // Command + skill wiring must be present (mirrors the real manifest schema).
  assert.equal(m.commandsDir, "commands", "manifest must wire commandsDir");
  assert.equal(m.skillsDir, "skills", "manifest must wire skillsDir");
});

test("manifest-declared command and skill directories actually contain the files", () => {
  const m = JSON.parse(read(MANIFEST));
  assert.ok(
    existsSync(P(join("plugin", m.commandsDir, "ccflex-skibidi.md"))),
    "commandsDir must contain ccflex-skibidi.md"
  );
  assert.ok(
    existsSync(P(join("plugin", m.skillsDir, "ccflex-skibidi", "SKILL.md"))),
    "skillsDir must contain ccflex-skibidi/SKILL.md"
  );
});

test("command + skill + plugin README files exist", () => {
  for (const f of [COMMAND, SKILL, PLUGIN_README]) {
    assert.ok(existsSync(P(f)), `${f} must exist`);
  }
});

test("command references the real generate/validate CLIs and the schema", () => {
  const c = read(COMMAND);
  assert.match(c, /src\/generate\.mjs/, "command must reference src/generate.mjs");
  assert.match(c, /src\/validate\.mjs/, "command must reference src/validate.mjs");
  assert.match(
    c,
    /validate\.mjs\s+--hash/,
    "command must use validate.mjs --hash for integrity"
  );
  assert.match(
    c,
    /schema\/entry\.schema\.json/,
    "command must reference schema/entry.schema.json"
  );
  assert.match(
    c,
    /entries\/<handle>\.json/,
    "command must write entries/<handle>.json per CONTRIBUTING"
  );
});

test("skill has valid frontmatter: name, description, triggers", () => {
  const s = read(SKILL);
  const fm = s.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, "SKILL.md must open with a YAML frontmatter block");
  const block = fm[1];
  assert.match(block, /^name:\s*ccflex-skibidi\s*$/m, "frontmatter name must be ccflex-skibidi");
  assert.match(block, /^description:\s*\S/m, "frontmatter must have a description");
  assert.match(block, /^triggers:\s*$/m, "frontmatter must declare triggers");
  assert.match(block, /^\s+-\s*\/ccflex-skibidi\s*$/m, "triggers must include /ccflex-skibidi");
});

test("skill references the real CLIs, schema, and the honesty contract", () => {
  const s = read(SKILL);
  assert.match(s, /src\/generate\.mjs/, "skill must reference src/generate.mjs");
  assert.match(s, /src\/validate\.mjs/, "skill must reference src/validate.mjs");
  assert.match(
    s,
    /schema\/entry\.schema\.json/,
    "skill must reference schema/entry.schema.json"
  );
  assert.match(
    s,
    /honesty contract/i,
    "skill must emphasise the honesty contract"
  );
  assert.match(
    s,
    /exact:\s*false/,
    "skill must explain exact:false for rounded displays"
  );
});

test("no secrets and no absolute user paths committed in plugin files", () => {
  const files = [MANIFEST, COMMAND, SKILL, PLUGIN_README];
  // Absolute home paths leak the maintainer's machine layout.
  const ABS_PATH = /\/(Users|home)\/[A-Za-z0-9._-]+\//;
  // Common credential shapes — must never appear in committed plugin docs.
  const SECRET = /(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{8,})/;
  for (const f of files) {
    const body = read(f);
    assert.ok(!ABS_PATH.test(body), `${f} must not contain an absolute user path`);
    assert.ok(!SECRET.test(body), `${f} must not contain a secret`);
  }
});
