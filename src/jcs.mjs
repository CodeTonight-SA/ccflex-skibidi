// RFC 8785 JSON Canonicalization Scheme (JCS) — scoped implementation.
//
// Scope (correct-by-construction for THIS project's data, documented honestly):
//   - objects: keys sorted ascending by UTF-16 code unit (JS default string
//     sort), undefined values omitted, no whitespace.
//   - arrays: element order preserved.
//   - strings: JSON.stringify escaping. JSON.stringify escapes exactly U+0022,
//     U+005C and the C0 controls U+0000..U+001F and emits every other code
//     point literally — which is precisely JCS string serialization. Non-ASCII
//     labels are therefore handled correctly without \u escaping.
//   - numbers: entry data is integers < 2^53 (token/session counts, minutes)
//     and small finite fun-fact values. For those, ECMAScript Number::toString
//     (String(n)) is already the JCS shortest form. Values outside that domain
//     are rejected up front so we never silently mis-canonicalize.
//
// Anything outside that domain throws — we fail loud rather than hash wrong.

function canonNumber(n) {
  if (!Number.isFinite(n)) throw new Error(`jcs: non-finite number: ${n}`);
  if (Number.isInteger(n)) {
    if (Math.abs(n) >= 2 ** 53) throw new Error(`jcs: integer out of safe range: ${n}`);
    return String(n);
  }
  // Finite non-integer (e.g. a fun-fact ratio). Shortest round-trip form.
  const s = String(n);
  if (s.includes("e") || s.includes("E")) {
    throw new Error(`jcs: number requires exponent form, out of scope: ${n}`);
  }
  return s;
}

function canonString(s) {
  // JSON.stringify on a string yields RFC 8785-conformant escaping for our data.
  return JSON.stringify(s);
}

function canon(value) {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") return canonNumber(value);
  if (t === "string") return canonString(value);
  if (Array.isArray(value)) return "[" + value.map(canon).join(",") + "]";
  if (t === "object") {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort(); // default sort = ascending by UTF-16 code unit (JCS requirement)
    return "{" + keys.map((k) => canonString(k) + ":" + canon(value[k])).join(",") + "}";
  }
  throw new Error(`jcs: unserializable value of type ${t}`);
}

/** Return the RFC 8785 canonical JSON string for a JSON-compatible value. */
export function canonicalize(value) {
  return canon(value);
}
